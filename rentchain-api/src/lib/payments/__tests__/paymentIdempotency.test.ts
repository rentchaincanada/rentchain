import { describe, expect, it } from "vitest";
import {
  buildManualPaymentIdempotencyKey,
  buildProviderWebhookIdempotencyKey,
  buildSessionCreationIdempotencyKey,
} from "../paymentIdempotency";

describe("paymentIdempotency", () => {
  it("builds deterministic provider webhook keys from provider and event id", () => {
    expect(
      buildProviderWebhookIdempotencyKey({
        provider: "stripe",
        providerEventId: " evt_123 ",
      })
    ).toBe("provider_event:stripe:evt_123");
  });

  it("builds deterministic session creation keys from internal subject and amount", () => {
    expect(
      buildSessionCreationIdempotencyKey({
        provider: "trustly",
        purpose: "rent",
        subjectId: " lease/123 ",
        amount: 125000.4,
        currency: "CAD",
      })
    ).toBe("payment_session:trustly:rent:lease_123:125000:cad");
  });

  it("builds deterministic manual payment keys with normalized received date", () => {
    expect(
      buildManualPaymentIdempotencyKey({
        landlordId: "landlord-1",
        subjectId: "lease-1",
        amount: 50000,
        receivedAt: "2026-05-01T10:00:00.000Z",
      })
    ).toBe("manual_payment:manual:landlord-1:lease-1:50000:2026-05-01t10:00:00.000z");
  });

  it("keeps missing fields explicit instead of creating blank key parts", () => {
    expect(
      buildManualPaymentIdempotencyKey({
        landlordId: "",
        subjectId: "",
        amount: Number.NaN,
      })
    ).toBe("manual_payment:manual:landlord_missing:subject_missing:amount_invalid:received_at_missing");
  });
});
