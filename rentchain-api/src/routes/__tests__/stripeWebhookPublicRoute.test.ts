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

async function invokeWebhook(body: string) {
  const { stripeWebhookHandler } = await import("../stripeScreeningOrdersWebhookRoutes");
  return await new Promise<{ status: number; body: any; text?: string }>((resolve, reject) => {
    const req: any = {
      body: Buffer.from(body),
      headers: {
        "stripe-signature": "t=1,v1=test",
      },
    };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: null, text: String(payload || "") });
        return this;
      },
    };
    stripeWebhookHandler(req, res).catch(reject);
  });
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
    const res = await invokeWebhook('{"id":"evt_1","type":"noop.event"}');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(constructEventMock).toHaveBeenCalled();
  });

  it("returns 400 on invalid signature and does not require Authorization", async () => {
    constructEventMock.mockImplementationOnce(() => {
      throw new Error("bad signature");
    });
    const { stripeWebhookHandler } = await import("../stripeScreeningOrdersWebhookRoutes");
    const res = await new Promise<{ status: number; body: any; text?: string }>((resolve, reject) => {
      const req: any = {
        body: Buffer.from('{"id":"evt_1","type":"noop.event"}'),
        headers: {
          "stripe-signature": "t=1,v1=bad",
        },
      };
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          resolve({ status: this.statusCode, body: payload });
          return this;
        },
        send(payload: any) {
          resolve({ status: this.statusCode, body: null, text: String(payload || "") });
          return this;
        },
      };
      stripeWebhookHandler(req, res).catch(reject);
    });

    expect(res.status).toBe(400);
    expect(String(res.text || "")).toContain("Signature verification failed");
  });
});
