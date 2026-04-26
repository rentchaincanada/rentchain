import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBillingStatus, billingTierLabel } from "./useBillingStatus";

vi.mock("@/api/billingApi", () => ({
  fetchSubscriptionStatus: vi.fn(),
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: vi.fn(),
}));

vi.mock("@/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("useBillingStatus", () => {
  it("prefers the canonical tier returned by subscription status", async () => {
    const { fetchSubscriptionStatus } = await import("@/api/billingApi");
    const { useCapabilities } = await import("@/hooks/useCapabilities");
    const { useAuth } = await import("@/context/useAuth");

    vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
      tier: "starter",
      planId: "starter",
      status: "active",
      interval: "month",
      renewalDate: null,
    } as any);
    vi.mocked(useCapabilities).mockReturnValue({
      caps: { plan: "business" },
      loading: false,
    } as any);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1", role: "landlord", plan: "core" },
    } as any);

    const { result } = renderHook(() => useBillingStatus());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tier).toBe("starter");
    expect(result.current.interval).toBe("month");
  });

  it("falls back to canonical capability or auth plan when billing status is unavailable", async () => {
    const { fetchSubscriptionStatus } = await import("@/api/billingApi");
    const { useCapabilities } = await import("@/hooks/useCapabilities");
    const { useAuth } = await import("@/context/useAuth");

    vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
      tier: null,
      planId: null,
      status: "canceled",
      interval: null,
      renewalDate: null,
    } as any);
    vi.mocked(useCapabilities).mockReturnValue({
      caps: { plan: "business" },
      loading: false,
    } as any);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1", role: "landlord", plan: "core" },
    } as any);

    const { result } = renderHook(() => useBillingStatus());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tier).toBe("elite");
  });

  it("exposes canonical billing labels", () => {
    expect(billingTierLabel("screening")).toBe("Free");
    expect(billingTierLabel("core")).toBe("Starter");
    expect(billingTierLabel("enterprise")).toBe("Elite");
  });
});
