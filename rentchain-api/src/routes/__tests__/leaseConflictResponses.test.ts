import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leaseService } from "../../services/leaseService";

const { fakeDb, getSeededDoc, resetFakeDb, seedDoc } = vi.hoisted(() => {
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
      delete: async () => {
        col.delete(actualId);
      },
    };
  }

  return {
    resetFakeDb: () => {
      store.clear();
      idSeq = 0;
    },
    getSeededDoc: (name: string, id: string) => ensureCollection(name).get(id)?.data,
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    fakeDb: {
      runTransaction: async (callback: any) => callback({
        get: (target: any) => target.get(),
        set: (ref: any, value: any, options?: any) => ref.set(value, options),
        create: (ref: any, value: any) => ref.set(value),
      }),
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

vi.mock("../../firebase", () => ({
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
  validateCreateInput: vi.fn((_landlordId: string, body: any) => ({ ...body, landlordId: "landlord-1", templateVersion: "ns-schedule-a-v1" })),
  getDraftById: vi.fn(async () => ({ exists: false, data: () => null, id: "draft" })),
  getSnapshotById: vi.fn(async () => ({ exists: false, data: () => null, id: "snap" })),
  generateScheduleA: vi.fn(async () => ({ file: { url: "https://example.invalid/file.pdf" }, pdfBuffer: Buffer.from("pdf"), sha256: "x", sizeBytes: 3 })),
}));

describe("lease conflict responses", () => {
  beforeEach(() => {
    resetFakeDb();
    leaseService.getAll().splice(0);
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

  function seedUnit(id: string, data: any) {
    seedDoc("units", id, { landlordId: "landlord-1", propertyId: "prop-1", ...data });
  }

  function seedLease(id: string, data: any) {
    seedDoc("leases", id, {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      unitNumber: "A",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      status: "active",
      monthlyRent: 1800,
      currentRent: 1800,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      createdAt: 1,
      updatedAt: 1,
      ...data,
    });
  }

  it("returns the machine-readable conflict code for direct create overlaps", async () => {
    seedUnit("unit-1", { unitNumber: "A", status: "occupied" });
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", units: [{ id: "unit-1", unitId: "unit-1", unitNumber: "A", status: "occupied", tenantId: "tenant-1" }] });
    seedDoc("tenants", "tenant-2", { landlordId: "landlord-1", currentLeaseId: null });
    seedLease("lease-1", { executionStatus: "fully_executed" });
    const app = await makeApp();

    const res = await request(app).post("/").set("Idempotency-Key", "conflict-create").send({
      tenantId: "tenant-2",
      propertyId: "prop-1",
      unitNumber: "unit-1",
      monthlyRent: 1900,
      startDate: "2026-01-15",
      endDate: "2026-11-30",
      executionStatus: "fully_executed",
    });

    expect(res.status).toBe(409);
    expect(res.body?.error).toBe("conflicting_active_lease_agreement");
    expect(res.body?.reasons).toContain("MULTIPLE_CURRENT_LEASES");
  });

  it("creates a pending-signing lease without resolving an occupied-unit conflict", async () => {
    seedUnit("unit-1", { unitNumber: "A", status: "occupied" });
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", units: [{ id: "unit-1", unitId: "unit-1", unitNumber: "A", status: "occupied", tenantId: "tenant-1" }] });
    seedDoc("tenants", "tenant-2", { landlordId: "landlord-1", currentLeaseId: null });
    seedLease("lease-1", { executionStatus: "fully_executed" });
    seedDoc("leaseDrafts", "draft-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      tenantIds: ["tenant-2"],
      province: "NS",
      termType: "fixed",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      baseRentCents: 185000,
      dueDay: 1,
      paymentMethod: "etransfer",
      templateVersion: "ns-schedule-a-v1",
      executionStatus: "fully_executed",
    });
    const app = await makeApp();

    const res = await request(app).post("/drafts/draft-1/activate").set("Idempotency-Key", "conflict-draft").send({});

    expect(res.status).toBe(200);
    expect(res.body?.lease).toMatchObject({
      status: "pending",
      executionStatus: "draft",
      executionState: "draft",
      signingStatus: "not_started",
    });
    expect(res.body?.occupancyOutcome).toBe("created_without_occupancy");
    expect(getSeededDoc("units", "unit-1")).toMatchObject({
      status: "occupied",
    });
    expect(getSeededDoc("tenants", "tenant-2")).toMatchObject({
      currentLeaseId: null,
    });
  });
});
