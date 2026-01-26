import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, any>();

const dbMock = {
  collection: vi.fn(() => ({
    doc: (id: string) => ({
      get: async () => ({
        exists: store.has(id),
        data: () => store.get(id),
      }),
      set: async (payload: Record<string, unknown>) => {
        const existing = store.get(id) || {};
        store.set(id, { ...existing, ...payload });
      },
    }),
  })),
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

import { __testing as webhookTesting } from "../stripeScreeningOrdersWebhookRoutes";
import { __testing as rentalTesting } from "../rentalApplicationsRoutes";

describe("screening payment webhook updates", () => {
  beforeEach(() => {
    store.clear();
  });

  it("marks screening paid once and is idempotent on repeat delivery", async () => {
    store.set("app_1", { screeningStatus: "unpaid" });

    const first = await webhookTesting.markApplicationScreeningPaid({
      applicationId: "app_1",
      sessionId: "sess_1",
      paymentIntentId: "pi_1",
      paidAt: 1700000000000,
      eventType: "checkout.session.completed",
      eventId: "evt_1",
    });

    expect(first).toBe("paid_set");
    expect(store.get("app_1")?.screeningStatus).toBe("paid");
    expect(store.get("app_1")?.screeningSessionId).toBe("sess_1");

    const second = await webhookTesting.markApplicationScreeningPaid({
      applicationId: "app_1",
      sessionId: "sess_1",
      paymentIntentId: "pi_1",
      paidAt: 1700000000001,
      eventType: "checkout.session.completed",
      eventId: "evt_2",
    });

    expect(second).toBe("already_paid");
  });

  it("ignores checkout.session.completed when applicationId metadata is missing", async () => {
    const session = {
      id: "sess_missing",
      payment_intent: "pi_missing",
      metadata: {},
    } as any;

    const result = await webhookTesting.handleScreeningPaidFromSession({
      session,
      eventType: "checkout.session.completed",
      eventId: "evt_missing",
      paidAt: 1700000000000,
    });

    expect(result.status).toBe("ignored");
    expect(result.missingApplicationId).toBe(true);
  });
});

describe("screening checkout guard", () => {
  it("detects already-paid screenings", () => {
    expect(rentalTesting.isScreeningAlreadyPaid({ screeningStatus: "paid" })).toBe(true);
    expect(rentalTesting.isScreeningAlreadyPaid({ screeningStatus: "unpaid" })).toBe(false);
  });
});
