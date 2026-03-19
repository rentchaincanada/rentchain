import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetStore, seedDoc } = vi.hoisted(() => {
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
      }),
    };
  }
  return {
    resetStore: () => store.clear(),
    seedDoc: (collectionName: string, id: string, data: any) => ensureCollection(collectionName).set(id, data),
    fakeDb: { collection: (name: string) => buildQuery(name) },
  };
});

vi.mock("../../config/firebase", () => ({ db: fakeDb }));

describe("tenantScoreBackfillService", () => {
  beforeEach(() => {
    resetStore();
  });

  it("targets tenants missing score fields by default without writing in dry-run mode", async () => {
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Tenant 1" });
    seedDoc("tenants", "tenant-2", {
      landlordId: "landlord-1",
      fullName: "Tenant 2",
      tenantScore: { score: 80, grade: "B", confidence: 0.8, version: "tenant-score-v1", generatedAt: "2026-03-18T00:00:00.000Z", factors: {}, signals: [], recommendations: [], derivedFrom: {} },
      tenantScoreValue: 80,
      tenantScoreGrade: "B",
      tenantScoreConfidence: 0.8,
      tenantScoreTimeline: [{ generatedAt: "2026-03-18T00:00:00.000Z", version: "tenant-score-v1", score: 80, grade: "B", confidence: 0.8, trigger: "tenant_recompute", signals: [] }],
    });
    const recompute = vi.fn(async (tenantId: string) => ({
      tenantId,
      updated: false,
      skipped: false,
      wouldUpdate: true,
      previousScore: null,
      nextScore: 76,
      previousGrade: null,
      nextGrade: "B",
    }));
    const { runTenantScoreBackfill } = await import("../risk/tenantScoreBackfillService");

    const result = await runTenantScoreBackfill({ dryRun: true }, { firestore: fakeDb as any, recompute: recompute as any });

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.processedTenantIds).toEqual(["tenant-1"]);
    expect(recompute).toHaveBeenCalledTimes(1);
    expect(recompute).toHaveBeenCalledWith("tenant-1", expect.objectContaining({ dryRun: true, trigger: "backfill" }));
  });

  it("repairs tenants with score objects but missing timeline under only-missing mode", async () => {
    seedDoc("tenants", "tenant-3", {
      landlordId: "landlord-1",
      fullName: "Tenant 3",
      tenantScore: { score: 71, grade: "B", confidence: 0.77, version: "tenant-score-v1", generatedAt: "2026-03-18T00:00:00.000Z", factors: {}, signals: [], recommendations: [], derivedFrom: {} },
      tenantScoreValue: 71,
      tenantScoreGrade: "B",
      tenantScoreConfidence: 0.77,
    });
    const recompute = vi.fn(async (tenantId: string) => ({
      tenantId,
      updated: true,
      skipped: false,
      previousScore: 71,
      nextScore: 71,
      previousGrade: "B",
      nextGrade: "B",
    }));
    const { runTenantScoreBackfill } = await import("../risk/tenantScoreBackfillService");

    const result = await runTenantScoreBackfill({}, { firestore: fakeDb as any, recompute: recompute as any });

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.processedTenantIds).toEqual(["tenant-3"]);
  });

  it("only recomputes all tenants when recompute-all is explicitly enabled", async () => {
    seedDoc("tenants", "tenant-4", {
      landlordId: "landlord-1",
      fullName: "Tenant 4",
      tenantScore: { score: 88, grade: "A", confidence: 0.9, version: "tenant-score-v1", generatedAt: "2026-03-18T00:00:00.000Z", factors: {}, signals: [], recommendations: [], derivedFrom: {} },
      tenantScoreValue: 88,
      tenantScoreGrade: "A",
      tenantScoreConfidence: 0.9,
      tenantScoreTimeline: [{ generatedAt: "2026-03-18T00:00:00.000Z", version: "tenant-score-v1", score: 88, grade: "A", confidence: 0.9, trigger: "tenant_recompute", signals: [] }],
    });
    const recompute = vi.fn(async (tenantId: string) => ({ tenantId, updated: true, skipped: false }));
    const { runTenantScoreBackfill } = await import("../risk/tenantScoreBackfillService");

    const skippedByDefault = await runTenantScoreBackfill({}, { firestore: fakeDb as any, recompute: recompute as any });
    const recomputedAll = await runTenantScoreBackfill({ recomputeAll: true }, { firestore: fakeDb as any, recompute: recompute as any });

    expect(skippedByDefault.scanned).toBe(0);
    expect(recomputedAll.scanned).toBe(1);
    expect(recomputedAll.updated).toBe(1);
  });

  it("respects limit and start-after", async () => {
    seedDoc("tenants", "tenant-5", { landlordId: "landlord-1" });
    seedDoc("tenants", "tenant-6", { landlordId: "landlord-1" });
    seedDoc("tenants", "tenant-7", { landlordId: "landlord-1" });
    const recompute = vi.fn(async (tenantId: string) => ({ tenantId, updated: false, skipped: true, reason: "tenant_score_unchanged" }));
    const { runTenantScoreBackfill } = await import("../risk/tenantScoreBackfillService");

    const result = await runTenantScoreBackfill({ startAfter: "tenant-5", limit: 1 }, { firestore: fakeDb as any, recompute: recompute as any });

    expect(result.scanned).toBe(1);
    expect(recompute).toHaveBeenCalledWith("tenant-6", expect.anything());
  });

  it("supports property and landlord targeting with deterministic deduplication", async () => {
    seedDoc("tenants", "tenant-8", { landlordId: "landlord-1" });
    seedDoc("tenants", "tenant-9", { landlordId: "landlord-2" });
    seedDoc("leases", "lease-8a", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      tenantId: "tenant-8",
      tenantIds: ["tenant-8"],
    });
    seedDoc("leases", "lease-8b", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      tenantIds: ["tenant-8"],
    });
    seedDoc("leases", "lease-9", {
      landlordId: "landlord-2",
      propertyId: "property-1",
      tenantId: "tenant-9",
      tenantIds: ["tenant-9"],
    });
    const recompute = vi.fn(async (tenantId: string) => ({ tenantId, updated: false, skipped: false, wouldUpdate: true }));
    const { runTenantScoreBackfill } = await import("../risk/tenantScoreBackfillService");

    const result = await runTenantScoreBackfill(
      { dryRun: true, propertyId: "property-1", landlordId: "landlord-1" },
      { firestore: fakeDb as any, recompute: recompute as any }
    );

    expect(result.scanned).toBe(1);
    expect(result.processedTenantIds).toEqual(["tenant-8"]);
    expect(recompute).toHaveBeenCalledTimes(1);
  });
});
