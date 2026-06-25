import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LandlordLeaseWorkflowPage from "./LandlordLeaseWorkflowPage";

const mocks = vi.hoisted(() => ({
  getLeaseById: vi.fn(),
}));

vi.mock("@/api/leasesApi", () => ({
  getLeaseById: mocks.getLeaseById,
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
    mocks.getLeaseById.mockResolvedValue({
      lease: {
        id: "lease-1",
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
    expect(screen.getByLabelText("Workflow overview")).toHaveStyle({
      background: "#f8fafc",
      borderRadius: "8px",
    });
  });

  it("preserves the lease renewal workflow and links to portfolio renewal inputs", async () => {
    renderWorkflow("/leases/lease-1/workflows/renewal");

    expect(await screen.findByRole("heading", { name: "Renewal Review" })).toBeInTheDocument();
    expect(screen.getByText("Review lease end timing and renewal context before deciding on renewal, continuation, or move-out next steps.")).toBeInTheDocument();
    expect(screen.getByText("Expiring soon")).toBeInTheDocument();
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Renewal operator inputs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open renewal inputs" })).toHaveAttribute(
      "href",
      "/portfolio-health?entry=lease-renewals&propertyId=prop-1"
    );
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
    expect(screen.getByText("December 31, 2099")).toBeInTheDocument();
    expect(screen.getByText("Lifecycle summary pending")).toBeInTheDocument();
    expect(screen.getByText(/days$/)).toBeInTheDocument();
    expect(screen.queryByText("Not available")).not.toBeInTheDocument();
  });
});
