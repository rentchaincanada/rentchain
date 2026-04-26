import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignedDownloadUrlMock = vi.fn(async () => "https://signed.example.com/lease.pdf");

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let idSeq = 0;

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.data?.[field];
      if (op === "==") return actual === value;
      if (op === "array-contains") return Array.isArray(actual) && actual.includes(value);
      return false;
    });
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      orderBy: () => makeQuery(name, filters),
      limit: () => makeQuery(name, filters),
      get: async () => {
        const col = ensureCollection(name);
        const docs = Array.from(col.values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, forEach: (fn: any) => docs.forEach(fn), size: docs.length };
      },
      doc: (id?: string) => makeDoc(name, id),
    };
  }

  function makeDoc(name: string, id?: string) {
    const actualId = id || `doc_${++idSeq}`;
    const col = ensureCollection(name);
    return {
      id: actualId,
      set: async (value: any, options?: { merge?: boolean }) => {
        const current = col.get(actualId)?.data || {};
        col.set(actualId, { id: actualId, data: options?.merge ? { ...current, ...value } : value });
      },
      get: async () => {
        const entry = col.get(actualId);
        return { id: actualId, exists: Boolean(entry), data: () => entry?.data };
      },
    };
  }

  return {
    resetFakeDb: () => {
      store.clear();
      idSeq = 0;
    },
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        orderBy: () => makeQuery(name),
        limit: () => makeQuery(name),
        get: async () => makeQuery(name).get(),
        doc: (id?: string) => makeDoc(name, id),
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: fakeDb,
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../services/leaseDraftsService", () => ({
  NS_PROVINCE: "NS",
  NS_TEMPLATE_VERSION: "ns-schedule-a-v1",
  applyPatch: vi.fn((existing: any) => existing),
  validateCreateInput: vi.fn(),
  getDraftById: vi.fn(),
  getSnapshotById: vi.fn(),
  generateScheduleA: vi.fn(),
}));

vi.mock("../../lib/gcsSignedUrl", () => ({
  getSignedDownloadUrl: getSignedDownloadUrlMock,
}));

describe("leaseRoutes GET /active", () => {
  beforeEach(() => {
    resetFakeDb();
    getSignedDownloadUrlMock.mockClear();
  });

  async function makeApp() {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
      next();
    });
    app.use(router);
    return app;
  }

  it("returns landlord-scoped active leases with tenant and document details", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
    seedDoc("leaseDrafts", "draft-1", { landlordId: "landlord-1", lastGeneratedSnapshotId: "snapshot-1" });
    seedDoc("leaseSnapshots", "snapshot-1", {
      landlordId: "landlord-1",
      generatedFiles: [{ url: "https://files.example.com/lease.pdf" }],
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      tenantSignature: {
        signedAt: "2026-01-05T12:00:00.000Z",
        signatureMethod: "typed",
        signatureDisplayName: "Jane Tenant",
        drawnDataUrl: "data:image/png;base64,should-not-leak",
      },
      sourceDraftId: "draft-1",
      createdAt: 1,
      updatedAt: 2,
    });
    seedDoc("leases", "lease-2", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-2",
      unitNumber: "102",
      monthlyRent: 1500,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "ended",
    });

    const app = await makeApp();
    const res = await request(app).get("/active");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.leases).toHaveLength(1);
    expect(res.body?.leases?.[0]).toEqual(
      expect.objectContaining({
        id: "lease-1",
        propertyName: "Harbour View",
        tenantName: "Jane Tenant",
        tenantEmail: "jane@example.com",
        documentUrl: "https://files.example.com/lease.pdf",
        signatureStatus: "signed",
        signatureReadinessLabel: "Lease signing complete",
        tenantSignature: {
          signedAt: "2026-01-05T12:00:00.000Z",
          signatureMethod: "typed",
          signatureDisplayName: "Jane Tenant",
        },
        leasePdfStatus: "available",
      })
    );
    expect(res.body?.leases?.[0]?.tenantSignature?.drawnDataUrl).toBeUndefined();
  });

  it("excludes targeted synthetic cleanup leases from landlord active lists", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant" });
    seedDoc("leases", "test_lease_quit_01", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: 2,
      updatedAt: 2,
    });
    seedDoc("leases", "lease-visible", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      unitId: "unit-2",
      unitNumber: "102",
      monthlyRent: 1900,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: 3,
      updatedAt: 3,
    });

    const app = await makeApp();
    const res = await request(app).get("/active");

    expect(res.status).toBe(200);
    expect(res.body?.leases.map((lease: { id: string }) => lease.id)).toEqual(["lease-visible"]);
  });
});
