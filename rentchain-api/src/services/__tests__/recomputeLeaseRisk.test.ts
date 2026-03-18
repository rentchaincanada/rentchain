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

vi.mock("../../config/firebase", () => ({ db: fakeDb }));
vi.mock("../risk/buildLeaseRiskInput", () => ({ buildLeaseRiskInput }));
vi.mock("../risk/riskEngine", () => ({ safeAssessLeaseRisk }));

describe("recomputeLeaseRisk", () => {
  beforeEach(() => {
    resetStore();
    buildLeaseRiskInput.mockReset();
    buildLeaseRiskInput.mockResolvedValue({ monthlyRent: 1850, monthlyIncome: 5200 });
    safeAssessLeaseRisk.mockReset();
    safeAssessLeaseRisk.mockResolvedValue(sampleRisk);
  });

  it("updates a lease with fresh risk fields", async () => {
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
    expect(getLeaseData("lease-1")?.riskScore).toBe(81);
    expect(getLeaseData("lease-1")?.risk?.version).toBe("risk-v1");
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
  });
  it("repairs missing denormalized risk fields when a risk snapshot already exists", async () => {
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



