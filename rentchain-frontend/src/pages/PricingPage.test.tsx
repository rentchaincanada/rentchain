import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "./PricingPage";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCapabilities: vi.fn(),
  fetchBillingPricing: vi.fn(),
  createBillingPortalSession: vi.fn(),
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

  it("routes upgrade intent through billing with the selected plan and interval", async () => {
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
    expect(
      screen.getByText(
        /Starter gives you the workflow foundation, Pro adds operational control and reporting, and Elite adds portfolio intelligence and oversight/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /You do not need to pick a paid plan before you understand the workflow\. Use pricing to see what opens next after the basics are already working for you\./i
      )
    ).toBeInTheDocument();
    expect(document.querySelector(".rc-auth-pricing-page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveClass("rc-pricing-interval-button");

    fireEvent.click(screen.getByRole("button", { name: "Annual" }));

    expect(mocks.track).toHaveBeenCalledWith("pricing_interval_changed", {
      surface: "workspace_pricing",
      currentPlan: "starter",
      interval: "yearly",
      route: "/",
    });

    fireEvent.click(screen.getByRole("button", { name: "See Pro in billing" }));

    expect(mocks.track).toHaveBeenCalledWith("pricing_plan_cta_clicked", {
      surface: "workspace_pricing",
      currentPlan: "starter",
      targetPlan: "pro",
      interval: "yearly",
      action: "open_billing_hub",
      route: "/",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/billing?upgradePlan=pro&upgradeInterval=year");
  });
});
