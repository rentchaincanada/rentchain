import { describe, expect, it } from "vitest";
import {
  describeRentPaymentBlocker,
  describeRentPaymentGuidance,
  formatPaymentExperienceStatus,
  mapRentPaymentCheckoutErrorMessage,
  prettyRentPaymentStatus,
} from "./paymentStatusGuidance";

describe("paymentStatusGuidance", () => {
  it("prefers exact latest payment statuses for display and guidance", () => {
    expect(
      formatPaymentExperienceStatus({
        latestPaymentStatus: "expired",
        latestStatus: "canceled",
      })
    ).toBe("Checkout expired");

    expect(
      describeRentPaymentGuidance({
        audience: "tenant",
        latestPaymentStatus: "expired",
        latestStatus: "canceled",
      })
    ).toMatch(/expired before payment completed/i);

    expect(prettyRentPaymentStatus("payment_pending")).toBe("Payment pending");
  });

  it("maps blocked reasons and checkout errors to human-readable copy", () => {
    expect(describeRentPaymentBlocker("payment_already_pending", "tenant")).toMatch(/checkout is already open/i);
    expect(describeRentPaymentBlocker("payment_rail_not_enabled", "landlord")).toBe(
      "Rent collection still needs to be enabled for this lease."
    );
    expect(mapRentPaymentCheckoutErrorMessage("payment_readiness_not_ready")).toBe(
      "Lease payment setup details still need review before checkout can start."
    );
    expect(mapRentPaymentCheckoutErrorMessage("TENANT_RENT_PAYMENT_CHECKOUT_FAILED")).toBe(
      "Unable to start rent payment checkout."
    );
  });
});
