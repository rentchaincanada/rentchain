import { describe, expect, it, vi, beforeEach } from "vitest";

const { apiFetchMock, apiJsonMock, apiGetJsonMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  apiJsonMock: vi.fn(),
  apiGetJsonMock: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => ({
  apiFetch: apiFetchMock,
  apiJson: apiJsonMock,
}));

vi.mock("./http", () => ({
  apiGetJson: apiGetJsonMock,
}));

describe("billingApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates checkout sessions through the canonical billing checkout route", async () => {
    apiJsonMock.mockResolvedValue({
      ok: true,
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.test/session",
    });
    const { createCheckoutSession } = await import("./billingApi");

    const result = await createCheckoutSession({
      tier: "pro",
      interval: "yearly",
      featureKey: "billing",
      source: "billing_page",
      redirectTo: "/billing",
    });

    expect(apiJsonMock).toHaveBeenCalledWith("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        tier: "pro",
        interval: "yearly",
        featureKey: "billing",
        source: "billing_page",
        redirectTo: "/billing",
      }),
    });
    expect(result).toEqual({
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.test/session",
      checkoutUrl: "https://checkout.stripe.test/session",
    });
  });

  it("normalizes subscription status without requiring raw provider identifiers", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      tier: "enterprise",
      planId: "enterprise",
      status: "active",
      interval: "year",
      renewalDate: "2027-01-01T00:00:00.000Z",
      currentPeriodEnd: "2027-01-01T00:00:00.000Z",
      statusSource: "stripe_subscription",
    });
    const { fetchSubscriptionStatus } = await import("./billingApi");

    const result = await fetchSubscriptionStatus();

    expect(apiFetchMock).toHaveBeenCalledWith("/billing/subscription-status", { method: "GET" });
    expect(result).toMatchObject({
      tier: "elite",
      planId: "elite",
      status: "active",
      interval: "year",
      renewalDate: "2027-01-01T00:00:00.000Z",
      currentPeriodEnd: "2027-01-01T00:00:00.000Z",
      statusSource: "stripe_subscription",
    });
    expect(JSON.stringify(result)).not.toContain("cus_");
    expect(JSON.stringify(result)).not.toContain("sub_");
  });

  it("returns a canceled fallback when subscription status cannot be loaded", async () => {
    apiFetchMock.mockRejectedValue(new Error("network failed"));
    const { fetchSubscriptionStatus } = await import("./billingApi");

    await expect(fetchSubscriptionStatus()).resolves.toEqual({
      tier: null,
      planId: null,
      status: "canceled",
    });
  });
});
