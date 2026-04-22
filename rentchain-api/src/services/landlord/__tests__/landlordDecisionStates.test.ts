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
          actionKey: "open_vacancy_readiness_flow",
          actionLabel: "Open vacancy readiness",
          destination: "/analytics?propertyId=prop-1",
          workflowCategory: "vacancy_readiness",
          automationEligible: false,
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

  it("filters dismissed and future snoozed decisions, then restores expired snoozes as pending", async () => {
    seedDoc("landlordDecisionStates", "landlord-1__reduce_vacancy_risk:prop-1", {
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-1",
      state: "snoozed",
      snoozedAt: "2026-04-21T11:00:00.000Z",
      snoozedUntil: "2026-04-25T11:00:00.000Z",
      createdAt: "2026-04-21T11:00:00.000Z",
      updatedAt: "2026-04-21T11:00:00.000Z",
    });
    seedDoc("landlordDecisionStates", "landlord-1__review_lease_renewals:prop-1", {
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
      state: "dismissed",
      dismissedAt: "2026-04-21T11:00:00.000Z",
      createdAt: "2026-04-21T11:00:00.000Z",
      updatedAt: "2026-04-21T11:00:00.000Z",
    });

    const { loadLandlordDecisionStates, mergeLandlordDecisionStates } = await import("../landlordDecisionStates");
    const states = await loadLandlordDecisionStates("landlord-1");
    const baseDecision = {
      decisionType: "reduce_vacancy_risk" as const,
      priority: "high" as const,
      explanation: "Vacancy pressure is high.",
      supportingSignals: [],
      recommendedAction: "View property analytics",
      actionKey: "open_vacancy_readiness_flow" as const,
      actionLabel: "Open vacancy readiness",
      destination: "/analytics?propertyId=prop-1",
      workflowCategory: "vacancy_readiness" as const,
      automationEligible: false,
      href: "/analytics?propertyId=prop-1",
      state: "pending" as const,
      reviewedAt: null,
    };

    const merged = mergeLandlordDecisionStates(
      [
        { ...baseDecision, id: "reduce_vacancy_risk:prop-1" },
        {
          ...baseDecision,
          id: "review_lease_renewals:prop-1",
          decisionType: "review_lease_renewals",
          recommendedAction: "Review renewals",
          actionKey: "open_lease_renewals_flow",
          actionLabel: "Open lease renewals",
          destination: "/portfolio-health",
          workflowCategory: "lease_renewals",
          href: "/portfolio-health",
        },
      ],
      states,
      "2026-04-22T11:00:00.000Z"
    );

    expect(merged).toEqual([]);

    const restored = mergeLandlordDecisionStates(
      [{ ...baseDecision, id: "reduce_vacancy_risk:prop-1" }],
      states,
      "2026-04-26T11:00:00.000Z"
    );

    expect(restored).toEqual([
      expect.objectContaining({
        id: "reduce_vacancy_risk:prop-1",
        state: "pending",
      }),
    ]);
  });

  it("persists snoozed and dismissed state overlays in the existing store", async () => {
    const { saveSnoozedLandlordDecisionState, saveDismissedLandlordDecisionState } = await import("../landlordDecisionStates");

    const snoozed = await saveSnoozedLandlordDecisionState({
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-1",
      snoozedUntil: "2026-04-29T12:00:00.000Z",
    });
    const dismissed = await saveDismissedLandlordDecisionState({
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
    });

    expect(snoozed.state).toBe("snoozed");
    expect(snoozed.snoozedUntil).toBe("2026-04-29T12:00:00.000Z");
    expect(dismissed.state).toBe("dismissed");
    expect(dismissed.dismissedAt).toBeTruthy();
  });
});
