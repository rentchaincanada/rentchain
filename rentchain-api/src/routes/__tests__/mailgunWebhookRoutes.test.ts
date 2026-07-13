import { beforeEach, describe, expect, it, vi } from "vitest";

const handleWebhookMock = vi.fn();

vi.mock("../../services/renewalNoticeCommunicationDeliveryWebhookService", () => ({
  handleMailgunRenewalCommunicationWebhook: handleWebhookMock,
}));

async function invoke(body: any, env: Record<string, string | undefined> = {}) {
  const original = { ...process.env };
  process.env.MAILGUN_WEBHOOK_SIGNING_KEY = env.MAILGUN_WEBHOOK_SIGNING_KEY ?? "secret";
  process.env.MAILGUN_WEBHOOK_REPLAY_WINDOW_SECONDS = env.MAILGUN_WEBHOOK_REPLAY_WINDOW_SECONDS;
  const { mailgunEventsWebhookHandler } = await import("../mailgunWebhookRoutes");
  return await new Promise<{ status: number; body: any; headers: Record<string, string> }>((resolve, reject) => {
    const headers: Record<string, string> = {};
    const req: any = { body, headers: {} };
    const res: any = {
      statusCode: 200,
      setHeader(key: string, value: string) {
        headers[key.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        process.env = original;
        resolve({ status: this.statusCode, body: payload, headers });
        return this;
      },
    };
    mailgunEventsWebhookHandler(req, res).catch((err) => {
      process.env = original;
      reject(err);
    });
  });
}

describe("mailgun webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts provider webhooks without Authorization when the service verifies the signature", async () => {
    handleWebhookMock.mockResolvedValueOnce({
      ok: true,
      statusCode: 200,
      matched: true,
      updated: true,
      communicationId: "rnc_test",
      deliveryStatus: "delivered",
      receiptId: "receipt-1",
    });

    const res = await invoke({ signature: {}, "event-data": {} });

    expect(res.status).toBe(200);
    expect(res.headers["x-rentchain-mailgun-webhook"]).toBe("events-v1");
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        matched: true,
        updated: true,
        communicationId: "rnc_test",
        deliveryStatus: "delivered",
      })
    );
    expect(handleWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        signingKey: "secret",
        replayWindowSeconds: undefined,
      })
    );
  });

  it("returns service validation errors without requiring landlord auth", async () => {
    handleWebhookMock.mockResolvedValueOnce({
      ok: false,
      statusCode: 401,
      error: "MAILGUN_WEBHOOK_SIGNATURE_INVALID",
    });

    const res = await invoke({ signature: {}, "event-data": {} });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "MAILGUN_WEBHOOK_SIGNATURE_INVALID" });
  });
});
