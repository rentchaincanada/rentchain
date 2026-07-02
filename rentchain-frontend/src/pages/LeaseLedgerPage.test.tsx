import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeaseLedgerPage from "./LeaseLedgerPage";

const mocks = vi.hoisted(() => ({
  fetchLeaseLedger: vi.fn(),
  addLeaseCharge: vi.fn(),
  addLeasePayment: vi.fn(),
  leaseLedgerExportUrl: vi.fn((_leaseId: string, _from?: string, _to?: string, format: "csv" | "pdf" = "csv") => `https://example.com/export.${format}`),
  getLeaseById: vi.fn(),
  getLeaseNotes: vi.fn(),
  createLeaseNote: vi.fn(),
  archiveLeaseRecord: vi.fn(),
  restoreLeaseRecord: vi.fn(),
  patchDecisionAction: vi.fn(),
}));

vi.mock("../api/leaseLedgerApi", () => ({
  fetchLeaseLedger: mocks.fetchLeaseLedger,
  addLeaseCharge: mocks.addLeaseCharge,
  addLeasePayment: mocks.addLeasePayment,
  leaseLedgerExportUrl: mocks.leaseLedgerExportUrl,
}));

vi.mock("@/api/leasesApi", () => ({
  getLeaseById: mocks.getLeaseById,
  getLeaseNotes: mocks.getLeaseNotes,
  createLeaseNote: mocks.createLeaseNote,
  archiveLeaseRecord: mocks.archiveLeaseRecord,
  restoreLeaseRecord: mocks.restoreLeaseRecord,
}));

vi.mock("@/api/decisionApi", () => ({
  patchDecisionAction: mocks.patchDecisionAction,
}));

vi.mock("../lib/authToken", () => ({
  getAuthToken: () => null,
}));

vi.mock("../lib/firebaseAuthToken", () => ({
  getFirebaseIdToken: async () => null,
}));

describe("LeaseLedgerPage", () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mocks.leaseLedgerExportUrl.mockImplementation(
      (_leaseId: string, _from?: string, _to?: string, format: "csv" | "pdf" = "csv") => `https://example.com/export.${format}`
    );
    global.URL.createObjectURL = vi.fn(() => "blob:lease-ledger");
    global.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      headers: {
        get: () => null,
      },
    })) as unknown as typeof fetch;
    mocks.fetchLeaseLedger.mockResolvedValue({
      ok: true,
      leaseId: "lease-1",
      entries: [
        {
          id: "entry-1",
          leaseId: "lease-1",
          entryType: "charge",
          category: "rent",
          amountCents: 145000,
          effectiveDate: "2026-04-01",
          createdAt: 1,
          signedAmountCents: 145000,
          balanceCents: 145000,
        },
        {
          id: "entry-2",
          leaseId: "lease-1",
          entryType: "payment",
          category: "rent",
          amountCents: 10000,
          effectiveDate: "2026-04-05",
          createdAt: 2,
          signedAmountCents: -10000,
          balanceCents: 135000,
        },
      ],
      totals: { chargesCents: 145000, paymentsCents: 10000, balanceCents: 135000 },
      monthlyTotals: {
        "2026-04": { chargesCents: 145000, paymentsCents: 10000, netCents: 135000 },
      },
      obligationRows: [
        {
          rowId: "obligation-paid",
          leaseId: "lease-1",
          paymentIntentId: "pi-paid",
          rentPaymentId: "rp-paid",
          propertyId: "prop-1",
          unitId: "unit-1",
          tenantId: "tenant-1",
          periodStart: "2026-04-01",
          periodEnd: "2026-04-30",
          dueDate: "2026-04-01",
          expectedAmountCents: 145000,
          paidAmountCents: 145000,
          currency: "cad",
          obligationStatus: "paid",
          paymentIntentStatus: "confirmed",
          rentPaymentStatus: "paid",
          reconciliationStatus: "reconciled",
          evidenceStatus: "reconciled",
          source: "reconciliation",
          reasons: ["paid_amount_matches_expected"],
        },
        {
          rowId: "obligation-underpaid",
          leaseId: "lease-1",
          paymentIntentId: "pi-underpaid",
          propertyId: "prop-1",
          dueDate: "2026-05-05T00:00:00.000Z",
          expectedAmountCents: 145000,
          paidAmountCents: 10000,
          currency: "cad",
          obligationStatus: "underpaid",
          evidenceStatus: "provider_received",
          source: "rent_payment",
          reasons: ["paid_amount_below_expected"],
        },
        {
          rowId: "obligation-overpaid",
          leaseId: "lease-1",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 150000,
          currency: "cad",
          obligationStatus: "overpaid",
          evidenceStatus: "provider_received",
          source: "rent_payment",
          reasons: ["paid_amount_above_expected"],
        },
        {
          rowId: "obligation-missing",
          leaseId: "lease-1",
          paymentIntentId: "pi-missing",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 0,
          currency: "cad",
          obligationStatus: "missing",
          evidenceStatus: "none",
          source: "lease_lifecycle",
          reasons: ["expected_payment_missing"],
        },
        {
          rowId: "obligation-pending",
          leaseId: "lease-1",
          paymentIntentId: "pi-pending",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 0,
          currency: "cad",
          obligationStatus: "pending",
          paymentIntentStatus: "pending_settlement",
          evidenceStatus: "pending",
          source: "payment_intent",
          reasons: ["payment_pending"],
        },
        {
          rowId: "obligation-failed",
          leaseId: "lease-1",
          paymentIntentId: "pi-failed",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 0,
          currency: "cad",
          obligationStatus: "failed",
          evidenceStatus: "failed",
          source: "rent_payment",
          reasons: ["rent_payment_failed"],
        },
        {
          rowId: "obligation-manual-review",
          leaseId: "lease-1",
          paymentIntentId: "pi-manual-review",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 145000,
          currency: "cad",
          obligationStatus: "manual_review_required",
          evidenceStatus: "manual_review_required",
          reconciliationStatus: "mismatch",
          source: "reconciliation",
          reasons: ["amount_mismatch"],
        },
        {
          rowId: "obligation-unknown",
          leaseId: "lease-1",
          propertyId: "prop-1",
          expectedAmountCents: 0,
          paidAmountCents: 0,
          currency: "cad",
          obligationStatus: "unknown",
          evidenceStatus: "none",
          source: "payment_intent",
          reasons: ["missing_expected_amount"],
        },
      ],
      obligationSummary: {
        totalRows: 8,
        expectedAmountCents: 1015000,
        paidAmountCents: 595000,
        outstandingAmountCents: 420000,
        manualReviewCount: 1,
        statusCounts: {
          expected: 0,
          pending: 1,
          paid: 1,
          underpaid: 1,
          overpaid: 1,
          failed: 1,
          missing: 1,
          manual_review_required: 1,
          unknown: 1,
        },
      },
      delinquencySignals: [
        {
          signalId: "delinquency:overdue:pi-missing",
          leaseId: "lease-1",
          paymentIntentId: "pi-missing",
          propertyId: "prop-1",
          dueDate: "2026-04-01T00:00:00.000Z",
          expectedAmountCents: 145000,
          paidAmountCents: 0,
          outstandingAmountCents: 145000,
          signalType: "overdue",
          severity: "critical",
          detectedAt: "2026-05-05T00:00:00.000Z",
          reasons: ["obligation_missing_after_due_date"],
        },
        {
          signalId: "delinquency:missing_payment:pi-missing",
          leaseId: "lease-1",
          paymentIntentId: "pi-missing",
          propertyId: "prop-1",
          dueDate: "2026-04-01T00:00:00.000Z",
          expectedAmountCents: 145000,
          paidAmountCents: 0,
          outstandingAmountCents: 145000,
          signalType: "missing_payment",
          severity: "warning",
          detectedAt: "2026-05-05T00:00:00.000Z",
          reasons: ["missing_rent_payment_after_due_date"],
        },
        {
          signalId: "delinquency:partially_paid:pi-underpaid",
          leaseId: "lease-1",
          paymentIntentId: "pi-underpaid",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 10000,
          outstandingAmountCents: 135000,
          signalType: "partially_paid",
          severity: "warning",
          detectedAt: "2026-05-05T00:00:00.000Z",
          reasons: ["obligation_partially_paid"],
        },
        {
          signalId: "delinquency:failed_payment:pi-failed",
          leaseId: "lease-1",
          paymentIntentId: "pi-failed",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 0,
          outstandingAmountCents: 145000,
          signalType: "failed_payment",
          severity: "critical",
          detectedAt: "2026-05-05T00:00:00.000Z",
          reasons: ["obligation_payment_failed"],
        },
        {
          signalId: "delinquency:manual_review_required:pi-manual-review",
          leaseId: "lease-1",
          paymentIntentId: "pi-manual-review",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 145000,
          outstandingAmountCents: 0,
          signalType: "manual_review_required",
          severity: "warning",
          detectedAt: "2026-05-05T00:00:00.000Z",
          reasons: ["obligation_requires_manual_review"],
        },
      ],
      delinquencySummary: {
        totalSignals: 5,
        overdueCount: 1,
        partiallyPaidCount: 1,
        failedCount: 1,
        missingCount: 1,
        manualReviewCount: 1,
        totalOutstandingCents: 425000,
      },
      decisions: [
        {
          decisionId: "decision-overdue",
          leaseId: "lease-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          tenantId: "tenant-1",
          paymentIntentId: "pi-missing",
          decisionType: "review_overdue_rent",
          severity: "critical",
          status: "detected",
          reason: "Rent past due date",
          metadata: {
            signalId: "delinquency:overdue:pi-missing",
            signalType: "overdue",
            outstandingAmountCents: 145000,
            obligationStatus: "missing",
          },
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
        },
        {
          decisionId: "decision-underpaid",
          leaseId: "lease-1",
          propertyId: "prop-1",
          decisionType: "review_underpaid_rent",
          severity: "warning",
          status: "detected",
          reason: "Partial payment received",
          metadata: {},
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
        },
        {
          decisionId: "decision-missing",
          leaseId: "lease-1",
          propertyId: "prop-1",
          decisionType: "review_missing_payment",
          severity: "critical",
          status: "detected",
          reason: "Expected rent payment is missing",
          metadata: {},
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
        },
        {
          decisionId: "decision-failed",
          leaseId: "lease-1",
          propertyId: "prop-1",
          decisionType: "review_failed_payment",
          severity: "critical",
          status: "detected",
          reason: "Payment did not complete",
          metadata: {},
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
        },
        {
          decisionId: "decision-manual",
          leaseId: "lease-1",
          propertyId: "prop-1",
          decisionType: "review_manual_payment_issue",
          severity: "warning",
          status: "detected",
          reason: "Payment mismatch detected",
          metadata: {},
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
        },
      ],
    });
    mocks.getLeaseById.mockResolvedValue({
      lease: {
        id: "lease-1",
        propertyName: "Harbour View",
        unitNumber: "101",
        tenantName: "Jane Tenant",
        status: "renewal_pending",
        leaseExecution: {
          executionStatus: "ready_for_landlord_signature",
          executionLabel: "Waiting for landlord signature",
          executionDescription: "Tenant signing appears complete and the next visible execution step belongs to the landlord.",
          requiredNextAction: "landlord_signature",
          tenantSignatureStatus: "completed",
          landlordSignatureStatus: "needed",
          pdfStatus: "generated",
          completedAt: null,
        },
      },
    });
    mocks.getLeaseNotes.mockResolvedValue({
      ok: true,
      notes: [{ id: "note-1", leaseId: "lease-1", landlordId: "landlord-1", note: "Call tenant next week", createdAt: 1 }],
    });
    mocks.createLeaseNote.mockResolvedValue({
      ok: true,
      note: { id: "note-2", leaseId: "lease-1", landlordId: "landlord-1", note: "New note", createdAt: 2 },
    });
    mocks.archiveLeaseRecord.mockResolvedValue({ ok: true, lease: { id: "lease-1", archivedAt: "2026-04-01T00:00:00.000Z" } });
    mocks.restoreLeaseRecord.mockResolvedValue({ ok: true, lease: { id: "lease-1", archivedAt: null } });
    mocks.patchDecisionAction.mockImplementation(async (_decisionId: string, payload: any) => ({
      ok: true,
      decision: {
        ...payload.decision,
        status: payload.actionType === "reviewed" ? "reviewed" : payload.actionType,
        latestAction: {
          actionId: "action-1",
          decisionId: payload.decision.decisionId,
          actionType: payload.actionType,
          nextStatus: payload.actionType === "reviewed" ? "reviewed" : payload.actionType,
          createdAt: "2026-05-05T12:00:00.000Z",
        },
      },
    }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("loads canonical lease detail and notes with the ledger", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Harbour View · Unit 101")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Renewal pending/i)).toBeInTheDocument();
    expect(screen.getByText("Waiting for landlord signature")).toBeInTheDocument();
    expect(screen.getByText("Call tenant next week")).toBeInTheDocument();
  });

  it("formats ledger cents as readable dollars and cents", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Harbour View · Unit 101")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1,450.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(screen.getByText("+$1,450.00")).toBeInTheDocument();
    expect(screen.getByText("-$100.00")).toBeInTheDocument();
    expect(screen.queryByText("145000")).not.toBeInTheDocument();
    expect(screen.queryByText("10000")).not.toBeInTheDocument();
  });

  it("renders read-only obligation summary and rows with dollar amounts and status badges", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Payment obligations")).toBeInTheDocument();
    expect(screen.getByText("Read-only view of expected rent, execution records, and reconciliation evidence.")).toBeInTheDocument();
    expect(
      screen.getByText("Obligation status is financial truth from payments and reconciliation. Decision workflow actions do not change these values.")
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Financial status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Financial signal" })).toBeInTheDocument();
    expect(screen.getByLabelText("Payment obligation cards")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Delinquency" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Expected").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Outstanding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual Review").length).toBeGreaterThan(0);
    expect(screen.getByText("$10,150.00")).toBeInTheDocument();
    expect(screen.getByText("$5,950.00")).toBeInTheDocument();
    expect(screen.getByText("$4,200.00")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1,350.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1,500.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("1015000")).not.toBeInTheDocument();
    expect(screen.queryByText("595000")).not.toBeInTheDocument();
    expect(screen.queryByText("420000")).not.toBeInTheDocument();
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Underpaid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overpaid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Missing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reconciled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual Review Required").length).toBeGreaterThan(0);
    expect(screen.getAllByText(new Date(2026, 4, 5).toLocaleDateString()).length).toBeGreaterThan(0);
  });

  it("keeps the payment CSV import collapsed until the landlord opens it", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("AI-assisted payment CSV import")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import payments CSV" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Payment CSV file")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Import payments CSV" }));

    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
    expect(screen.getByLabelText("Payment CSV file")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment CSV import assistant")).toBeInTheDocument();
  });

  it("renders delinquency summary cards and row-level signal reasons", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Financial delinquency summary")).toBeInTheDocument();
    expect(screen.getByText("Read-only detection based on obligation ledger signals.")).toBeInTheDocument();
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Outstanding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Underpaid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual Review").length).toBeGreaterThan(0);
    expect(await screen.findByText("$4,250.00")).toBeInTheDocument();
    expect(screen.queryByText("425000")).not.toBeInTheDocument();

    expect(screen.getAllByText("Overdue — Rent past due date (obligation missing after due date)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Missing — No rent payment found after due date (missing rent payment after due date)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Underpaid — Partial payment received (obligation partially paid)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed — Payment did not complete (obligation payment failed)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual review required — Payment mismatch or incomplete evidence (obligation requires manual review)").length).toBeGreaterThan(0);
  });

  it("renders read-only lease decisions derived from delinquency signals", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Decisions")).toBeInTheDocument();
    expect(screen.getByText("Read-only decisions derived from detected lease and payment signals.")).toBeInTheDocument();
    expect(
      screen.getByText("These actions manage operational review workflow only. They do not change lease balances, payment records, or ledger history.")
    ).toBeInTheDocument();
    expect(screen.getByText("Overdue Rent")).toBeInTheDocument();
    expect(screen.getAllByText("Financial signal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Workflow status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recommended next action").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Record payment").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Property / unit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Harbour View · Unit 101").length).toBeGreaterThan(0);
    expect(screen.getByText("Active critical decisions")).toBeInTheDocument();
    expect(screen.getByText("Active warning decisions")).toBeInTheDocument();
    expect(screen.getByText("Active decision count")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Mark reviewed: Marks this issue as reviewed by staff/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Snooze: Temporarily hides this issue until later review/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Assign: Assigns this review item to a team\/person/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Dismiss: Dismisses this signal from active review/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Resolve: Marks the operational review task as resolved/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rent past due date").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Lease ledger" }).some((link) => link.getAttribute("href") === "/leases/lease-1/ledger")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Harbour View · Unit 101" }).some((link) => link.getAttribute("href") === "/properties?propertyId=prop-1&unitId=unit-1")).toBe(true);
    expect(screen.getByRole("link", { name: "Jane Tenant" })).toHaveAttribute("href", "/tenants?tenantId=tenant-1");
    expect(screen.queryByText(/Unit ref/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tenant ref/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Internal Property ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Internal Lease ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Provider payment reference")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Show advanced evidence" })[0]);
    expect(screen.getAllByText("Internal Property ID").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Internal Unit ID").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Internal Tenant ID").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Internal Lease ID").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Outstanding amount").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1,450.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Underpaid Rent")).toBeInTheDocument();
    expect(screen.getAllByText("Partial payment received").length).toBeGreaterThan(0);
    expect(screen.getByText("Missing Payment")).toBeInTheDocument();
    expect(screen.getAllByText("Expected rent payment is missing").length).toBeGreaterThan(0);
    expect(screen.getByText("Failed Payment")).toBeInTheDocument();
    expect(screen.getAllByText("Payment did not complete").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Payment mismatch detected").length).toBeGreaterThan(0);
  });

  it("updates lease decision status from human actions", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger
      .mockResolvedValueOnce(baseLedgerResponse)
      .mockResolvedValueOnce({
        ...baseLedgerResponse,
        decisions: baseLedgerResponse.decisions.map((decision: any) =>
          decision.decisionId === "decision-overdue"
            ? {
                ...decision,
                status: "reviewed",
                latestAction: {
                  actionId: "action-1",
                  decisionId: "decision-overdue",
                  actionType: "reviewed",
                  previousStatus: "detected",
                  nextStatus: "reviewed",
                  createdAt: "2026-05-05T12:00:00.000Z",
                },
              }
            : decision
        ),
      });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Overdue Rent")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Mark reviewed:/ })[0]);

    await waitFor(() => expect(mocks.patchDecisionAction).toHaveBeenCalledWith("decision-overdue", expect.objectContaining({ actionType: "reviewed" })));
    await waitFor(() => expect(mocks.fetchLeaseLedger).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText("Reviewed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Outstanding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$4,200.00").length).toBeGreaterThan(0);
  });

  it("renders an empty obligation state while preserving existing ledger entries", async () => {
    mocks.fetchLeaseLedger.mockResolvedValueOnce({
      ok: true,
      leaseId: "lease-1",
      entries: [
        {
          id: "entry-1",
          leaseId: "lease-1",
          entryType: "charge",
          category: "rent",
          amountCents: 145000,
          effectiveDate: "2026-04-01",
          createdAt: 1,
          signedAmountCents: 145000,
          balanceCents: 145000,
        },
      ],
      totals: { chargesCents: 145000, paymentsCents: 0, balanceCents: 145000 },
      monthlyTotals: {},
      obligationRows: [],
      obligationSummary: {
        totalRows: 0,
        expectedAmountCents: 0,
        paidAmountCents: 0,
        outstandingAmountCents: 0,
        manualReviewCount: 0,
        statusCounts: {
          expected: 0,
          pending: 0,
          paid: 0,
          underpaid: 0,
          overpaid: 0,
          failed: 0,
          missing: 0,
          manual_review_required: 0,
          unknown: 0,
        },
      },
      delinquencySignals: [],
      delinquencySummary: {
        totalSignals: 0,
        overdueCount: 0,
        partiallyPaidCount: 0,
        failedCount: 0,
        missingCount: 0,
        manualReviewCount: 0,
        totalOutstandingCents: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Obligation ledger is not available yet for this lease.")).toBeInTheDocument();
    expect(screen.getByText("All rent obligations are up to date.")).toBeInTheDocument();
    expect(screen.getByText("No issues detected. Everything is up to date.")).toBeInTheDocument();
    expect(screen.getByText("+$1,450.00")).toBeInTheDocument();
    expect(screen.getAllByText("$1,450.00").length).toBeGreaterThan(0);
  });

  it("opens browser print preview for lease ledger PDF output", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findAllByText("Harbour View · Unit 101");
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));

    expect(printSpy).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/leases/lease-1/ledger/export.pdf"),
      expect.anything()
    );
    printSpy.mockRestore();
  });

  it("adds a lease note from the ledger detail surface", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findAllByText("Harbour View · Unit 101");
    fireEvent.click(screen.getAllByRole("button", { name: "Add lease note" })[0]);
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Follow up on renewal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => expect(mocks.createLeaseNote).toHaveBeenCalledWith("lease-1", "Follow up on renewal"));
  });
});
