import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const constructEventMock = vi.fn();

vi.mock("../../config/screeningConfig", () => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test",
}));

vi.mock("../../services/stripeService", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
  }),
}));

vi.mock("../../lib/stripeNotConfigured", () => ({
  stripeNotConfiguredResponse: () => ({ ok: false, error: "stripe_not_configured" }),
  isStripeNotConfiguredError: () => false,
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false, data: () => null }),
        set: async () => undefined,
      }),
      where: () => ({
        limit: () => ({
          get: async () => ({ empty: true, docs: [] }),
        }),
      }),
    }),
  },
}));

vi.mock("../../services/screening/screeningOrchestrator", () => ({
  beginScreening: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/stripeFinalize", () => ({
  finalizeStripePayment: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/stripeScreeningProcessor", () => ({
  applyScreeningResultsFromOrder: vi.fn(async () => ({ ok: true })),
}));

async function createApp() {
  const { stripeWebhookHandler } = await import("../stripeScreeningOrdersWebhookRoutes");
  const app = express();

  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

  app.use((_req, res) => {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  });

  return app;
}

describe("stripe webhook public route", () => {
  beforeEach(() => {
    constructEventMock.mockReset();
  });

  it("accepts webhook without Authorization when signature verifies", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "noop.event",
      data: { object: {} },
    });
    const app = await createApp();

    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "t=1,v1=test")
      .set("content-type", "application/json")
      .send('{"id":"evt_1","type":"noop.event"}');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(constructEventMock).toHaveBeenCalled();
  });

  it("returns 400 on invalid signature and does not require Authorization", async () => {
    constructEventMock.mockImplementationOnce(() => {
      throw new Error("bad signature");
    });
    const app = await createApp();

    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "t=1,v1=bad")
      .set("content-type", "application/json")
      .send('{"id":"evt_1","type":"noop.event"}');

    expect(res.status).toBe(400);
    expect(String(res.text || "")).toContain("Signature verification failed");
  });
});

