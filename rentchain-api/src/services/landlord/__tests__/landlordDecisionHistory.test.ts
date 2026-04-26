import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        get: async () => {
          const docs = Array.from(ensureCollection(name).values()).map((entry) => ({
            id: entry.id,
            data: () => entry.data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
    resetDb: () => collections.clear(),
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
  };
});

vi.mock("../../../config/firebase", () => ({
  db: dbMock,
}));

describe("loadLandlordDecisionTimeline", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("returns only landlord-scoped decision timeline events in chronological order", async () => {
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "decision.reviewed",
      domain: "system",
      action: "reviewed",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "analytics_decision", id: "review_lease_renewals:prop-1" },
      occurredAt: "2026-04-22T10:00:00.000Z",
      recordedAt: "2026-04-22T10:00:00.000Z",
      visibility: "landlord",
      summary: "Analytics decision reviewed.",
      metadata: { landlordId: "landlord-1", decisionId: "review_lease_renewals:prop-1" },
    });
    seedDoc("canonicalEvents", "event-0", {
      version: "v1",
      type: "decision.appeared",
      domain: "system",
      action: "appeared",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "analytics_decision", id: "review_lease_renewals:prop-1" },
      occurredAt: "2026-04-22T09:00:00.000Z",
      recordedAt: "2026-04-22T09:00:00.000Z",
      visibility: "landlord",
      summary: "Analytics decision appeared.",
      metadata: { landlordId: "landlord-1", decisionId: "review_lease_renewals:prop-1" },
    });
    seedDoc("canonicalEvents", "event-2", {
      version: "v1",
      type: "decision.executed",
      domain: "system",
      action: "executed",
      status: "executed",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "analytics_decision", id: "review_lease_renewals:prop-1" },
      occurredAt: "2026-04-22T11:00:00.000Z",
      recordedAt: "2026-04-22T11:00:00.000Z",
      visibility: "landlord",
      summary: "Analytics decision executed.",
      metadata: { landlordId: "landlord-1", decisionId: "review_lease_renewals:prop-1" },
    });
    seedDoc("canonicalEvents", "event-ignored-tenant", {
      version: "v1",
      type: "decision.appeared",
      domain: "system",
      action: "appeared",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "analytics_decision", id: "review_lease_renewals:prop-1" },
      occurredAt: "2026-04-22T08:00:00.000Z",
      recordedAt: "2026-04-22T08:00:00.000Z",
      visibility: "tenant",
      summary: "Should be hidden.",
      metadata: { landlordId: "landlord-1", decisionId: "review_lease_renewals:prop-1" },
    });
    seedDoc("canonicalEvents", "event-ignored-other-landlord", {
      version: "v1",
      type: "decision.appeared",
      domain: "system",
      action: "appeared",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "analytics_decision", id: "review_lease_renewals:prop-1" },
      occurredAt: "2026-04-22T07:00:00.000Z",
      recordedAt: "2026-04-22T07:00:00.000Z",
      visibility: "landlord",
      summary: "Other landlord.",
      metadata: { landlordId: "landlord-2", decisionId: "review_lease_renewals:prop-1" },
    });

    const { loadLandlordDecisionTimeline } = await import("../landlordDecisionHistory");
    const result = await loadLandlordDecisionTimeline({
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
    });

    expect(result.map((item) => item.title)).toEqual(["Appeared", "Reviewed", "Executed"]);
    expect(result[0]).toEqual(
      expect.objectContaining({
        title: "Appeared",
        timestamp: "2026-04-22T09:00:00.000Z",
      })
    );
    expect(result[2]).toEqual(
      expect.objectContaining({
        title: "Executed",
        status: "executed",
      })
    );
  });
});
