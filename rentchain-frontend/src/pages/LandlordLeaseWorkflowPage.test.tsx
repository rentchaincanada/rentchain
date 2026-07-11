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

function dateInputValue(value: number) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputValueToMs(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
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
    const noticeReview = await screen.findByLabelText("Renewal notice review");
    await waitFor(() => {
      expect(noticeReview).toHaveTextContent("Draft ready");
    });
    expect(noticeReview).toHaveTextContent("Review renewal notice preparation");
    expect(noticeReview).toHaveTextContent("Email delivery");
    expect(noticeReview).toHaveTextContent("Deferred");
    expect(noticeReview).toHaveTextContent("Evidence capture");
    expect(noticeReview).toHaveTextContent("Audit capture");
    expect(noticeReview).toHaveTextContent("Jane Tenant");
    expect(noticeReview).toHaveTextContent("12 Harbour Road · Unit 101");
    expect(noticeReview).toHaveTextContent("CA$1,850.00");
    expect(noticeReview).toHaveTextContent("CA$1,975.00");
    expect(noticeReview).toHaveTextContent("Fixed term · January 1, 2027 to December 31, 2027");
    expect(noticeReview).toHaveTextContent("Tenant response target date");
    expect((screen.getByLabelText("Tenant notice draft preview") as HTMLTextAreaElement).value).toContain(
      "This message is for renewal planning and review."
    );
    expect(screen.getByRole("link", { name: "Back to renewal workflow" })).toHaveAttribute(
      "href",
      "/leases/lease-1/workflows/renewal"
    );
    expect(screen.getByRole("link", { name: "Return to renewal inputs" })).toHaveAttribute(
      "href",
      "/leases/lease-1/workflows/renewal"
    );
    expect(screen.getByRole("link", { name: "Open lease evidence preview" })).toHaveAttribute(
      "href",
      "/evidence-packs?scope=lease&scopeId=lease-1"
    );
    expect(screen.getByRole("link", { name: "Open lease review timeline" })).toHaveAttribute(
      "href",
      "/review-timeline?scope=lease&scopeId=lease-1"
    );
    expect(screen.getByRole("button", { name: "Copy draft text" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/audit event created|evidence saved|notice served|tenant notified|email sent/i);

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

  it("shows notice review inputs-needed state without draft actions", async () => {
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
          currentRent: 1850,
          currency: "CAD",
          nextNoticeDueAt: null,
          latestNoticeId: null,
          tenantName: "Jane Tenant",
          unitLabel: "Unit 101",
          propertyLabel: "Harbour View",
          renewalRentChangeMode: null,
          renewalOfferedRent: null,
          renewalDecisionDeadlineAt: null,
          renewalNewTermType: null,
          renewalNewLeaseStartDate: null,
          renewalNewLeaseEndDate: null,
          renewalUpdatedAt: null,
        },
      ],
      data: [],
    });

    renderWorkflow("/leases/lease-1/workflows/notice");

    const noticeReview = await screen.findByLabelText("Renewal notice review");
    await waitFor(() => {
      expect(noticeReview).toHaveTextContent("Inputs needed");
    });
    expect(noticeReview).toHaveTextContent("Save renewal operator inputs before reviewing tenant-facing notice preparation.");
    expect(noticeReview).toHaveTextContent("Missing: rent change mode, new term type, new lease start date, new lease end date, tenant response target date.");
    expect(screen.queryByLabelText("Tenant notice draft preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy draft text" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download draft" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to renewal inputs" })).toHaveAttribute(
      "href",
      "/leases/lease-1/workflows/renewal"
    );
    expect(screen.queryByRole("button", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
  });

  it("blocks notice review draft actions when renewal term dates are invalid", async () => {
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
          currentRent: 1850,
          currency: "CAD",
          nextNoticeDueAt: null,
          latestNoticeId: null,
          tenantName: "Jane Tenant",
          unitLabel: "Unit 101",
          propertyLabel: "Harbour View",
          renewalRentChangeMode: "increase",
          renewalOfferedRent: 1975,
          renewalDecisionDeadlineAt: dateInputValueToMs("2026-11-20"),
          renewalNewTermType: "fixed_term",
          renewalNewLeaseStartDate: "2036-09-01",
          renewalNewLeaseEndDate: "2027-08-31",
          renewalUpdatedAt: "2026-07-02T12:00:00.000Z",
        },
      ],
      data: [],
    });

    renderWorkflow("/leases/lease-1/workflows/notice");

    const noticeReview = await screen.findByLabelText("Renewal notice review");
    await waitFor(() => {
      expect(noticeReview).toHaveTextContent("Invalid renewal term dates");
    });
    expect(noticeReview).toHaveTextContent(
      "Review renewal term dates before preparing a tenant notice draft. The new lease start date must be on or before the new lease end date."
    );
    expect(noticeReview).not.toHaveTextContent("Draft ready");
    expect(screen.queryByLabelText("Tenant notice draft preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy draft text" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download draft" })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/must respond by|notice has been served|legally valid|automatically compliant/i);
  });

  it("copies the notice review draft without sending, saving, or creating notice records", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderWorkflow("/leases/lease-1/workflows/notice");

    const draftPreview = (await screen.findByLabelText("Tenant notice draft preview")) as HTMLTextAreaElement;
    expect(draftPreview.value).toContain("Hello Jane Tenant,");
    fireEvent.click(screen.getByRole("button", { name: "Copy draft text" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("This message is for renewal planning and review."));
    });
    expect(await screen.findByText("Draft text copied.")).toBeInTheDocument();
    expect(mocks.saveLeaseRenewalInputs).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/audit event created|evidence saved|notice served|tenant notified|email sent/i);
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
    expect(screen.getByLabelText(/Tenant response target date/i)).toHaveValue(
      dateInputValue(Date.UTC(2026, 10, 15, 13, 30, 0, 0))
    );
    expect(screen.getByText("Planning date only. Does not send notice or determine legal deadlines.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Response deadline/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save renewal inputs" })).toBeInTheDocument();
    expect(screen.getByLabelText("Renewal workflow status")).toHaveTextContent("Operator inputs saved");
    expect(screen.getByLabelText("Renewal workflow status")).toHaveTextContent("Tenant notice draft ready");
    expect(screen.getByLabelText("Renewal workflow status")).toHaveTextContent("Notice review pending");
    expect(screen.getByLabelText("Renewal workflow status")).toHaveTextContent("Email delivery deferred");
    expect(screen.getByLabelText("Tenant renewal notice draft")).toHaveTextContent("Draft ready");
    expect(screen.getByLabelText("Tenant renewal notice draft")).toHaveTextContent("Jane Tenant");
    expect(screen.getByLabelText("Tenant renewal notice draft")).toHaveTextContent("12 Harbour Road · Unit 101");
    expect(screen.getByLabelText("Tenant renewal notice draft")).toHaveTextContent("CA$1,850.00");
    expect(screen.getByLabelText("Tenant renewal notice draft")).toHaveTextContent("CA$1,975.00");
    const draftPreview = screen.getByLabelText("Draft message preview") as HTMLTextAreaElement;
    expect(draftPreview.value).toContain("Hello Jane Tenant,");
    expect(draftPreview.value).toContain("We are preparing renewal details for 12 Harbour Road · Unit 101.");
    expect(draftPreview.value).toContain("The new fixed term would begin on January 1, 2027 and end on December 31, 2027.");
    expect(draftPreview.value).toContain("The rent for the unit you occupy would be CA$1,975.00.");
    expect(draftPreview.value).not.toMatch(/\bwill be\b/i);
    expect(draftPreview.value).not.toContain("renewal rent entered for review");
    expect(draftPreview.value).not.toContain("with a term from");
    expect(draftPreview.value).toContain("tenant response target date recorded for internal follow-up");
    expect(draftPreview.value).toMatch(/tenant response target date recorded for internal follow-up is .*?\./);
    expect(draftPreview.value).not.toContain("Please review these proposed renewal details");
    expect((draftPreview.value.match(/\bproposed\b/gi) || []).length).toBeLessThanOrEqual(1);
    expect(screen.getByText(/Email delivery is not enabled from this workflow yet/i)).toBeInTheDocument();
    const evidenceReadiness = screen.getByLabelText("Evidence readiness");
    expect(evidenceReadiness).toHaveTextContent("Evidence readiness");
    expect(evidenceReadiness).toHaveTextContent("Operational record only");
    expect(evidenceReadiness).toHaveTextContent("Draft prepared from saved renewal inputs");
    expect(evidenceReadiness).toHaveTextContent("Review values before tenant communication");
    expect(evidenceReadiness).toHaveTextContent("Jane Tenant");
    expect(evidenceReadiness).toHaveTextContent("12 Harbour Road · Unit 101");
    expect(evidenceReadiness).toHaveTextContent("CA$1,850.00");
    expect(evidenceReadiness).toHaveTextContent("CA$1,975.00");
    expect(evidenceReadiness).toHaveTextContent("December 31, 2026");
    expect(evidenceReadiness).toHaveTextContent("Fixed term · January 1, 2027 to December 31, 2027");
    expect(evidenceReadiness).toHaveTextContent("Tenant response target date");
    expect(evidenceReadiness).toHaveTextContent("Copy/download actions are available for review");
    expect(evidenceReadiness).toHaveTextContent("Email delivery not enabled");
    expect(evidenceReadiness).toHaveTextContent("Draft evidence is not persisted yet");
    expect(evidenceReadiness).toHaveTextContent("Audit capture deferred");
    expect(evidenceReadiness).toHaveTextContent("Evidence package inclusion deferred");
    expect(evidenceReadiness).toHaveTextContent("this draft text is not saved to an evidence package or audit trail yet");
    expect(screen.getByRole("link", { name: "Open lease evidence preview" })).toHaveAttribute(
      "href",
      "/evidence-packs?scope=lease&scopeId=lease-1"
    );
    expect(screen.getByRole("link", { name: "Open lease review timeline" })).toHaveAttribute(
      "href",
      "/review-timeline?scope=lease&scopeId=lease-1"
    );
    expect(screen.getByRole("link", { name: "Open notice review workflow" })).toHaveAttribute(
      "href",
      "/leases/lease-1/workflows/notice"
    );
    expect(screen.getByRole("button", { name: "Copy draft text" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/must respond by|notice has been served|legally valid|automatically compliant/i);
    expect(document.body).not.toHaveTextContent(/audit event created|evidence saved|notice served|tenant notified|email sent/i);
    expect(document.body).not.toHaveTextContent("/portfolio-health?entry=lease-renewals&propertyId=prop-1");
  });

  it("uses workflow-local renewal status instead of stale no-follow-up lifecycle copy", async () => {
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
          currentRent: 1850,
          currency: "CAD",
          nextNoticeDueAt: null,
          latestNoticeId: null,
          tenantName: "Jane Tenant",
          unitLabel: "Unit 101",
          propertyLabel: "Harbour View",
          renewalRentChangeMode: "increase",
          renewalOfferedRent: 1975,
          renewalDecisionDeadlineAt: dateInputValueToMs("2026-11-20"),
          renewalNewTermType: "fixed_term",
          renewalNewLeaseStartDate: "2027-01-01",
          renewalNewLeaseEndDate: "2027-12-31",
          renewalUpdatedAt: "2026-07-02T12:00:00.000Z",
          leaseLifecycleSummary: {
            lifecycleStatus: "active",
            lifecycleLabel: "Active",
            lifecycleDescription: "Lease is active.",
            requiredNextAction: "none",
            renewalOutcome: "not_applicable",
            daysUntilExpiry: 30,
            history: [{ type: "lease_started", label: "Lease started", at: "2026-01-01" }],
          },
        },
      ],
      data: [],
    });

    renderWorkflow("/leases/lease-1/workflows/renewal");

    const statusPanel = await screen.findByLabelText("Renewal workflow status");
    expect(statusPanel).toHaveTextContent("Operator inputs saved");
    expect(statusPanel).toHaveTextContent("Tenant notice draft ready");
    expect(statusPanel).toHaveTextContent("Notice review pending");
    expect(statusPanel).toHaveTextContent("Email delivery deferred");
    expect(screen.getByLabelText("Tenant renewal notice draft")).toHaveTextContent("Draft ready");
    expect(document.body).not.toHaveTextContent("Outcome: Not applicable");
    expect(document.body).not.toHaveTextContent("Next step: No follow-up needed");
    expect(document.body).not.toHaveTextContent("History: Lease started");
  });

  it("uses safe draft fallbacks when tenant name is missing and projection labels are raw", async () => {
    mocks.getLeaseById.mockResolvedValueOnce({
      lease: {
        id: "lease-raw-labels",
        tenantId: "tenant-raw",
        propertyId: "36DDfE1QldevOrw9wVyR",
        propertyName: "center suites",
        propertyAddress: "32 central road",
        unitNumber: "4",
        monthlyRent: 1850,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
        tenantName: null,
        tenantEmail: null,
        leaseExecution: null,
        paymentReadiness: null,
        leaseLifecycleSummary: {
          lifecycleStatus: "expiring_soon",
          lifecycleLabel: "Expiring soon",
          lifecycleDescription: "This lease is approaching notice timing.",
          requiredNextAction: "prepare_renewal_notice",
          renewalOutcome: "not_started",
          daysUntilExpiry: 30,
          history: [],
        },
        jurisdictionPolicies: [],
      },
    });
    mocks.fetchExpiringLeaseRenewals.mockResolvedValueOnce({
      ok: true,
      items: [
        {
          id: "lease-raw-labels",
          tenantId: "tenant-raw",
          propertyId: "36DDfE1QldevOrw9wVyR",
          propertyAddress: null,
          unitId: "36DDfE1QldevOrw9wVyR",
          status: "active",
          leaseType: "fixed_term",
          province: "NS",
          leaseStartDate: "2026-01-01",
          leaseEndDate: "2026-12-31",
          currentRent: 1850,
          currency: "CAD",
          nextNoticeDueAt: null,
          latestNoticeId: null,
          tenantName: null,
          unitLabel: "36DDfE1QldevOrw9wVyR",
          propertyLabel: null,
          renewalRentChangeMode: "no_change",
          renewalOfferedRent: null,
          renewalDecisionDeadlineAt: dateInputValueToMs("2026-11-20"),
          renewalNewTermType: "month_to_month",
          renewalNewLeaseStartDate: "2027-01-01",
          renewalNewLeaseEndDate: "2027-12-31",
          renewalUpdatedAt: "2026-07-02T12:00:00.000Z",
        },
      ],
      data: [],
    });

    renderWorkflow("/leases/lease-raw-labels/workflows/renewal");

    const draftCard = await screen.findByLabelText("Tenant renewal notice draft");
    expect(draftCard).toHaveTextContent("Draft ready");
    expect(draftCard).toHaveTextContent("Tenant name unavailable");
    expect(draftCard).toHaveTextContent("32 central road · Unit 4");
    expect(draftCard).not.toHaveTextContent("36DDfE1QldevOrw9wVyR");

    const draftPreview = screen.getByLabelText("Draft message preview") as HTMLTextAreaElement;
    expect(draftPreview.value).toContain("Hello,\n\nWe are preparing renewal details for 32 central road · Unit 4.");
    expect(draftPreview.value).toContain("The renewal term details would begin on January 1, 2027 and end on December 31, 2027.");
    expect(draftPreview.value).not.toContain("Hello Tenant,");
    expect(draftPreview.value).not.toContain("36DDfE1QldevOrw9wVyR");
    expect(draftPreview.value).toMatch(/tenant response target date recorded for internal follow-up is November 20, 2026\./);
    expect(document.body).not.toHaveTextContent(/must respond by|notice has been served|legally valid|automatically compliant/i);
    expect(screen.queryByRole("button", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
  });

  it("blocks the tenant renewal notice draft when renewal term dates are invalid", async () => {
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
          currentRent: 1850,
          currency: "CAD",
          nextNoticeDueAt: null,
          latestNoticeId: null,
          tenantName: "Jane Tenant",
          unitLabel: "Unit 101",
          propertyLabel: "Harbour View",
          renewalRentChangeMode: "increase",
          renewalOfferedRent: 1975,
          renewalDecisionDeadlineAt: dateInputValueToMs("2026-11-20"),
          renewalNewTermType: "fixed_term",
          renewalNewLeaseStartDate: "2036-09-01",
          renewalNewLeaseEndDate: "2027-08-31",
          renewalUpdatedAt: "2026-07-02T12:00:00.000Z",
        },
      ],
      data: [],
    });

    renderWorkflow("/leases/lease-1/workflows/renewal");

    const draftCard = await screen.findByLabelText("Tenant renewal notice draft");
    expect(draftCard).toHaveTextContent("Inputs needed");
    expect(draftCard).toHaveTextContent(
      "Review renewal term dates before preparing a tenant notice draft. The new lease start date must be on or before the new lease end date."
    );
    expect(draftCard).not.toHaveTextContent("Draft ready");
    expect(screen.queryByLabelText("Draft message preview")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Evidence readiness")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy draft text" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/must respond by|notice has been served|legally valid|automatically compliant/i);
  });

  it("copies the renewal notice draft without sending or saving a notice", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderWorkflow("/leases/lease-1/workflows/renewal");

    const draftPreview = (await screen.findByLabelText("Draft message preview")) as HTMLTextAreaElement;
    expect(draftPreview.value).toContain("Hello Jane Tenant,");
    fireEvent.click(screen.getByRole("button", { name: "Copy draft text" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("This message is for renewal planning and review."));
    });
    expect(await screen.findByText("Draft text copied.")).toBeInTheDocument();
    expect(mocks.saveLeaseRenewalInputs).not.toHaveBeenCalled();
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
    expect(screen.getByLabelText("Tenant renewal notice draft")).toHaveTextContent("Inputs needed");
    expect(screen.getByText("Save renewal operator inputs before preparing a tenant notice draft.")).toBeInTheDocument();
    expect(screen.getByText(/Missing: rent change mode, new term type, new lease start date, new lease end date, tenant response target date/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy draft text" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /email renewal notice|send renewal notice/i })).not.toBeInTheDocument();
  });

  it("saves renewal operator inputs through the existing lease renewal save behavior", async () => {
    mocks.saveLeaseRenewalInputs.mockResolvedValueOnce({
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
        renewalDecisionDeadlineAt: null,
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
        responseDeadlineAt: dateInputValueToMs("2026-11-20"),
      },
    });

    renderWorkflow("/leases/lease-1/workflows/renewal");

    expect(await screen.findByLabelText(/Rent change mode/i)).toHaveValue("increase");
    fireEvent.change(screen.getByLabelText(/Rent change mode/i), { target: { value: "no_change" } });
    fireEvent.change(screen.getByLabelText(/New term type/i), { target: { value: "month_to_month" } });
    fireEvent.change(screen.getByLabelText(/New lease start date/i), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText(/New lease end date/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/Tenant response target date/i), { target: { value: "2026-11-20" } });
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
          responseDeadlineAt: dateInputValueToMs("2026-11-20"),
        })
      );
    });
    expect(await screen.findByText("Lease renewal inputs saved.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tenant renewal notice draft")).toHaveTextContent("Inputs needed");
    expect(screen.getByLabelText("Tenant renewal notice draft")).not.toHaveTextContent("Missing: tenant response target date");
    expect(screen.getByLabelText("Tenant renewal notice draft")).toHaveTextContent("Missing: new lease end date");
    expect(screen.queryByLabelText("Draft message preview")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Response deadline/i)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/deadline choices/i);
  });

  it("shows a clear save failure state for renewal operator inputs", async () => {
    mocks.saveLeaseRenewalInputs.mockRejectedValueOnce(new Error("INVALID_RESPONSE_DEADLINE"));
    renderWorkflow("/leases/lease-1/workflows/renewal");

    expect(await screen.findByLabelText(/Rent change mode/i)).toHaveValue("increase");
    fireEvent.click(screen.getByRole("button", { name: "Save renewal inputs" }));

    expect(await screen.findByText("Failed to save renewal inputs: Enter a valid tenant response target date.")).toBeInTheDocument();
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
