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
    expect(screen.getByText(/Pro includes exports, reporting, and team workflows/)).toBeInTheDocument();
    expect(mocks.trackMock).toHaveBeenCalledWith("billing_page_opened", {
      currentPlan: "pro",
      surface: "billing_page",
      route: "/",
    });
  });
});
