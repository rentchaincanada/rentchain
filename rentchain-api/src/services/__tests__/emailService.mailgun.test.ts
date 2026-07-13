import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseMailgunMessageId, sendEmail } from "../emailService";

describe("emailService mailgun provider", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.EMAIL_PROVIDER = "mailgun";
    process.env.MAILGUN_API_KEY = "mg_test_key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.EMAIL_FROM = "no-reply@example.com";
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.unstubAllGlobals();
  });

  it("resolves when Mailgun responds with success", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "<abc123@mg.example.com>", message: "Queued. Thank you." }),
    }));
    vi.stubGlobal("fetch", fetchMock as any);

    await expect(
      sendEmail({
        to: "tenant@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      })
    ).resolves.toEqual({
      provider: "mailgun",
      providerMessageId: "<abc123@mg.example.com>",
      providerResponseId: "<abc123@mg.example.com>",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  it("parses Mailgun message ids from json or plain text responses", () => {
    expect(parseMailgunMessageId(JSON.stringify({ id: "<json-id@mg.example.com>" }))).toBe("<json-id@mg.example.com>");
    expect(parseMailgunMessageId("Queued. Thank you. <plain-id@mg.example.com>")).toBe("<plain-id@mg.example.com>");
    expect(parseMailgunMessageId("queued")).toBeNull();
  });

  it("rejects when Mailgun responds with failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    }));
    vi.stubGlobal("fetch", fetchMock as any);

    await expect(
      sendEmail({
        to: "tenant@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      })
    ).rejects.toThrow("mailgun_send_failed:401");
  });
});
