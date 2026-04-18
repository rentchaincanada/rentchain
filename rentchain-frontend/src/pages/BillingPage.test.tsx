import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import BillingPage from "./BillingPage";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useBillingStatusMock: vi.fn(),
  billingTierLabelMock: vi.fn(),
  fetchBillingHistoryMock: vi.fn(),
  fetchBillingPricingMock: vi.fn(),
  createBillingPortalSessionMock: vi.fn(),
  apiFetchMock: vi.fn(),
  trackMock: vi.fn(),
  refreshEntitlementsMock: vi.fn(),
  billingPlansPanelMock: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("@/hooks/useBillingStatus", () => ({
  useBillingStatus: mocks.useBillingStatusMock,
  billingTierLabel: mocks.billingTierLabelMock,
}));

vi.mock("../api/billingApi", () => ({
  fetchBillingHistory: mocks.fetchBillingHistoryMock,
  fetchBillingPricing: mocks.fetchBillingPricingMock,
  createBillingPortalSession: mocks.createBillingPortalSessionMock,
}));

vi.mock("@/lib/apiClient", () => ({
  apiFetch: mocks.apiFetchMock,
}));

vi.mock("@/lib/analytics", () => ({
  track: mocks.trackMock,
}));

vi.mock("@/lib/entitlements", () => ({
  refreshEntitlements: mocks.refreshEntitlementsMock,
}));

vi.mock("../components/billing/BillingPlansPanel", () => ({
  BillingPlansPanel: (props: any) => {
    mocks.billingPlansPanelMock(props);
    return <div data-testid="billing-plans-panel">{props.currentPlan ?? "none"}</div>;
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BillingPage", () => {
  beforeEach(() => {
    mocks.useAuthMock.mockReturnValue({
      user: { id: "u1", role: "landlord", actorRole: "landlord" },
      updateUser: vi.fn(),
    });
    mocks.fetchBillingHistoryMock.mockResolvedValue([]);
    mocks.fetchBillingPricingMock.mockResolvedValue({
      ok: true,
      plans: [
        { key: "starter", label: "Starter", currency: "cad", monthlyAmountCents: 2900, yearlyAmountCents: 29000 },
        { key: "pro", label: "Pro", currency: "cad", monthlyAmountCents: 5900, yearlyAmountCents: 59000 },
        { key: "elite", label: "Elite", currency: "cad", monthlyAmountCents: 9900, yearlyAmountCents: 99000 },
      ],
    });
    mocks.createBillingPortalSessionMock.mockResolvedValue({ url: "https://example.test/portal" });
    mocks.refreshEntitlementsMock.mockResolvedValue(undefined);
    mocks.billingTierLabelMock.mockImplementation((tier: string | null) => {
      if (tier === "elite") return "Elite";
      if (tier === "pro") return "Pro";
      if (tier === "starter") return "Starter";
      return "Free";
    });
  });

  it("holds current-plan display in loading state until billing status resolves", async () => {
    mocks.useBillingStatusMock.mockReturnValue({
      tier: "elite",
      interval: null,
      renewalDate: null,
      isLoading: true,
    });

    render(
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Loading...").length).toBeGreaterThan(0);
    expect(screen.getByTestId("billing-plans-panel")).toHaveTextContent("none");
    expect(screen.getAllByRole("button", { name: "Continue to Starter checkout" })).toHaveLength(2);
    expect(
      screen
        .getAllByRole("button", { name: "Continue to Starter checkout" })
        .every((button) => button.hasAttribute("disabled"))
    ).toBe(true);
  });

  it("uses the pricing-selected upgrade plan and interval when arriving from pricing", async () => {
    mocks.useBillingStatusMock.mockReturnValue({
      tier: "free",
      interval: null,
      renewalDate: null,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/billing?upgradePlan=pro&upgradeInterval=year"]}>
        <BillingPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText(/Pricing selection saved: Pro on the Yearly plan/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Billing, plans, and upgrade review/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Opening checkout does not change your plan by itself\. It takes you to a secure review step where you can confirm the upgrade first\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Starter gives you the workflow foundation, Pro adds operational control and reporting, and Elite adds portfolio intelligence and oversight/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Upgrading helps you keep your tenant, application, and property work in one place as your workflow gets more active\./i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Recommended next plan: Pro from your pricing selection/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /This plan helps you keep building in RentChain without switching tools, while adding the next layer of operations and reporting to the workflow you already started\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /You're continuing the Pro plan you selected on Pricing, so Billing keeps that choice visible before checkout\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Staying on Free keeps setup usable, but the richer operating workflow stays limited once you need messaging, tenant coordination, and ongoing rental follow-through\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /After you click, secure checkout opens so you can review the Yearly Pro plan, confirm billing details, and choose whether to complete the upgrade\./i
      )
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Continue to Pro checkout" }).length).toBeGreaterThan(0);
    expect(mocks.billingPlansPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        interval: "year",
        selectedPlan: "pro",
        recommendedPlan: "pro",
      })
    );
  });

  it("uses the resolved billing tier consistently in the summary and plans panel", async () => {
    mocks.useBillingStatusMock.mockReturnValue({
      tier: "pro",
      interval: "month",
      renewalDate: null,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Pro")).toBeInTheDocument());
    expect(screen.getByTestId("billing-plans-panel")).toHaveTextContent("pro");
    expect(screen.getAllByRole("button", { name: "Manage subscription" })).toHaveLength(2);
    expect(
      screen.getByText(/Pro focuses on operational control and reporting\. Elite adds the portfolio intelligence layer/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Upgrading keeps your operational workflow intact, while adding the portfolio visibility and intelligence layer that helps you make stronger decisions\./i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Recommended next plan: Elite/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /This plan helps you keep building in RentChain without switching tools, while adding the next layer of insights and oversight to the workflow you already started\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This suggestion follows your current plan and the shared plan ladder, so the next step is clear without changing your current subscription first\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Staying on Pro keeps strong operational tooling, but portfolio-level intelligence, advanced oversight, and the clearest trend visibility stay limited\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /After you click, secure checkout opens so you can review the Monthly Elite plan, confirm billing details, and choose whether to complete the upgrade\./i
      )
    ).toBeInTheDocument();
    expect(mocks.trackMock).toHaveBeenCalledWith("billing_page_opened", {
      currentPlan: "pro",
      surface: "billing_page",
      route: "/",
    });
    expect(mocks.billingPlansPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPlan: "pro",
        recommendedPlan: "elite",
      })
    );
  });
});
