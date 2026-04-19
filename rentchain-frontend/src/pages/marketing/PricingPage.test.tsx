import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "./PricingPage";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCapabilities: vi.fn(),
  useLanguage: vi.fn(),
  fetchBillingPricing: vi.fn(),
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

vi.mock("../../context/useAuth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilities,
}));

vi.mock("../../context/LanguageContext", () => ({
  useLanguage: mocks.useLanguage,
}));

vi.mock("../../api/billingApi", () => ({
  fetchBillingPricing: mocks.fetchBillingPricing,
}));

vi.mock("../../lib/analytics", () => ({
  track: mocks.track,
}));

vi.mock("./MarketingLayout", () => ({
  MarketingLayout: ({ children }: { children: any }) => <div>{children}</div>,
}));

describe("Marketing PricingPage analytics", () => {
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
      user: { id: "u1", plan: "free", role: "landlord" },
    });
    mocks.useCapabilities.mockReturnValue({
      caps: { plan: "free" },
    });
    mocks.useLanguage.mockReturnValue({ locale: "en", setLocale: vi.fn(), t: (key: string) => key });
    mocks.fetchBillingPricing.mockResolvedValue({ ok: true, plans: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes authenticated marketing pricing upgrades through billing with the selected plan and interval", async () => {
    render(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(mocks.track).toHaveBeenCalledWith("pricing_page_viewed", {
        surface: "marketing_pricing",
        currentPlan: "free",
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
        /You can start and explore before committing to a paid plan\. Pricing is here to show what opens next once the workflow is working for you\./i
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Annual" }));

    expect(mocks.track).toHaveBeenCalledWith("pricing_interval_changed", {
      surface: "marketing_pricing",
      currentPlan: "free",
      interval: "yearly",
      route: "/",
    });

    fireEvent.click(screen.getByRole("button", { name: "See Pro in billing" }));

    expect(mocks.track).toHaveBeenCalledWith("pricing_plan_cta_clicked", {
      surface: "marketing_pricing",
      currentPlan: "free",
      targetPlan: "pro",
      interval: "yearly",
      action: "open_billing_hub",
      route: "/",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/billing?upgradePlan=pro&upgradeInterval=year");
  });
});
