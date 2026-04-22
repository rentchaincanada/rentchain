import { beforeEach, describe, expect, it, vi } from "vitest";

const writeCanonicalEvent = vi.fn();

vi.mock("../../../lib/events/buildEvent", () => ({
  writeCanonicalEvent,
}));

describe("emitLandlordDecisionAppearanceEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits a first-seen decision.appeared event for visible decisions", async () => {
    const { emitLandlordDecisionAppearanceEvents } = await import("../landlordDecisionAppearanceEvents");

    await emitLandlordDecisionAppearanceEvents({
      landlordId: "landlord-1",
      occurredAt: "2026-04-22T12:00:00.000Z",
      canonicalEvents: [],
      decisions: [
        {
          id: "review_lease_renewals:prop-1",
          decisionType: "review_lease_renewals",
        } as any,
      ],
    });

    expect(writeCanonicalEvent).toHaveBeenCalledTimes(1);
    expect(writeCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "decision_appeared__landlord-1__review_lease_renewals:prop-1",
        type: "decision.appeared",
        action: "appeared",
        visibility: "landlord",
        resource: { type: "analytics_decision", id: "review_lease_renewals:prop-1" },
        metadata: expect.objectContaining({
          landlordId: "landlord-1",
          decisionId: "review_lease_renewals:prop-1",
          decisionType: "review_lease_renewals",
          source: "landlord_analytics_decisions",
        }),
      })
    );
  });

  it("suppresses duplicate appearance events when the landlord decision was already seen", async () => {
    const { emitLandlordDecisionAppearanceEvents } = await import("../landlordDecisionAppearanceEvents");

    await emitLandlordDecisionAppearanceEvents({
      landlordId: "landlord-1",
      occurredAt: "2026-04-22T12:00:00.000Z",
      canonicalEvents: [
        {
          id: "existing-1",
          version: "v1",
          type: "decision.appeared",
          domain: "system",
          action: "appeared",
          actor: { type: "system", id: "system", role: "system" },
          resource: { type: "analytics_decision", id: "review_lease_renewals:prop-1" },
          occurredAt: "2026-04-21T10:00:00.000Z",
          recordedAt: "2026-04-21T10:00:00.000Z",
          visibility: "landlord",
          summary: "Existing event",
          metadata: {
            landlordId: "landlord-1",
            decisionId: "review_lease_renewals:prop-1",
          },
        },
      ],
      decisions: [
        {
          id: "review_lease_renewals:prop-1",
          decisionType: "review_lease_renewals",
        } as any,
      ],
    });

    expect(writeCanonicalEvent).not.toHaveBeenCalled();
  });

  it("treats landlord and decision identity as the first-seen deduplication key", async () => {
    const { emitLandlordDecisionAppearanceEvents } = await import("../landlordDecisionAppearanceEvents");

    await emitLandlordDecisionAppearanceEvents({
      landlordId: "landlord-2",
      occurredAt: "2026-04-22T12:00:00.000Z",
      canonicalEvents: [
        {
          id: "existing-1",
          version: "v1",
          type: "decision.appeared",
          domain: "system",
          action: "appeared",
          actor: { type: "system", id: "system", role: "system" },
          resource: { type: "analytics_decision", id: "review_lease_renewals:prop-1" },
          occurredAt: "2026-04-21T10:00:00.000Z",
          recordedAt: "2026-04-21T10:00:00.000Z",
          visibility: "landlord",
          summary: "Existing event",
          metadata: {
            landlordId: "landlord-1",
            decisionId: "review_lease_renewals:prop-1",
          },
        },
      ],
      decisions: [
        {
          id: "review_lease_renewals:prop-1",
          decisionType: "review_lease_renewals",
        } as any,
        {
          id: "reduce_vacancy_risk:prop-2",
          decisionType: "reduce_vacancy_risk",
        } as any,
      ],
    });

    expect(writeCanonicalEvent).toHaveBeenCalledTimes(2);
    expect(writeCanonicalEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        metadata: expect.objectContaining({
          landlordId: "landlord-2",
          decisionId: "review_lease_renewals:prop-1",
        }),
      })
    );
    expect(writeCanonicalEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        metadata: expect.objectContaining({
          landlordId: "landlord-2",
          decisionId: "reduce_vacancy_risk:prop-2",
        }),
      })
    );
  });
});
