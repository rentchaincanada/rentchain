import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../emailService";
import {
  PREVIEW_QA_FAKE_EMAIL_PROVIDER,
  PREVIEW_QA_FAKE_FAILURE_DESTINATION,
  sendViaPreviewQaFake,
} from "../previewQaFakeEmailProvider";

const originalEnv = process.env;

function exactQaEnv(scope = "pr1512-property-notices", service = "rentchain-pr1512-notices-qa-590e0ecb") {
  process.env = {
    ...originalEnv,
    EMAIL_PROVIDER: PREVIEW_QA_FAKE_EMAIL_PROVIDER,
    PREVIEW_QA_AUTH_ENABLED: "true",
    PREVIEW_QA_AUTH_SCOPE: scope,
    APP_ENV: "preview",
    GOOGLE_CLOUD_PROJECT: "rentchain-preview",
    K_SERVICE: service,
    PREVIEW_QA_EXPECTED_SERVICE: service,
    FIRESTORE_ENABLED: "true",
    FIRESTORE_DATABASE_ID: "(default)",
  };
}

function message(to = "notice-success@qa.invalid") {
  return {
    to,
    subject: "Synthetic Notice",
    text: "Synthetic isolated QA only.",
    metadata: { deliveryId: "delivery-1" },
  };
}

describe("PR #1512 non-networking fake email provider", () => {
  beforeEach(() => {
    exactQaEnv();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("returns a deterministic provider ID without invoking fetch", async () => {
    const fetchMock = vi.fn(() => { throw new Error("network forbidden"); });
    vi.stubGlobal("fetch", fetchMock);
    const first = await sendEmail(message());
    const second = await sendEmail(message());
    expect(first).toEqual(second);
    expect(first.provider).toBe(PREVIEW_QA_FAKE_EMAIL_PROVIDER);
    expect(first.providerMessageId).toMatch(/^fake_[a-f0-9]{64}$/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("supports one server-owned deterministic synthetic failure without network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendEmail(message(PREVIEW_QA_FAKE_FAILURE_DESTINATION))).rejects.toThrow(
      "preview_qa_fake_provider_rejected"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["Production", { GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99" }],
    ["permanent Preview", { K_SERVICE: "rentchain-preview-backend", PREVIEW_QA_EXPECTED_SERVICE: "rentchain-preview-backend" }],
    ["wrong service", { K_SERVICE: "rentchain-pr1512-notices-qa-deadbeef" }],
    ["wrong scope", { PREVIEW_QA_AUTH_SCOPE: "pr1510-landlord-messaging" }],
    ["disabled", { PREVIEW_QA_AUTH_ENABLED: "false" }],
  ])("fails closed in %s configuration", async (_label, overrides) => {
    process.env = { ...process.env, ...overrides };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendEmail(message())).rejects.toThrow("PREVIEW_QA_FAKE_PROVIDER_INVALID_RUNTIME");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces one-recipient privacy and synthetic destinations", async () => {
    await expect(sendViaPreviewQaFake({ ...message(), to: ["one@qa.invalid", "two@qa.invalid"] })).rejects.toThrow(
      "preview_qa_fake_requires_one_recipient"
    );
    await expect(sendViaPreviewQaFake({ ...message(), to: "customer@example.com" })).rejects.toThrow(
      "preview_qa_fake_invalid_destination"
    );
    await expect(sendViaPreviewQaFake({ ...message(), cc: "other@qa.invalid" })).rejects.toThrow(
      "preview_qa_fake_private_delivery_required"
    );
  });
});
