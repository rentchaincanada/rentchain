import { beforeEach, describe, expect, it, vi } from "vitest";

const sampleRisk = {
  version: "risk-v1",
  score: 81,
  grade: "B",
  confidence: 0.84,
  flags: ["Income verification incomplete"],
  recommendations: ["Collect income verification to improve confidence in this assessment."],
  factors: { credit: 80, income: 76, paymentHistory: 82, employment: 79, behavior: 70 },
  inputs: {
    creditScore: 705,
    monthlyIncome: 5200,
    monthlyRent: 1850,
    employmentMonths: 14,
    onTimePaymentRatio: 0.92,
    latePayments: 1,
    coTenantCount: 1,
    hasGuarantor: false,
  },
  generatedAt: "2026-03-17T00:00:00.000Z",
} as const;

const changedRisk = {
  ...sampleRisk,
  score: 68,
  grade: "C",
  confidence: 0.79,
  generatedAt: "2026-03-18T00:00:00.000Z",
} as const;

const { fakeDb, resetStore, seedLease, seedDoc, getLeaseData } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }
  return {
    resetStore: () => store.clear(),
    seedLease: (id: string, data: any) => ensureCollection("leases").set(id, data),
    seedDoc: (collectionName: string, id: string, data: any) => ensureCollection(collectionName).set(id, data),
    getLeaseData: (id: string) => ensureCollection("leases").get(id),
    fakeDb: {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => {
            const value = ensureCollection(name).get(id);
            return { id, exists: value !== undefined, data: () => value };
          },
          set: async (value: any, options?: { merge?: boolean }) => {
            const current = ensureCollection(name).get(id) || {};
            ensureCollection(name).set(id, options?.merge ? { ...current, ...value } : value);
          },
        }),
      }),
    },
  };
});

const buildLeaseRiskInput = vi.fn(async () => ({ monthlyRent: 1850, monthlyIncome: 5200 }));
const safeAssessLeaseRisk = vi.fn(async () => sampleRisk);
const recomputeTenantScore = vi.fn(async (tenantId: string) => ({
  tenantId,
  updated: true,
  skipped: false,
  previousScore: 66,
  nextScore: 82,
  previousGrade: "C",
  nextGrade: "B",
  generatedAt: "2026-03-18T00:00:00.000Z",
}));

vi.mock("../../config/firebase", () => ({ db: fakeDb }));
vi.mock("../risk/buildLeaseRiskInput", () => ({ buildLeaseRiskInput }));
vi.mock("../risk/riskEngine", () => ({ safeAssessLeaseRisk }));
vi.mock("../risk/recomputeTenantScore", () => ({ recomputeTenantScore }));

describe("recomputeLeaseRisk", () => {
  beforeEach(() => {
    resetStore();
    buildLeaseRiskInput.mockReset();
    buildLeaseRiskInput.mockResolvedValue({ monthlyRent: 1850, monthlyIncome: 5200 });
    safeAssessLeaseRisk.mockReset();
    safeAssessLeaseRisk.mockResolvedValue(sampleRisk);
    recomputeTenantScore.mockReset();
    recomputeTenantScore.mockImplementation(async (tenantId: string) => ({
      tenantId,
      updated: true,
      skipped: false,
      previousScore: 66,
      nextScore: 82,
      previousGrade: "C",
      nextGrade: "B",
      generatedAt: "2026-03-18T00:00:00.000Z",
    }));
  });

  it("updates a lease with fresh risk fields and appends a recompute timeline entry", async () => {
    seedLease("lease-1", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      tenantId: "tenant-1",
      monthlyRent: 1850,
      status: "active",
    });
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("lease-1");

    expect(result.updated).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.nextRiskScore).toBe(81);
    expect(result.linkedTenantScoreAttempted).toBe(false);
    expect(result.linkedTenantResults).toEqual([]);
    expect(recomputeTenantScore).not.toHaveBeenCalled();
    expect(getLeaseData("lease-1")?.riskScore).toBe(81);
    expect(getLeaseData("lease-1")?.risk?.version).toBe("risk-v1");
    expect(getLeaseData("lease-1")?.riskTimeline).toHaveLength(1);
    expect(getLeaseData("lease-1")?.riskTimeline?.[0]?.trigger).toBe("recompute");
  });

  it("recomputes linked tenant scores only once per deduplicated tenant id when explicitly enabled", async () => {
    seedLease("lease-linked", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      tenantId: "tenant-2",
      tenantIds: ["tenant-1", "tenant-2", "", "tenant-1", "  tenant-3  "],
      monthlyRent: 1850,
      status: "active",
    });
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("lease-linked", { recomputeLinkedTenantScores: true });

    expect(result.updated).toBe(true);
    expect(result.linkedTenantScoreAttempted).toBe(true);
    expect(result.linkedTenantScoreReason).toBeUndefined();
    expect(result.linkedTenantResults?.map((entry) => entry.tenantId)).toEqual([
      "tenant-1",
      "tenant-2",
      "tenant-3",
    ]);
    expect(recomputeTenantScore).toHaveBeenCalledTimes(3);
    expect(recomputeTenantScore).toHaveBeenNthCalledWith(
      1,
      "tenant-1",
      expect.objectContaining({ trigger: "lease_recompute", source: "lease_risk_recompute" })
    );
    expect(recomputeTenantScore).toHaveBeenNthCalledWith(
      2,
      "tenant-2",
      expect.objectContaining({ trigger: "lease_recompute", source: "lease_risk_recompute" })
    );
    expect(recomputeTenantScore).toHaveBeenNthCalledWith(
      3,
      "tenant-3",
      expect.objectContaining({ trigger: "lease_recompute", source: "lease_risk_recompute" })
    );
  });

  it("returns no_linked_tenants when opt-in is enabled but the lease has no valid tenant ids", async () => {
    seedLease("lease-no-tenants", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      tenantId: "   ",
      tenantIds: ["", "   "],
      monthlyRent: 1850,
      status: "active",
    });
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("lease-no-tenants", { recomputeLinkedTenantScores: true });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("missing_tenant_linkage");
    expect(recomputeTenantScore).not.toHaveBeenCalled();
  });

  it("isolates linked tenant recompute failures from the main lease recompute", async () => {
    seedLease("lease-failure", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      tenantIds: ["tenant-1", "tenant-2"],
      monthlyRent: 1850,
      status: "active",
    });
    recomputeTenantScore.mockImplementation(async (tenantId: string) => {
      if (tenantId === "tenant-2") {
        throw new Error("tenant recompute exploded");
      }
      return {
        tenantId,
        updated: true,
        skipped: false,
        previousScore: 66,
        nextScore: 82,
        previousGrade: "C",
        nextGrade: "B",
        generatedAt: "2026-03-18T00:00:00.000Z",
      };
    });
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("lease-failure", { recomputeLinkedTenantScores: true });

    expect(result.updated).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.linkedTenantScoreAttempted).toBe(true);
    expect(result.linkedTenantResults).toEqual([
      expect.objectContaining({ tenantId: "tenant-1", updated: true, skipped: false }),
      expect.objectContaining({
        tenantId: "tenant-2",
        updated: false,
        skipped: true,
        reason: "linked_tenant_recompute_failed",
        error: "tenant recompute exploded",
      }),
    ]);
    expect(getLeaseData("lease-failure")?.riskScore).toBe(81);
  });

  it("recomputes legacy application-conversion leases using safe field fallbacks", async () => {
    seedDoc("properties", "p-downtown", { landlordId: "landlord-legacy" });
    seedLease("legacy-lease-1", {
      source: "application-conversion",
      propertyId: "p-downtown",
      tenantId: "tenant-legacy-1",
      leaseStartDate: "2025-01-01",
      leaseEndDate: "2025-12-31",
      monthlyRent: 2100,
      unitId: "unit-101",
      status: "active",
    });
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("legacy-lease-1");

    expect(result.updated).toBe(true);
    expect(buildLeaseRiskInput).toHaveBeenCalledWith(
      expect.objectContaining({
        landlordId: "landlord-legacy",
        propertyId: "p-downtown",
        tenantIds: ["tenant-legacy-1"],
        unitId: "unit-101",
        monthlyRent: 2100,
      })
    );
    expect(getLeaseData("legacy-lease-1")?.riskTimeline?.[0]?.trigger).toBe("recompute");
  });

  it("repairs missing denormalized risk fields and appends a first timeline entry when absent", async () => {
    seedLease("lease-denorm", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      tenantId: "tenant-1",
      monthlyRent: 1850,
      status: "active",
      risk: sampleRisk,
    });
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("lease-denorm");

    expect(result.updated).toBe(true);
    expect(getLeaseData("lease-denorm")?.riskScore).toBe(81);
    expect(getLeaseData("lease-denorm")?.riskGrade).toBe("B");
    expect(getLeaseData("lease-denorm")?.riskConfidence).toBe(0.84);
    expect(getLeaseData("lease-denorm")?.riskTimeline).toHaveLength(1);
  });

  it("appends a new timeline entry when recompute meaningfully changes the score", async () => {
    seedLease("lease-changed", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      tenantId: "tenant-1",
      monthlyRent: 1850,
      status: "active",
      risk: sampleRisk,
      riskScore: sampleRisk.score,
      riskGrade: sampleRisk.grade,
      riskConfidence: sampleRisk.confidence,
      riskTimeline: [
        {
          generatedAt: sampleRisk.generatedAt,
          version: sampleRisk.version,
          score: sampleRisk.score,
          grade: sampleRisk.grade,
          confidence: sampleRisk.confidence,
          trigger: "lease_create",
          source: "lease_create_route",
          flags: sampleRisk.flags,
          recommendations: sampleRisk.recommendations,
        },
      ],
    });
    safeAssessLeaseRisk.mockResolvedValueOnce(changedRisk as any);
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("lease-changed");

    expect(result.updated).toBe(true);
    expect(getLeaseData("lease-changed")?.riskTimeline).toHaveLength(2);
    expect(getLeaseData("lease-changed")?.riskTimeline?.[1]?.trigger).toBe("recompute");
    expect(getLeaseData("lease-changed")?.riskTimeline?.[1]?.score).toBe(68);
  });

  it("does not append a duplicate timeline entry when recompute is unchanged", async () => {
    seedLease("lease-unchanged", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      tenantId: "tenant-1",
      monthlyRent: 1850,
      status: "active",
      risk: sampleRisk,
      riskScore: sampleRisk.score,
      riskGrade: sampleRisk.grade,
      riskConfidence: sampleRisk.confidence,
      riskTimeline: [
        {
          generatedAt: sampleRisk.generatedAt,
          version: sampleRisk.version,
          score: sampleRisk.score,
          grade: sampleRisk.grade,
          confidence: sampleRisk.confidence,
          trigger: "lease_create",
          source: "lease_create_route",
          flags: sampleRisk.flags,
          recommendations: sampleRisk.recommendations,
        },
      ],
    });
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("lease-unchanged");

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("risk_snapshot_unchanged");
    expect(getLeaseData("lease-unchanged")?.riskTimeline).toHaveLength(1);
    expect(recomputeTenantScore).not.toHaveBeenCalled();
  });

  it("emits missing_landlord_context when legacy landlord data cannot be resolved", async () => {
    seedLease("legacy-missing-landlord", {
      source: "application-conversion",
      propertyId: "p-downtown",
      tenantId: "tenant-legacy-2",
      leaseStartDate: "2025-01-01",
      monthlyRent: 2100,
      unitId: "unit-102",
      status: "active",
    });
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("legacy-missing-landlord");

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("missing_landlord_context");
  });

  it("emits property_lookup_failed when the legacy property lookup throws", async () => {
    const failingFirestore = {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => {
            if (name === "leases") {
              if (id === "legacy-property-failure") {
                return {
                  id,
                  exists: true,
                  data: () => ({
                    source: "application-conversion",
                    propertyId: "p-downtown",
                    tenantId: "tenant-legacy-3",
                    leaseStartDate: "2025-01-01",
                    monthlyRent: 2100,
                    unitId: "unit-103",
                    status: "active",
                  }),
                };
              }
              return { id, exists: false, data: () => undefined };
            }
            throw new Error("property read failed");
          },
          set: async () => undefined,
        }),
      }),
    };
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("legacy-property-failure", { firestore: failingFirestore as any });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("property_lookup_failed");
  });

  it("skips safely when the lease is not found", async () => {
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("missing-lease");

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("lease_not_found");
  });

  it("skips safely when the lease is missing required context", async () => {
    seedLease("lease-2", {
      source: "application-conversion",
      propertyId: "property-1",
      tenantId: "",
      leaseStartDate: "2025-01-01",
      monthlyRent: 1850,
      status: "active",
    });
    const { recomputeLeaseRisk } = await import("../risk/recomputeLeaseRisk");

    const result = await recomputeLeaseRisk("lease-2");

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("missing_tenant_linkage");
  });
});
