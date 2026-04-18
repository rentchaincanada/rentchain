import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "./PricingPage";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCapabilities: vi.fn(),
  fetchBillingPricing: vi.fn(),
  createBillingPortalSession: vi.fn(),
  startCheckout: vi.fn(),
  track: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilities,
}));

vi.mock("../api/billingApi", () => ({
  fetchBillingPricing: mocks.fetchBillingPricing,
  createBillingPortalSession: mocks.createBillingPortalSession,
}));

vi.mock("../billing/startCheckout", () => ({
  startCheckout: mocks.startCheckout,
}));

vi.mock("@/lib/analytics", () => ({
  track: mocks.track,
}));

describe("PricingPage analytics", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    mocks.useAuth.mockReturnValue({
      user: { id: "u1", plan: "starter", role: "landlord" },
    });
    mocks.useCapabilities.mockReturnValue({
      caps: { plan: "starter" },
    });
    mocks.fetchBillingPricing.mockResolvedValue({ ok: true, plans: [] });
    mocks.createBillingPortalSession.mockResolvedValue({ url: "https://example.test/portal" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes upgrade intent through billing from the workspace pricing page", async () => {
    render(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(mocks.track).toHaveBeenCalledWith("pricing_page_viewed", {
        surface: "workspace_pricing",
        currentPlan: "starter",
        interval: "monthly",
        route: "/",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Annual" }));

    expect(mocks.track).toHaveBeenCalledWith("pricing_interval_changed", {
      surface: "workspace_pricing",
      currentPlan: "starter",
      interval: "yearly",
      route: "/",
    });

    fireEvent.click(screen.getByRole("button", { name: "Review Pro plan" }));

    expect(mocks.track).toHaveBeenCalledWith("pricing_plan_cta_clicked", {
      surface: "workspace_pricing",
      currentPlan: "starter",
      targetPlan: "pro",
      interval: "yearly",
      action: "open_billing_hub",
      route: "/",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/billing");
    expect(mocks.startCheckout).not.toHaveBeenCalled();
  });
});
