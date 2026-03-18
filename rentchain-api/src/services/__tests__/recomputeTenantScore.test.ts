import { beforeEach, describe, expect, it, vi } from "vitest";

const scoreFactory = (overrides: Record<string, any> = {}) => ({
  version: "tenant-score-v1",
  score: 78,
  grade: "B",
  confidence: 0.82,
  factors: { leaseRisk: 80, paymentBehavior: 76, stability: 70, historyDepth: 68 },
  signals: ["strong_recent_lease_profile"],
  recommendations: ["Continue monitoring lease and payment signals as new history is recorded."],
  derivedFrom: {
    activeLeaseCount: 1,
    completedLeaseCount: 1,
    latestLeaseRiskScore: 80,
    averageLeaseRiskScore: 75,
    onTimePaymentRatio: 0.9,
  },
  generatedAt: "2026-03-18T00:00:00.000Z",
  ...overrides,
});

const { fakeDb, resetStore, seedDoc, getTenantData } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }
  function matchesWhere(doc: any, where: { field: string; op: string; value: any }) {
    const fieldValue = doc?.[where.field];
    if (where.op === "==") return fieldValue === where.value;
    if (where.op === "array-contains") return Array.isArray(fieldValue) && fieldValue.includes(where.value);
    return false;
  }
  function buildQuery(name: string, wheres: Array<{ field: string; op: string; value: any }> = [], limitValue?: number) {
    return {
      where: (field: string, op: string, value: any) => buildQuery(name, [...wheres, { field, op, value }], limitValue),
      limit: (value: number) => buildQuery(name, wheres, value),
      get: async () => {
        let docs = Array.from(ensureCollection(name).entries())
          .map(([id, data]) => ({ id, data: () => data }))
          .filter((doc) => wheres.every((where) => matchesWhere(doc.data(), where)));
        if (typeof limitValue === "number") docs = docs.slice(0, limitValue);
        return { docs };
      },
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
    };
  }

  return {
    resetStore: () => store.clear(),
    seedDoc: (collectionName: string, id: string, data: any) => ensureCollection(collectionName).set(id, data),
    getTenantData: (id: string) => ensureCollection("tenants").get(id),
    fakeDb: {
      collection: (name: string) => buildQuery(name),
    },
  };
});

const listLedgerEventsV2 = vi.fn(async () => ({ items: [] }));
const computeTenantScore = vi.fn(() => scoreFactory());

vi.mock("../../config/firebase", () => ({ db: fakeDb }));
vi.mock("../ledgerEventsFirestoreService", () => ({ listLedgerEventsV2 }));
vi.mock("../risk/computeTenantScore", () => ({ computeTenantScore }));

describe("recomputeTenantScore", () => {
  beforeEach(() => {
    resetStore();
    listLedgerEventsV2.mockReset();
    listLedgerEventsV2.mockResolvedValue({ items: [] });
    computeTenantScore.mockReset();
    computeTenantScore.mockReturnValue(scoreFactory());
  });

  it("updates tenant score fields and appends a tenant timeline entry", async () => {
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Tenant One" });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      propertyId: "property-1",
      status: "active",
      riskScore: 80,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    seedDoc("payments", "payment-1", { tenantId: "tenant-1" });
    const { recomputeTenantScore } = await import("../risk/recomputeTenantScore");

    const result = await recomputeTenantScore("tenant-1");

    expect(result.updated).toBe(true);
    expect(result.nextScore).toBe(78);
    expect(getTenantData("tenant-1")?.tenantScoreValue).toBe(78);
    expect(getTenantData("tenant-1")?.tenantScoreGrade).toBe("B");
    expect(getTenantData("tenant-1")?.tenantScoreTimeline).toHaveLength(1);
    expect(getTenantData("tenant-1")?.tenantScoreTimeline?.[0]?.trigger).toBe("tenant_recompute");
  });

  it("skips safely when the tenant does not exist", async () => {
    const { recomputeTenantScore } = await import("../risk/recomputeTenantScore");

    const result = await recomputeTenantScore("missing-tenant");

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("tenant_not_found");
  });

  it("skips safely when no linked leases exist", async () => {
    seedDoc("tenants", "tenant-2", { landlordId: "landlord-1", fullName: "Tenant Two" });
    const { recomputeTenantScore } = await import("../risk/recomputeTenantScore");

    const result = await recomputeTenantScore("tenant-2");

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_linked_leases");
  });

  it("does not append duplicate timeline entries when the score is unchanged", async () => {
    const existingScore = scoreFactory();
    seedDoc("tenants", "tenant-3", {
      landlordId: "landlord-1",
      fullName: "Tenant Three",
      tenantScore: existingScore,
      tenantScoreValue: existingScore.score,
      tenantScoreGrade: existingScore.grade,
      tenantScoreConfidence: existingScore.confidence,
      tenantScoreTimeline: [
        {
          generatedAt: existingScore.generatedAt,
          version: existingScore.version,
          score: existingScore.score,
          grade: existingScore.grade,
          confidence: existingScore.confidence,
          trigger: "tenant_recompute",
          source: null,
          signals: existingScore.signals,
        },
      ],
    });
    seedDoc("leases", "lease-3", {
      landlordId: "landlord-1",
      tenantId: "tenant-3",
      tenantIds: ["tenant-3"],
      propertyId: "property-1",
      status: "active",
      riskScore: 80,
    });
    const { recomputeTenantScore } = await import("../risk/recomputeTenantScore");

    const result = await recomputeTenantScore("tenant-3");

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("tenant_score_unchanged");
    expect(getTenantData("tenant-3")?.tenantScoreTimeline).toHaveLength(1);
  });

  it("respects dry-run mode without writing tenant score fields", async () => {
    seedDoc("tenants", "tenant-4", { landlordId: "landlord-1", fullName: "Tenant Four" });
    seedDoc("leases", "lease-4", {
      landlordId: "landlord-1",
      tenantId: "tenant-4",
      tenantIds: ["tenant-4"],
      propertyId: "property-1",
      status: "active",
      riskScore: 70,
    });
    const { recomputeTenantScore } = await import("../risk/recomputeTenantScore");

    const result = await recomputeTenantScore("tenant-4", { dryRun: true, trigger: "backfill", source: "tenant_score_backfill" });

    expect(result.wouldUpdate).toBe(true);
    expect(getTenantData("tenant-4")?.tenantScore).toBeUndefined();
  });
});
