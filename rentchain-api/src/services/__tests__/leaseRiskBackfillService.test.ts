import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      get: async () => ({ docs: [] }),
      where: () => ({ get: async () => ({ docs: [] }), where: () => ({ get: async () => ({ docs: [] }) }) }),
      doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }),
    }),
  },
}));

function createFirestoreLike(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const store = new Map(docs.map((doc) => [doc.id, { ...doc.data }]));
  return {
    store,
    firestore: {
      collection: () => ({
        where: () => ({
          where: () => ({
            get: async () => ({ docs: Array.from(store.entries()).map(([id, data]) => ({ id, data: () => data })) }),
          }),
          get: async () => ({ docs: Array.from(store.entries()).map(([id, data]) => ({ id, data: () => data })) }),
        }),
        get: async () => ({ docs: Array.from(store.entries()).map(([id, data]) => ({ id, data: () => data })) }),
        doc: (id: string) => ({
          get: async () => {
            const value = store.get(id);
            return { id, exists: value !== undefined, data: () => value };
          },
        }),
      }),
    },
  };
}

describe("leaseRiskBackfillService", () => {
  it("does not write in dry-run mode and only targets missing risk by default", async () => {
    const { firestore, store } = createFirestoreLike([
      { id: "lease-1", data: { landlordId: "l1", propertyId: "p1", tenantId: "t1", status: "active" } },
      { id: "lease-2", data: { landlordId: "l1", propertyId: "p1", tenantId: "t2", status: "active", risk: {}, riskScore: 70, riskGrade: "B", riskConfidence: 0.8 } },
      { id: "lease-3", data: { landlordId: "l1", propertyId: "p1", tenantId: "t3", status: "ended" } },
    ]);
    const recompute = vi.fn(async (leaseId: string) => ({ leaseId, updated: false, skipped: false, wouldUpdate: true }));
    const { runLeaseRiskBackfill } = await import("../risk/leaseRiskBackfillService");

    const summary = await runLeaseRiskBackfill({ dryRun: true }, { firestore: firestore as any, recompute, todayIso: "2026-03-17" });

    expect(summary.scanned).toBe(1);
    expect(summary.updated).toBe(1);
    expect(recompute).toHaveBeenCalledTimes(1);
    expect(store.get("lease-1")?.riskScore).toBeUndefined();
  });

  it("targets complete leases only when recompute-all is explicitly enabled", async () => {
    const { firestore } = createFirestoreLike([
      { id: "lease-1", data: { landlordId: "l1", propertyId: "p1", tenantId: "t1", status: "active", risk: {}, riskScore: 70, riskGrade: "B", riskConfidence: 0.8 } },
    ]);
    const recompute = vi.fn(async (leaseId: string) => ({ leaseId, updated: false, skipped: false, wouldUpdate: true }));
    const { runLeaseRiskBackfill } = await import("../risk/leaseRiskBackfillService");

    const missingOnly = await runLeaseRiskBackfill({}, { firestore: firestore as any, recompute, todayIso: "2026-03-17" });
    const recomputeAll = await runLeaseRiskBackfill({ recomputeAll: true }, { firestore: firestore as any, recompute, todayIso: "2026-03-17" });

    expect(missingOnly.scanned).toBe(0);
    expect(recomputeAll.scanned).toBe(1);
  });

  it("respects the limit option", async () => {
    const { firestore } = createFirestoreLike([
      { id: "lease-1", data: { landlordId: "l1", propertyId: "p1", tenantId: "t1", status: "active" } },
      { id: "lease-2", data: { landlordId: "l1", propertyId: "p1", tenantId: "t2", status: "active" } },
    ]);
    const recompute = vi.fn(async (leaseId: string) => ({ leaseId, updated: false, skipped: false, wouldUpdate: true }));
    const { runLeaseRiskBackfill } = await import("../risk/leaseRiskBackfillService");

    const summary = await runLeaseRiskBackfill({ limit: 1 }, { firestore: firestore as any, recompute, todayIso: "2026-03-17" });

    expect(summary.scanned).toBe(1);
    expect(recompute).toHaveBeenCalledTimes(1);
  });
});
