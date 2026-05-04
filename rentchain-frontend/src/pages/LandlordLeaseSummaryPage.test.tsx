import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LandlordLeaseSummaryPage from "./LandlordLeaseSummaryPage";

const mocks = vi.hoisted(() => ({
  getLeaseById: vi.fn(),
}));

vi.mock("@/api/leasesApi", () => ({
  getLeaseById: mocks.getLeaseById,
}));

describe("LandlordLeaseSummaryPage", () => {
  beforeEach(() => {
    mocks.getLeaseById.mockReset();
    mocks.getLeaseById.mockResolvedValue({
      lease: {
        id: "lease-1",
        propertyId: "prop-1",
        propertyName: "Coburg Rd",
        unitNumber: "3",
        monthlyRent: 2100,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
        tenantName: "Tony Wenpeng",
        tenantEmail: "tony@example.com",
        documentUrl: null,
        paymentReadiness: {
          readinessStatus: "ready_to_configure",
          readinessLabel: "Rent terms ready for future setup",
          readinessDescription: "The current lease shows the rent terms needed for a future setup workflow.",
          requiredNextAction: "confirm_payment_setup_later",
          rentTerms: {
            rentAmountAvailable: true,
            dueDateAvailable: true,
            leaseDatesAvailable: true,
            tenantLinked: true,
            leaseExecuted: false,
          },
          paymentSetup: {
            processorConnected: false,
            moneyMovementEnabled: false,
            storedPaymentMethod: false,
          },
        },
        leaseLifecycleSummary: {
          lifecycleStatus: "expiring_soon",
          lifecycleLabel: "Expiring soon",
          lifecycleDescription: "This lease is approaching notice timing.",
          requiredNextAction: "prepare_renewal_notice",
          renewalOutcome: "not_started",
          history: [],
        },
      },
    });

    global.URL.createObjectURL = vi.fn(() => "blob:lease-summary");
    global.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders landlord-safe lease details without exposing storage paths", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Lease summary")).toBeInTheDocument();
    expect(screen.getByTestId("lease-document-view")).toBeInTheDocument();
    expect(screen.getByText("Residential Lease Pack")).toBeInTheDocument();
    expect(screen.getByText("Property and Unit")).toBeInTheDocument();
    expect(screen.getByText("Landlord and Tenant")).toBeInTheDocument();
    expect(screen.getByText("Lease Term")).toBeInTheDocument();
    expect(screen.getByText("Rent and Payment Terms")).toBeInTheDocument();
    expect(screen.getByText("Clauses and Additional Terms")).toBeInTheDocument();
    expect(screen.getByText("Audit and Events")).toBeInTheDocument();
    expect(mocks.getLeaseById).toHaveBeenCalledWith("lease-1");
    expect(screen.getByText("Coburg Rd")).toBeInTheDocument();
    expect(screen.getByText("Tony Wenpeng")).toBeInTheDocument();
    expect(screen.queryByText(/gs:\/\//i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open ledger" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByRole("link", { name: "Back to leases" })).toHaveAttribute("href", "/leases");
  });

  it("keeps save lease summary available for missing-document leases", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Save lease summary" }));

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });
  });
});
