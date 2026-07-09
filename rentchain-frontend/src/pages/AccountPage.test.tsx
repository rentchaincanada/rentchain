import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AccountPage from "./AccountPage";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useBillingStatusMock: vi.fn(),
  billingTierLabelMock: vi.fn(),
  useAccountSummaryMock: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("@/hooks/useBillingStatus", () => ({
  useBillingStatus: mocks.useBillingStatusMock,
  billingTierLabel: mocks.billingTierLabelMock,
}));

vi.mock("./account/useAccountSummary", () => ({
  useAccountSummary: mocks.useAccountSummaryMock,
}));

vi.mock("@/billing/openUpgradeFlow", () => ({
  openUpgradeFlow: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe("AccountPage", () => {
  beforeEach(() => {
    mocks.useAuthMock.mockReturnValue({
      user: { email: "owner@example.com" },
    });
    mocks.useBillingStatusMock.mockReturnValue({
      tier: "elite",
      interval: "month",
      renewalDate: null,
      isLoading: false,
    });
    mocks.billingTierLabelMock.mockReturnValue("Elite");
    mocks.useAccountSummaryMock.mockReturnValue({
      loading: false,
      error: null,
      summary: {
        status: "active",
        nextRenewalAt: null,
        lastInvoiceAt: null,
        lastInvoiceAmountCents: null,
        receiptsCount: 0,
      },
    });
  });

  it("uses the billing status plan label in both account surfaces", () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Signed in as owner@example.com · Plan: Elite/)).toBeInTheDocument();
    expect(screen.getAllByText("Elite").length).toBeGreaterThan(0);
    expect(screen.queryByText("free")).not.toBeInTheDocument();
    expect(
      screen.getByText("Uses the same billing access level shown in your workspace and checkout flow.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Security controls coming soon" })).toBeDisabled();
    expect(screen.getByText("Delegated Access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage delegates" })).toBeInTheDocument();
    expect(screen.getByText("PM Company Management")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage PM companies" })).toBeInTheDocument();
    expect(document.querySelector(".rc-account-page")).toHaveClass("rc-account-billing-surface");
    expect(screen.getByRole("button", { name: "Profile" })).toHaveClass("rc-account-secondary-action");
  });
});
