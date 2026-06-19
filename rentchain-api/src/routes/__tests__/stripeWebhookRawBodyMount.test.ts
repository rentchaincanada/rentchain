import express from "express";
import Stripe from "stripe";
import { Readable, Writable } from "stream";
import { describe, expect, it, vi } from "vitest";

const endpointSecret = "whsec_test_raw_body_mount";

vi.mock("../../config/screeningConfig", () => ({
  STRIPE_WEBHOOK_SECRET: endpointSecret,
}));

vi.mock("../../services/stripeService", async () => {
  const stripeModule = await import("stripe");
  const StripeClient = stripeModule.default;
  const stripe = new StripeClient("sk_test_placeholder", {
    apiVersion: "2024-06-20" as any,
  });
  return {
    getStripeClient: () => stripe,
    isStripeConfigured: () => true,
  };
});

vi.mock("../../lib/stripeNotConfigured", () => ({
  stripeNotConfiguredResponse: () => ({ ok: false, error: "stripe_not_configured" }),
  isStripeNotConfiguredError: () => false,
}));

vi.mock("../../firebase", () => ({
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

function buildSignedPayload(secret = endpointSecret) {
  const payload = JSON.stringify({
    id: "evt_test_raw_body",
    object: "event",
    api_version: "2024-06-20",
    created: 1710000000,
    data: {
      object: {
        id: "pi_test_raw_body",
        object: "payment_intent",
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: "payment_intent.created",
  });
  return {
    payload,
    signature: Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    }),
  };
}

async function buildMountedWebhookApp() {
  const { stripeWebhookHandler } = await import("../stripeScreeningOrdersWebhookRoutes");
  const app = express();
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);
  app.use(express.json());
  return app;
}

async function invokeMountedWebhook(app: express.Express, payload: string, signature: string) {
  return await new Promise<{ status: number; body: any; text: string; headers: Record<string, any> }>(
    (resolve, reject) => {
      const chunks: Buffer[] = [];
      const req: any = Readable.from([Buffer.from(payload)]);
      req.method = "POST";
      req.url = "/api/webhooks/stripe";
      req.originalUrl = "/api/webhooks/stripe";
      req.path = "/api/webhooks/stripe";
      req.query = {};
      req.headers = {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(payload)),
        "stripe-signature": signature,
      };
      req.get = (name: string) => req.headers[String(name || "").toLowerCase()];
      req.header = req.get;

      const res: any = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          callback();
        },
      });
      res.statusCode = 200;
      res.headers = {};
      res.setHeader = (name: string, value: any) => {
        res.headers[String(name).toLowerCase()] = value;
      };
      res.getHeader = (name: string) => res.headers[String(name).toLowerCase()];
      res.removeHeader = (name: string) => {
        delete res.headers[String(name).toLowerCase()];
      };
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      const finish = (payloadValue?: any) => {
        if (payloadValue !== undefined) {
          chunks.push(Buffer.isBuffer(payloadValue) ? payloadValue : Buffer.from(String(payloadValue)));
        }
        const text = Buffer.concat(chunks).toString("utf8");
        const contentType = String(res.headers["content-type"] || "");
        const body = contentType.includes("application/json") && text ? JSON.parse(text) : null;
        resolve({ status: res.statusCode, body, text, headers: res.headers });
        return res;
      };
      res.json = (payloadValue: any) => {
        res.setHeader("content-type", "application/json; charset=utf-8");
        return finish(JSON.stringify(payloadValue));
      };
      res.send = finish;
      res.end = finish;

      app.handle(req, res, (error: any) => {
        if (error) reject(error);
        else reject(new Error("Unhandled webhook request"));
      });
    }
  );
}

describe("stripe webhook raw body route mount", () => {
  it("returns 200 for a valid signed test-mode event through the mounted raw body route", async () => {
    const app = await buildMountedWebhookApp();
    const { payload, signature } = buildSignedPayload();

    const res = await invokeMountedWebhook(app, payload, signature);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it("returns a safe non-2xx response for invalid signatures", async () => {
    const app = await buildMountedWebhookApp();
    const { payload, signature } = buildSignedPayload("whsec_wrong_secret");

    const res = await invokeMountedWebhook(app, payload, signature);

    expect(res.status).toBe(400);
    expect(res.text).toContain("Signature verification failed");
  });
});
