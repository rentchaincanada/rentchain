import { beforeEach, describe, expect, it, vi } from "vitest";
import { signingWebhookHandler } from "../webhooks/signingWebhookRoutes";

const { processSigningWebhookMock } = vi.hoisted(() => ({
  processSigningWebhookMock: vi.fn(),
}));

vi.mock("../../services/signing/leaseSigningService", () => ({
  processSigningWebhook: processSigningWebhookMock,
  signingErrorCode: (error: any) => String(error?.message || "lease_signing_failed"),
  signingErrorStatus: (error: any) => Number(error?.status || 500),
}));

function makeRes() {
  const res: any = {
    statusCode: 200,
    headers: new Map<string, string>(),
    body: undefined as any,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    type: vi.fn((value: string) => {
      res.headers.set("content-type", value);
      return res;
    }),
    send: vi.fn((value: any) => {
      res.body = value;
      return res;
    }),
    json: vi.fn((value: any) => {
      res.body = value;
      res.headers.set("content-type", "application/json");
      return res;
    }),
  };
  return res;
}

describe("signingWebhookHandler", () => {
  beforeEach(() => {
    processSigningWebhookMock.mockReset();
    delete process.env.SIGNING_PROVIDER;
  });

  it("returns Dropbox Sign account callback acknowledgement as exact plain text", async () => {
    processSigningWebhookMock.mockResolvedValueOnce({ providerResponseText: "Hello API Event Received" });
    const req: any = {
      params: { providerId: "dropbox_sign" },
      query: {},
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body: Buffer.from("redacted"),
    };
    const res = makeRes();

    await signingWebhookHandler(req, res);

    expect(processSigningWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "dropbox_sign",
        rawBody: req.body,
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.type).toHaveBeenCalledWith("text/plain");
    expect(res.body).toBe("Hello API Event Received");
    expect(res.json).not.toHaveBeenCalled();
  });

  it("preserves JSON acknowledgement for normal webhook processing", async () => {
    processSigningWebhookMock.mockResolvedValueOnce({});
    const req: any = { params: { providerId: "mock" }, query: {}, headers: {}, body: { ok: true } };
    const res = makeRes();

    await signingWebhookHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
