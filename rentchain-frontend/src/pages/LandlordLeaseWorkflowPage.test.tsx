import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LandlordLeaseWorkflowPage from "./LandlordLeaseWorkflowPage";

const mocks = vi.hoisted(() => ({
  getLeaseById: vi.fn(),
  fetchExpiringLeaseRenewals: vi.fn(),
  saveLeaseRenewalInputs: vi.fn(),
}));

vi.mock("@/api/leasesApi", () => ({
  getLeaseById: mocks.getLeaseById,
}));

vi.mock("@/api/landlordLeaseRenewalApi", () => ({
  fetchExpiringLeaseRenewals: mocks.fetchExpiringLeaseRenewals,
  saveLeaseRenewalInputs: mocks.saveLeaseRenewalInputs,
}));

function renderWorkflow(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/leases/:leaseId/workflows/:workflowKey" element={<LandlordLeaseWorkflowPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LandlordLeaseWorkflowPage", () => {
  beforeEach(() => {
    mocks.getLeaseById.mockReset();
    mocks.fetchExpiringLeaseRenewals.mockReset();
    mocks.saveLeaseRenewalInputs.mockReset();
    mocks.getLeaseById.mockResolvedValue({
      lease: {
        id: "lease-1",
        tenantId: "tenant-1",
        propertyId: "prop-1",
        propertyName: "Harbour View",
        unitNumber: "101",
        monthlyRent: 1850,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
        tenantName: "Jane Tenant",
        tenantEmail: "jane@example.com",
        leaseExecution: {
          executionStatus: "fully_executed",
          executionLabel: "Lease fully executed",
          executionDescription: "The visible lease record indicates the current execution flow is complete.",
          requiredNextAction: "none",
          tenantSignatureStatus: "completed",
          landlordSignatureStatus: "completed",
          pdfStatus: "generated",
          completedAt: "2026-01-01T00:00:00.000Z",
        },
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
            leaseExecuted: true,
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
          daysUntilExpiry: 30,
          history: [],
        },
        jurisdictionPolicies: [
          {
            jurisdiction: "NS",
            policyKey: "rent_increase_workflow_availability",
            status: "ok",
            severity: "info",
            label: "Rent increase workflow metadata available",
            reason: "This jurisdiction has rent increase workflow metadata configured for operational review.",
            recommendation: "Use the guided workflow as a review aid and verify current local requirements before sending notices.",
            sourceRuleKey: "NS.rent_increase_workflow",
            confidence: "medium",
            legalAdvice: false,
            disclaimer:
              "RentChain provides operational workflow guidance only. It does not provide legal advice, create legal conclusions, or replace review of current provincial forms and rules.",
          },
          {
            jurisdiction: "NS",
            policyKey: "deposit_workflow_review",
            status: "review",
            severity: "info",
            label: "Deposit workflow review available",
            reason: "This jurisdiction has deposit workflow metadata flagged for operational review.",
            recommendation: "Review deposit handling as part of the lease workflow without treating this as a compliance determination.",
            sourceRuleKey: "NS.deposit_workflow_review",
            confidence: "medium",
            legalAdvice: false,
            disclaimer:
              "RentChain provides operational workflow guidance only. It does not provide legal advice, create legal conclusions, or replace review of current provincial forms and rules.",
          },
        ],
      },
    });
    mocks.fetchExpiringLeaseRenewals.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          propertyAddress: "12 Harbour Road",
          unitId: "unit-1",
          status: "active",
          leaseType: "fixed_term",
          province: "NS",
          leaseStartDate: "2026-01-01",
          leaseEndDate: "2026-12-31",
          currentRent: 1850,
          currency: "CAD",
          nextNoticeDueAt: null,
          latestNoticeId: null,
          tenantName: "Jane Tenant",
          unitLabel: "Unit 101",
          propertyLabel: "Harbour View",
          renewalRentChangeMode: "increase",
          renewalOfferedRent: 1975,
          renewalDecisionDeadlineAt: Date.UTC(2026, 10, 15, 13, 30, 0, 0),
          renewalNewTermType: "fixed_term",
          renewalNewLeaseStartDate: "2027-01-01",
          renewalNewLeaseEndDate: "2027-12-31",
          renewalUpdatedAt: "2026-07-01T12:00:00.000Z",
          leaseLifecycleSummary: {
            lifecycleStatus: "expiring_soon",
            lifecycleLabel: "Expiring soon",
            lifecycleDescription: "This lease is approaching notice timing.",
            requiredNextAction: "prepare_renewal_notice",
            renewalOutcome: "not_started",
            daysUntilExpiry: 30,
            history: [],
          },
        },
      ],
      data: [],
    });
    mocks.saveLeaseRenewalInputs.mockResolvedValue({
      ok: true,
      lease: {
        id: "lease-1",
        tenantId: "tenant-1",
        propertyId: "prop-1",
        propertyAddress: "12 Harbour Road",
        unitId: "unit-1",
        status: "active",
        leaseType: "fixed_term",
        province: "NS",
        leaseStartDate: "2026-01-01",
        leaseEndDate: "2026-12-31",
        currentRent: 1850,
        currency: "CAD",
        nextNoticeDueAt: null,
        latestNoticeId: null,
        tenantName: "Jane Tenant",
        unitLabel: "Unit 101",
        propertyLabel: "Harbour View",
        renewalRentChangeMode: "no_change",
        renewalOfferedRent: null,
        renewalDecisionDeadlineAt: Date.UTC(2026, 10, 20, 14, 0, 0, 0),
        renewalNewTermType: "month_to_month",
        renewalNewLeaseStartDate: "2027-01-01",
        renewalNewLeaseEndDate: "",
        renewalUpdatedAt: "2026-07-02T12:00:00.000Z",
      },
      renewalInputs: {
        rentChangeMode: "no_change",
        proposedRent: null,
        newTermType: "month_to_month",
        newLeaseStartDate: "2027-01-01",
        newLeaseEndDate: null,
        responseDeadlineAt: Date.UTC(2026, 10, 20, 14, 0, 0, 0),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a focused rent increase workflow review", async () => {
    renderWorkflow("/leases/lease-1/workflows/rent-increase");

    expect(await screen.findByRole("heading", { name: "Rent Increase Workflow" })).toBeInTheDocument();
    expect(screen.getByText("Review rent terms and jurisdiction-aware rent increase readiness before preparing any notice.")).toBeInTheDocument();
    expect(screen.getByText("CA$1,850.00")).toBeInTheDocument();
    expect(screen.getByText("Use the guided workflow as a review aid and verify current local requirements before sending notices.")).toBeInTheDocument();
    expect(screen.getByText(/RentChain does not provide legal advice or guarantee enforceability/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lease summary" })).toHaveAttribute("href", "/leases/lease-1/summary");
  });

  it("renders deposit as a distinct review destination", async () => {
    renderWorkflow("/leases/lease-1/workflows/deposit");

    expect(await screen.findByRole("heading", { name: "Deposit Workflow" })).toBeInTheDocument();
    expect(screen.getByText("Review deposit handling context separately from rent collection and general lease summary details.")).toBeInTheDocument();
    expect(screen.getByText("Review deposit handling as part of the lease workflow without treating this as a compliance determination.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Rent Increase Workflow" })).not.toBeInTheDocument();
  });

  it("renders notice and execution workflow pages with separate purposes", async () => {
    renderWorkflow("/leases/lease-1/workflows/notice");
    expect(await screen.findByRole("heading", { name: "Notice Workflow" })).toBeInTheDocument();
    expect(screen.getByText("Review notice-related lease status, lifecycle timing, and audit context before preparing a notice.")).toBeInTheDocument();

    cleanup();
    renderWorkflow("/leases/lease-1/workflows/execution");
    expect(await screen.findByRole("heading", { name: "Execution Review" })).toBeInTheDocument();
    expect(screen.getByText("Review the lease package, signature state, and document readiness before treating execution as complete.")).toBeInTheDocument();
    expect(screen.getByTestId("lease-workflow-page")).toHaveStyle({ maxWidth: "1040px" });
    expect(screen.getByTestId("lease-workflow-page")).toHaveStyle({
      margin: "0 auto",
      boxSizing: "border-box",
    });
    expect(screen.getByLabelText("Workflow overview")).toHaveStyle({
      background: "#fff6e8",
      borderRadius: "14px",
    });
  });

  it("renders editable renewal operator inputs with prefilled values and source link", async () => {
    renderWorkflow("/leases/lease-1/workflows/renewal");

    expect(await screen.findByRole("heading", { name: "Renewal Review" })).toBeInTheDocument();
    expect(screen.getByText("Review lease end timing and renewal context before deciding on renewal, continuation, or move-out next steps.")).toBeInTheDocument();
    expect(screen.getAllByText("Expiring soon").length).toBeGreaterThan(0);
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Renewal operator inputs" })).toBeInTheDocument();
    const sourceContext = screen.getByLabelText("Renewal source context");
    expect(sourceContext).toHaveTextContent("Portfolio renewal context for this lease, scoped to the property source view.");
    expect(sourceContext).toHaveTextContent("Harbour View");
    expect(sourceContext).toHaveTextContent("Unit 101 · Jane Tenant");
    expect(sourceContext).toHaveTextContent("December 31, 2026");
    expect(sourceContext).toHaveTextContent("Next 30 days · 30 days to lease end");
    expect(sourceContext).toHaveTextContent("Expiring soon");
    expect(sourceContext).toHaveTextContent(/Review the renewal planning window and check jurisdiction requirements/i);
    expect(screen.getByRole("link", { name: "Open portfolio renewal view" })).toHaveAttribute(
      "href",
      "/portfolio-health?entry=lease-renewals&propertyId=prop-1"
    );
    expect(await screen.findByLabelText(/Rent change mode/i)).toHaveValue("increase");
    expect(mocks.fetchExpiringLeaseRenewals).toHaveBeenCalledWith({ propertyId: "prop-1" });
    expect(screen.getByLabelText("Current rent")).toHaveTextContent(/1,850/);
    expect(screen.getByText("Compare proposed rent against the current lease rent before saving renewal inputs.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Proposed rent/i)).toHaveValue(1975);
    expect(screen.getByLabelText(/New term type/i)).toHaveValue("fixed_term");
    expect(screen.getByLabelText(/New lease start date/i)).toHaveValue("2027-01-01");
    expect(screen.getByLabelText(/New lease end date/i)).toHaveValue("2027-12-31");
    expect(screen.getByLabelText(/Response deadline/i)).toHaveValue("2026-11-15T09:30");
    expect(screen.getByRole("button", { name: "Save renewal inputs" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tenant notice email workflow")).toHaveTextContent(
      "Tenant-facing renewal notices are not sent from this workflow yet."
    );
    expect(screen.queryByRole("button", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("/portfolio-health?entry=lease-renewals&propertyId=prop-1");
  });

  it("shows current rent unavailable when renewal projection rent is missing", async () => {
    mocks.fetchExpiringLeaseRenewals.mockResolvedValueOnce({
      ok: true,
      items: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          propertyAddress: "12 Harbour Road",
          unitId: "unit-1",
          status: "active",
          leaseType: "fixed_term",
          province: "NS",
          leaseStartDate: "2026-01-01",
          leaseEndDate: "2026-12-31",
          currentRent: null,
          currency: "CAD",
          nextNoticeDueAt: null,
          latestNoticeId: null,
          tenantName: "Jane Tenant",
          unitLabel: "Unit 101",
          propertyLabel: "Harbour View",
          renewalRentChangeMode: "undecided",
          renewalOfferedRent: null,
          renewalDecisionDeadlineAt: null,
          renewalNewTermType: null,
          renewalNewLeaseStartDate: null,
          renewalNewLeaseEndDate: null,
        },
      ],
      data: [],
    });

    renderWorkflow("/leases/lease-1/workflows/renewal");

    expect(await screen.findByLabelText("Current rent")).toHaveTextContent("Current rent unavailable");
    expect(screen.getByText("Review lease terms before changing rent.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save renewal inputs" })).toBeInTheDocument();
  });

  it("saves renewal operator inputs through the existing lease renewal save behavior", async () => {
    renderWorkflow("/leases/lease-1/workflows/renewal");

    expect(await screen.findByLabelText(/Rent change mode/i)).toHaveValue("increase");
    fireEvent.change(screen.getByLabelText(/Rent change mode/i), { target: { value: "no_change" } });
    fireEvent.change(screen.getByLabelText(/New term type/i), { target: { value: "month_to_month" } });
    fireEvent.change(screen.getByLabelText(/New lease start date/i), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText(/New lease end date/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/Response deadline/i), { target: { value: "2026-11-20T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save renewal inputs" }));

    await waitFor(() => {
      expect(mocks.saveLeaseRenewalInputs).toHaveBeenCalledWith(
        "lease-1",
        expect.objectContaining({
          rentChangeMode: "no_change",
          proposedRent: null,
          newTermType: "month_to_month",
          newLeaseStartDate: "2027-01-01",
          newLeaseEndDate: null,
        })
      );
    });
    expect(await screen.findByText("Lease renewal inputs saved.")).toBeInTheDocument();
  });

  it("shows a clear save failure state for renewal operator inputs", async () => {
    mocks.saveLeaseRenewalInputs.mockRejectedValueOnce(new Error("INVALID_RESPONSE_DEADLINE"));
    renderWorkflow("/leases/lease-1/workflows/renewal");

    expect(await screen.findByLabelText(/Rent change mode/i)).toHaveValue("increase");
    fireEvent.click(screen.getByRole("button", { name: "Save renewal inputs" }));

    expect(await screen.findByText("Failed to save renewal inputs: Enter a valid response deadline.")).toBeInTheDocument();
  });

  it("shows a compact unavailable renewal source state when the lease has no property link", async () => {
    mocks.getLeaseById.mockResolvedValueOnce({
      lease: {
        id: "lease-missing-property",
        propertyId: null,
        propertyName: null,
        propertyLabel: null,
        propertyAddress: null,
        unitNumber: "202",
        monthlyRent: 1650,
        startDate: "2026-01-01",
        endDate: "2026-10-31",
        status: "active",
        tenantName: "No Property Tenant",
        tenantEmail: "tenant@example.com",
        leaseExecution: null,
        paymentReadiness: null,
        leaseLifecycleSummary: {
          lifecycleStatus: "expiring_soon",
          lifecycleLabel: "Expiring soon",
          lifecycleDescription: "This lease is approaching renewal planning review.",
          requiredNextAction: "prepare_renewal_notice",
          renewalOutcome: "not_started",
          daysUntilExpiry: 45,
          history: [],
        },
        jurisdictionPolicies: [],
      },
    });

    renderWorkflow("/leases/lease-missing-property/workflows/renewal");

    expect(await screen.findByRole("heading", { name: "Renewal Review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Renewal operator inputs" })).toBeInTheDocument();
    const sourceContext = screen.getByLabelText("Renewal source context");
    expect(sourceContext).toHaveTextContent(
      "Portfolio renewal context is not available because this lease is not linked to a property."
    );
    expect(screen.getByText("Renewal operator inputs cannot be loaded until this lease is linked to a property.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open portfolio renewal view" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save renewal inputs" })).not.toBeInTheDocument();
    expect(mocks.fetchExpiringLeaseRenewals).not.toHaveBeenCalled();
    expect(screen.getByText("45 days")).toBeInTheDocument();
  });

  it("uses lease end date fallback copy when lifecycle summary is absent", async () => {
    mocks.getLeaseById.mockResolvedValueOnce({
      lease: {
        id: "lease-no-summary",
        propertyId: "prop-1",
        propertyName: "Harbour View",
        unitNumber: "101",
        monthlyRent: 1850,
        startDate: "2026-01-01",
        endDate: "2099-12-31",
        status: "active",
        tenantName: "Jane Tenant",
        tenantEmail: "jane@example.com",
        leaseExecution: null,
        paymentReadiness: null,
        jurisdictionPolicies: [],
      },
    });

    renderWorkflow("/leases/lease-no-summary/workflows/renewal");

    expect(await screen.findByRole("heading", { name: "Renewal Review" })).toBeInTheDocument();
    expect(screen.getAllByText("December 31, 2099").length).toBeGreaterThan(0);
    expect(screen.getByText("Lifecycle summary pending")).toBeInTheDocument();
    expect(screen.getByText(/days$/)).toBeInTheDocument();
    expect(screen.queryByText("Not available")).not.toBeInTheDocument();
  });
});
