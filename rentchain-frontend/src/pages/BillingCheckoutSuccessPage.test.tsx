import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BillingCheckoutSuccessPage from "./BillingCheckoutSuccessPage";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  clearUpgradePromptMock: vi.fn(),
  showToastMock: vi.fn(),
  refreshEntitlementsMock: vi.fn(),
  fetchCheckoutSessionStatusMock: vi.fn(),
}));

vi.mock("@/context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("@/context/UpgradeContext", () => ({
  useUpgrade: () => ({
    clearUpgradePrompt: mocks.clearUpgradePromptMock,
  }),
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({
    showToast: mocks.showToastMock,
  }),
}));

vi.mock("@/lib/entitlements", () => ({
  refreshEntitlements: mocks.refreshEntitlementsMock,
}));

vi.mock("@/api/billingApi", () => ({
  fetchCheckoutSessionStatus: mocks.fetchCheckoutSessionStatusMock,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BillingCheckoutSuccessPage", () => {
  beforeEach(() => {
    mocks.useAuthMock.mockReturnValue({
      updateUser: vi.fn(),
    });
    mocks.refreshEntitlementsMock.mockResolvedValue(undefined);
  });

  function renderPage(initialEntry: string) {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/billing/checkout-success" element={<BillingCheckoutSuccessPage />} />
          <Route path="/dashboard" element={<div>Dashboard destination</div>} />
          <Route path="/properties" element={<div>Properties destination</div>} />
          <Route path="/billing" element={<div>Billing destination</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("renders a success state for a verified paid checkout session", async () => {
    mocks.fetchCheckoutSessionStatusMock.mockResolvedValue({
      ok: true,
      sessionId: "cs_123",
      status: "complete",
      payment_status: "paid",
      plan: "starter",
      interval: "monthly",
    });

    renderPage("/billing/checkout-success?session_id=cs_123&redirectTo=%2Fproperties");

    expect(screen.getByText("Confirming upgrade")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Upgrade confirmed")).toBeInTheDocument());
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue setup" })).toBeInTheDocument();
    expect(mocks.refreshEntitlementsMock).toHaveBeenCalledTimes(1);
    expect(mocks.clearUpgradePromptMock).toHaveBeenCalledTimes(1);
  });

  it("renders a failsafe state when the session id is missing", async () => {
    renderPage("/billing/checkout-success");

    expect(screen.getByText("Upgrade not confirmed")).toBeInTheDocument();
    expect(
      screen.getByText(/because the checkout session ID is missing/i)
    ).toBeInTheDocument();
    expect(mocks.fetchCheckoutSessionStatusMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Return to billing" })).toBeInTheDocument();
  });

  it("keeps the loading state visible until verification resolves", async () => {
    let resolveRequest: ((value: unknown) => void) | null = null;
    mocks.fetchCheckoutSessionStatusMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    renderPage("/billing/checkout-success?session_id=cs_123");

    expect(screen.getByText("Confirming upgrade")).toBeInTheDocument();
    expect(screen.getByText(/confirming your Stripe checkout/i)).toBeInTheDocument();

    resolveRequest?.({
      ok: true,
      sessionId: "cs_123",
      status: "complete",
      payment_status: "paid",
      plan: "pro",
      interval: "monthly",
    });

    await waitFor(() => expect(screen.getByText("Upgrade confirmed")).toBeInTheDocument());
  });

  it("routes the failsafe CTA back to billing when verification fails", async () => {
    mocks.fetchCheckoutSessionStatusMock.mockRejectedValue(new Error("session not found"));

    renderPage("/billing/checkout-success?session_id=cs_missing");

    await waitFor(() => expect(screen.getByText("Upgrade not confirmed")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Return to billing" }));
    expect(screen.getByText("Billing destination")).toBeInTheDocument();
  });
});
