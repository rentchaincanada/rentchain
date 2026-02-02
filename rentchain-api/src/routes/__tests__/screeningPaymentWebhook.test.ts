import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { store, dbMock } = vi.hoisted(() => {
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

  return { store, dbMock };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

let webhookTesting: typeof import("../stripeScreeningOrdersWebhookRoutes").__testing;
let rentalTesting: typeof import("../rentalApplicationsRoutes").__testing;

beforeAll(
  async () => {
    const webhookModule = await import("../stripeScreeningOrdersWebhookRoutes");
    const rentalModule = await import("../rentalApplicationsRoutes");
    webhookTesting = webhookModule.__testing;
    rentalTesting = rentalModule.__testing;
  },
  20000
);

describe("screening payment webhook updates", () => {
  beforeEach(() => {
    store.clear();
  });

  it("marks screening paid once and is idempotent on repeat delivery", async () => {
    store.set("app_1", { screeningStatus: "unpaid" });

    const session = {
      id: "sess_1",
      payment_intent: "pi_1",
      metadata: { applicationId: "app_1" },
    } as any;

    const first = await webhookTesting.handleScreeningPaidFromSession({
      session,
      paidAt: 1700000000000,
      eventType: "checkout.session.completed",
      eventId: "evt_1",
    });

    expect(first.status).toBe("paid_set");
    expect(store.get("app_1")?.screeningStatus).toBe("processing");
    expect(typeof store.get("app_1")?.screeningStartedAt).toBe("number");
    expect(store.get("app_1")?.screeningSessionId).toBe("sess_1");

    const second = await webhookTesting.handleScreeningPaidFromSession({
      session,
      paidAt: 1700000000001,
      eventType: "checkout.session.completed",
      eventId: "evt_2",
    });

    expect(second.status).toBe("already_paid");
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
