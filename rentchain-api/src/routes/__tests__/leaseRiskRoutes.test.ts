import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leaseService } from "../../services/leaseService";

const sampleRisk = {
  version: "risk-v1",
  score: 78,
  grade: "B",
  confidence: 0.82,
  flags: ["High rent-to-income ratio"],
  recommendations: ["Verify income documentation before relying on listed rent coverage."],
  factors: { credit: 80, income: 65, paymentHistory: 82, employment: 78, behavior: 70 },
  inputs: {
    creditScore: 710,
    monthlyIncome: 4800,
    monthlyRent: 1900,
    employmentMonths: 14,
    onTimePaymentRatio: 0.91,
    latePayments: 1,
    coTenantCount: 1,
    hasGuarantor: false,
  },
  generatedAt: "2026-03-16T00:00:00.000Z",
} as const;

type DocShape = { id: string; data: any };

const { store, fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, DocShape>>();
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
    store,
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

const buildLeaseRiskInput = vi.fn(async () => ({ monthlyRent: 1900, monthlyIncome: 4800 }));
const safeAssessLeaseRisk = vi.fn(async () => sampleRisk);

vi.mock("../../config/firebase", () => ({
  db: fakeDb,
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

vi.mock("../../services/risk/buildLeaseRiskInput", () => ({
  buildLeaseRiskInput,
}));

vi.mock("../../services/risk/riskEngine", () => ({
  safeAssessLeaseRisk,
}));

describe("lease route risk integration", () => {
  beforeEach(() => {
    resetFakeDb();
    leaseService.getAll().splice(0);
    buildLeaseRiskInput.mockReset();
    buildLeaseRiskInput.mockResolvedValue({ monthlyRent: 1900, monthlyIncome: 4800 });
    safeAssessLeaseRisk.mockReset();
    safeAssessLeaseRisk.mockResolvedValue(sampleRisk);
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

  it("returns and stores a first risk timeline entry on direct lease create", async () => {
    const app = await makeApp();

    const res = await request(app).post("/").send({
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitNumber: "unit-1",
      monthlyRent: 1900,
      startDate: "2026-04-01",
    });

    expect(res.status).toBe(201);
    expect(res.body.lease.risk.grade).toBe("B");
    expect(res.body.lease.riskScore).toBe(78);
    expect(res.body.lease.riskTimeline).toHaveLength(1);
    expect(res.body.lease.riskTimeline[0].trigger).toBe("lease_create");
    expect(buildLeaseRiskInput).toHaveBeenCalled();
  });

  it("stores and returns a first risk timeline entry when activating a draft lease", async () => {
    seedDoc("leaseDrafts", "draft-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      tenantIds: ["tenant-1"],
      province: "NS",
      termType: "fixed",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      baseRentCents: 190000,
      dueDay: 1,
      paymentMethod: "etransfer",
      templateVersion: "ns-schedule-a-v1",
    });
    const app = await makeApp();

    const res = await request(app).post("/drafts/draft-1/activate").send({});

    expect(res.status).toBe(200);
    expect(res.body.lease.risk.grade).toBe("B");
    expect(res.body.lease.riskTimeline).toHaveLength(1);
    expect(res.body.lease.riskTimeline[0].trigger).toBe("draft_activate");
    const leaseDoc = store.get("leases")?.get(String(res.body.leaseId));
    expect(leaseDoc?.data?.riskScore).toBe(78);
    expect(leaseDoc?.data?.risk?.version).toBe("risk-v1");
    expect(leaseDoc?.data?.riskTimeline?.[0]?.trigger).toBe("draft_activate");
  });

  it("keeps lease creation fail-open when risk input building throws", async () => {
    buildLeaseRiskInput.mockRejectedValueOnce(new Error("risk input unavailable"));
    const app = await makeApp();

    const res = await request(app).post("/").send({
      tenantId: "tenant-2",
      propertyId: "prop-1",
      unitNumber: "unit-2",
      monthlyRent: 1750,
      startDate: "2026-05-01",
    });

    expect(res.status).toBe(201);
    expect(res.body.lease.risk ?? null).toBeNull();
    expect(res.body.lease.riskTimeline).toEqual([]);
  });
});
