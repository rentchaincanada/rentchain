import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc, readDoc } = vi.hoisted(() => {
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
        doc: (id: string) => ({
          id,
          get: async () => {
            const entry = ensureCollection(name).get(id);
            return {
              id,
              exists: Boolean(entry),
              data: () => entry?.data,
            };
          },
          set: async (data: any) => {
            ensureCollection(name).set(id, { id, data });
          },
        }),
      }),
    },
    resetDb: () => {
      collections.clear();
    },
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
    readDoc: (collection: string, id: string) => ensureCollection(collection).get(id)?.data || null,
  };
});

vi.mock("../../../config/firebase", () => ({
  db: dbMock,
}));

describe("landlordDecisionStates", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("loads only landlord-scoped decision state records and merges them onto visible decisions", async () => {
    seedDoc("landlordDecisionStates", "landlord-1__reduce_vacancy_risk:prop-1", {
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-1",
      state: "reviewed",
      reviewedAt: "2026-04-21T11:00:00.000Z",
      createdAt: "2026-04-21T11:00:00.000Z",
      updatedAt: "2026-04-21T11:00:00.000Z",
    });
    seedDoc("landlordDecisionStates", "landlord-2__reduce_vacancy_risk:prop-2", {
      landlordId: "landlord-2",
      decisionId: "reduce_vacancy_risk:prop-2",
      state: "reviewed",
      reviewedAt: "2026-04-21T10:00:00.000Z",
      createdAt: "2026-04-21T10:00:00.000Z",
      updatedAt: "2026-04-21T10:00:00.000Z",
    });

    const { loadLandlordDecisionStates, mergeLandlordDecisionStates } = await import("../landlordDecisionStates");
    const states = await loadLandlordDecisionStates("landlord-1");

    expect(states).toHaveLength(1);
    const merged = mergeLandlordDecisionStates(
      [
        {
          id: "reduce_vacancy_risk:prop-1",
          decisionType: "reduce_vacancy_risk",
          priority: "high",
          explanation: "Vacancy pressure is high.",
          supportingSignals: [],
          recommendedAction: "View property analytics",
          href: "/analytics?propertyId=prop-1",
          state: "pending",
          reviewedAt: null,
        },
      ],
      states
    );

    expect(merged[0]).toEqual(
      expect.objectContaining({
        state: "reviewed",
        reviewedAt: "2026-04-21T11:00:00.000Z",
      })
    );
  });

  it("persists reviewed state records idempotently for landlord decision ids", async () => {
    const { saveReviewedLandlordDecisionState } = await import("../landlordDecisionStates");

    const first = await saveReviewedLandlordDecisionState({
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
    });
    const second = await saveReviewedLandlordDecisionState({
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
    });

    expect(first.state).toBe("reviewed");
    expect(second.reviewedAt).toBe(first.reviewedAt);
    expect(
      readDoc("landlordDecisionStates", "landlord-1__review_lease_renewals:prop-1")
    ).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        decisionId: "review_lease_renewals:prop-1",
        state: "reviewed",
      })
    );
  });
});
