import { describe, expect, it, vi } from "vitest";

const sampleRisk = {
  version: "risk-v1",
  score: 74,
  grade: "B",
  confidence: 0.78,
  flags: ["Income verification incomplete"],
  recommendations: ["Collect income verification to improve confidence in this assessment."],
  factors: { credit: 72, income: 70, paymentHistory: 80, employment: 75, behavior: 68 },
  inputs: {
    creditScore: 690,
    monthlyIncome: 5000,
    monthlyRent: 2100,
    employmentMonths: 10,
    onTimePaymentRatio: 0.9,
    latePayments: 1,
    coTenantCount: 1,
    hasGuarantor: false,
  },
  generatedAt: "2026-03-17T00:00:00.000Z",
} as const;

const buildLeaseRiskInput = vi.fn(async () => ({ monthlyRent: 2100, monthlyIncome: 5000 }));
const safeAssessLeaseRisk = vi.fn(async () => sampleRisk);

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      get: async () => ({ docs: [] }),
      where: () => ({ get: async () => ({ docs: [] }), where: () => ({ get: async () => ({ docs: [] }) }) }),
      doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }),
    }),
  },
}));

vi.mock("../risk/buildLeaseRiskInput", () => ({ buildLeaseRiskInput }));
vi.mock("../risk/riskEngine", () => ({ safeAssessLeaseRisk }));

function createFirestoreLike(seed: Record<string, Array<{ id: string; data: Record<string, unknown> }>>) {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  for (const [collectionName, docs] of Object.entries(seed)) {
    collections.set(collectionName, new Map(docs.map((doc) => [doc.id, { ...doc.data }])));
  }

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function queryDocs(name: string, filters: Array<{ field: string; value: unknown }>) {
    const docs = Array.from(ensureCollection(name).entries())
      .filter(([, data]) => filters.every((filter) => data?.[filter.field] === filter.value))
      .map(([id, data]) => ({ id, data: () => data }));
    return { docs };
  }

  return {
    firestore: {
      collection: (name: string) => ({
        get: async () => queryDocs(name, []),
        where: (field: string, _op: string, value: unknown) => ({
          get: async () => queryDocs(name, [{ field, value }]),
          where: (field2: string, _op2: string, value2: unknown) => ({
            get: async () => queryDocs(name, [{ field, value }, { field: field2, value: value2 }]),
          }),
        }),
        doc: (id: string) => ({
          get: async () => {
            const value = ensureCollection(name).get(id);
            return { id, exists: value !== undefined, data: () => value };
          },
          set: async (value: Record<string, unknown>, options?: { merge?: boolean }) => {
            const current = ensureCollection(name).get(id) || {};
            ensureCollection(name).set(id, options?.merge ? { ...current, ...value } : value);
          },
        }),
      }),
    },
    getDoc: (collectionName: string, id: string) => ensureCollection(collectionName).get(id),
  };
}

describe("leaseRiskBackfillService", () => {
  it("does not write in dry-run mode and only targets missing risk by default", async () => {
    const { firestore, getDoc } = createFirestoreLike({
      leases: [
        { id: "lease-1", data: { landlordId: "l1", propertyId: "p1", tenantId: "t1", status: "active" } },
        { id: "lease-2", data: { landlordId: "l1", propertyId: "p1", tenantId: "t2", status: "active", risk: {}, riskScore: 70, riskGrade: "B", riskConfidence: 0.8 } },
        { id: "lease-3", data: { landlordId: "l1", propertyId: "p1", tenantId: "t3", status: "ended" } },
      ],
    });
    const recompute = vi.fn(async (leaseId: string) => ({ leaseId, updated: false, skipped: false, wouldUpdate: true }));
    const { runLeaseRiskBackfill } = await import("../risk/leaseRiskBackfillService");

    const summary = await runLeaseRiskBackfill({ dryRun: true }, { firestore: firestore as any, recompute, todayIso: "2026-03-17" });

    expect(summary.scanned).toBe(1);
    expect(summary.updated).toBe(1);
    expect(recompute).toHaveBeenCalledTimes(1);
    expect(getDoc("leases", "lease-1")?.riskScore).toBeUndefined();
  });

  it("surfaces specific skip reasons from recompute results", async () => {
    const { firestore } = createFirestoreLike({
      leases: [
        { id: "legacy-skip-1", data: { landlordId: "l1", propertyId: "p1", tenantId: "", status: "active" } },
      ],
    });
    const recompute = vi.fn(async (leaseId: string) => ({
      leaseId,
      updated: false,
      skipped: true,
      reason: "missing_tenant_linkage",
    }));
    const { runLeaseRiskBackfill } = await import("../risk/leaseRiskBackfillService");

    const summary = await runLeaseRiskBackfill({ dryRun: true }, { firestore: firestore as any, recompute, todayIso: "2026-03-17" });

    expect(summary.skippedLeaseIds).toEqual([{ leaseId: "legacy-skip-1", reason: "missing_tenant_linkage" }]);
  });

  it("targets complete leases only when recompute-all is explicitly enabled", async () => {
    const { firestore } = createFirestoreLike({
      leases: [
        { id: "lease-1", data: { landlordId: "l1", propertyId: "p1", tenantId: "t1", status: "active", risk: {}, riskScore: 70, riskGrade: "B", riskConfidence: 0.8 } },
      ],
    });
    const recompute = vi.fn(async (leaseId: string) => ({ leaseId, updated: false, skipped: false, wouldUpdate: true }));
    const { runLeaseRiskBackfill } = await import("../risk/leaseRiskBackfillService");

    const missingOnly = await runLeaseRiskBackfill({}, { firestore: firestore as any, recompute, todayIso: "2026-03-17" });
    const recomputeAll = await runLeaseRiskBackfill({ recomputeAll: true }, { firestore: firestore as any, recompute, todayIso: "2026-03-17" });

    expect(missingOnly.scanned).toBe(0);
    expect(recomputeAll.scanned).toBe(1);
  });

  it("respects the limit option", async () => {
    const { firestore } = createFirestoreLike({
      leases: [
        { id: "lease-1", data: { landlordId: "l1", propertyId: "p1", tenantId: "t1", status: "active" } },
        { id: "lease-2", data: { landlordId: "l1", propertyId: "p1", tenantId: "t2", status: "active" } },
      ],
    });
    const recompute = vi.fn(async (leaseId: string) => ({ leaseId, updated: false, skipped: false, wouldUpdate: true }));
    const { runLeaseRiskBackfill } = await import("../risk/leaseRiskBackfillService");

    const summary = await runLeaseRiskBackfill({ limit: 1 }, { firestore: firestore as any, recompute, todayIso: "2026-03-17" });

    expect(summary.scanned).toBe(1);
    expect(recompute).toHaveBeenCalledTimes(1);
  });

  it("appends a backfill timeline entry when a historical lease receives first-time risk", async () => {
    buildLeaseRiskInput.mockReset();
    buildLeaseRiskInput.mockResolvedValue({ monthlyRent: 2100, monthlyIncome: 5000 });
    safeAssessLeaseRisk.mockReset();
    safeAssessLeaseRisk.mockResolvedValue(sampleRisk);

    const { firestore, getDoc } = createFirestoreLike({
      properties: [
        { id: "p-downtown", data: { landlordId: "landlord-legacy" } },
      ],
      leases: [
        {
          id: "legacy-lease-1",
          data: {
            source: "application-conversion",
            propertyId: "p-downtown",
            tenantId: "tenant-legacy-1",
            leaseStartDate: "2025-01-01",
            leaseEndDate: "2025-12-31",
            monthlyRent: 2100,
            securityDeposit: 2100,
            unitId: "unit-101",
            status: "active",
          },
        },
      ],
    });
    const { runLeaseRiskBackfill } = await import("../risk/leaseRiskBackfillService");

    const summary = await runLeaseRiskBackfill(
      { propertyId: "p-downtown", limit: 25 },
      { firestore: firestore as any, todayIso: "2026-03-17" }
    );

    expect(summary.processedLeaseIds).toContain("legacy-lease-1");
    expect(getDoc("leases", "legacy-lease-1")?.riskTimeline).toHaveLength(1);
    expect(getDoc("leases", "legacy-lease-1")?.riskTimeline?.[0]?.trigger).toBe("backfill");
  });
});
