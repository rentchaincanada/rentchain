import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeaseLedgerPage from "./LeaseLedgerPage";

function buildCreditAllocationLedgerResponse(baseLedgerResponse: any, status: "reviewed" | "resolved" = "reviewed") {
  return {
    ...baseLedgerResponse,
    totals: { chargesCents: 217300, paymentsCents: 1094200, balanceCents: -876900 },
    obligationRows: [
      {
        rowId: "obligation-pending-credit",
        leaseId: "lease-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        tenantId: "tenant-1",
        dueDate: "2026-06-01T00:00:00.000Z",
        expectedAmountCents: 200000,
        paidAmountCents: 0,
        currency: "cad",
        obligationStatus: "pending",
        evidenceStatus: "pending",
        source: "payment_intent",
        reasons: ["payment_pending"],
      },
    ],
    obligationSummary: {
      totalRows: 1,
      expectedAmountCents: 200000,
      paidAmountCents: 0,
      outstandingAmountCents: 200000,
      manualReviewCount: 0,
      statusCounts: {
        expected: 0,
        pending: 1,
        paid: 0,
        underpaid: 0,
        overpaid: 0,
        failed: 0,
        missing: 0,
        manual_review_required: 0,
        unknown: 0,
      },
    },
    delinquencySignals: [
      {
        signalId: "delinquency:overdue:obligation-pending-credit",
        leaseId: "lease-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        tenantId: "tenant-1",
        dueDate: "2026-06-01T00:00:00.000Z",
        expectedAmountCents: 200000,
        paidAmountCents: 0,
        outstandingAmountCents: 200000,
        signalType: "overdue",
        severity: "critical",
        detectedAt: "2026-07-02T00:00:00.000Z",
        reasons: ["obligation_pending_after_due_date"],
      },
    ],
    delinquencySummary: {
      totalSignals: 1,
      overdueCount: 1,
      partiallyPaidCount: 0,
      failedCount: 0,
      missingCount: 0,
      manualReviewCount: 0,
      totalOutstandingCents: 200000,
    },
    decisions: [
      {
        decisionId: "decision-reviewed-overdue",
        leaseId: "lease-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        tenantId: "tenant-1",
        decisionType: "review_overdue_rent",
        severity: "critical",
        status,
        reason: "Rent obligation is overdue.",
        metadata: {
          signalId: "delinquency:overdue:obligation-pending-credit",
          signalType: "overdue",
          outstandingAmountCents: 200000,
          obligationStatus: "pending",
        },
        latestAction: {
          actionId: `action-${status}`,
          decisionId: "decision-reviewed-overdue",
          actionType: status,
          previousStatus: status === "resolved" ? "reviewed" : "detected",
          nextStatus: status,
          createdAt: "2026-07-02T12:00:00.000Z",
        },
      },
    ],
  };
}

function buildCreditAllocationPreviewResponse(overrides: Record<string, any> = {}) {
  const obligation = {
    obligationKey: "lease-1:2026-06-01:200000",
    obligationRowId: "obligation-pending-credit",
    leaseId: "lease-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    paymentIntentId: null,
    rentPaymentId: null,
    paymentDocumentId: null,
    dueDate: "2026-06-01T00:00:00.000Z",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    expectedAmountCents: 200000,
    paidAmountCents: 0,
    existingActiveAllocationAmountCents: 0,
    outstandingAmountCents: 200000,
    currency: "cad",
    suggestedAllocationAmountCents: 200000,
    afterAvailableCreditCents: 676900,
    obligationOutstandingAfterCents: 0,
  };
  return {
    ok: true,
    leaseId: "lease-1",
    landlordId: "landlord-1",
    sourceType: "lease_credit_allocation",
    aggregateBalanceCents: -876900,
    sourceBalanceBeforeCents: -876900,
    grossAvailableCreditCents: 876900,
    activeAllocationAmountCents: 0,
    availableCreditCents: 876900,
    eligibleObligations: [obligation],
    obligations: [obligation],
    suggestedAllocations: [
      {
        obligationRowId: "obligation-pending-credit",
        obligationKey: "lease-1:2026-06-01:200000",
        allocationAmountCents: 200000,
        beforeAvailableCreditCents: 876900,
        beforeOutstandingAmountCents: 200000,
        afterAvailableCreditCents: 676900,
        afterOutstandingAmountCents: 0,
      },
    ],
    totalOutstandingAmountCents: 200000,
    totalSuggestedAllocationAmountCents: 200000,
    remainingAvailableCreditCents: 676900,
    previewFingerprint: "preview-fingerprint-1",
    blockedReasons: [],
    allowed: true,
    existingActiveAllocations: [],
    reversedAllocations: [],
    noLegalOrLifecycleEffect: true,
    ...overrides,
  };
}

function buildActiveCreditAllocationPreviewResponse(overrides: Record<string, any> = {}) {
  return buildCreditAllocationPreviewResponse({
    activeAllocationAmountCents: 200000,
    availableCreditCents: 676900,
    eligibleObligations: [],
    obligations: [],
    suggestedAllocations: [],
    totalOutstandingAmountCents: 0,
    totalSuggestedAllocationAmountCents: 0,
    remainingAvailableCreditCents: 676900,
    allowed: false,
    blockedReasons: ["no_outstanding_obligations"],
    existingActiveAllocations: [
      {
        allocationId: "allocation-1",
        landlordId: "landlord-1",
        leaseId: "lease-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        tenantId: "tenant-1",
        obligationRowId: "obligation-pending-credit",
        obligationKey: "lease-1:2026-06-01:200000",
        allocationAmountCents: 200000,
        currency: "cad",
        status: "active",
        createdAt: "2026-07-15T00:00:00.000Z",
        createdBy: "landlord-1",
        createdByEmail: "landlord@example.com",
        reason: "operator_credit_allocation",
        note: null,
        beforeAvailableCreditCents: 876900,
        beforeOutstandingAmountCents: 200000,
        afterAvailableCreditCents: 676900,
        afterOutstandingAmountCents: 0,
        previewFingerprint: "preview-fingerprint-1",
        idempotencyKey: "idempotency-1",
        sourceType: "lease_credit_allocation",
      },
    ],
    ...overrides,
  });
}

const mocks = vi.hoisted(() => ({
  fetchLeaseLedger: vi.fn(),
  fetchCreditAllocationPreview: vi.fn(),
  applyCreditAllocation: vi.fn(),
  reverseCreditAllocation: vi.fn(),
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
  fetchCreditAllocationPreview: mocks.fetchCreditAllocationPreview,
  applyCreditAllocation: mocks.applyCreditAllocation,
  reverseCreditAllocation: mocks.reverseCreditAllocation,
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
    mocks.fetchCreditAllocationPreview.mockReset();
    mocks.applyCreditAllocation.mockReset();
    mocks.reverseCreditAllocation.mockReset();
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
    mocks.fetchCreditAllocationPreview.mockResolvedValue(buildCreditAllocationPreviewResponse());
    mocks.applyCreditAllocation.mockResolvedValue({
      ok: true,
      allocation: {
        allocationId: "allocation-1",
        landlordId: "landlord-1",
        leaseId: "lease-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        tenantId: "tenant-1",
        obligationRowId: "obligation-pending-credit",
        obligationKey: "lease-1:2026-06-01:200000",
        allocationAmountCents: 200000,
        currency: "cad",
        status: "active",
        createdAt: "2026-07-15T00:00:00.000Z",
        createdBy: "landlord-1",
        createdByEmail: "landlord@example.com",
        reason: "operator_credit_allocation",
        note: null,
        beforeAvailableCreditCents: 876900,
        beforeOutstandingAmountCents: 200000,
        afterAvailableCreditCents: 676900,
        afterOutstandingAmountCents: 0,
        previewFingerprint: "preview-fingerprint-1",
        idempotencyKey: "idempotency-1",
        sourceType: "lease_credit_allocation",
      },
      idempotentReplay: false,
      beforePreview: buildCreditAllocationPreviewResponse(),
      preview: buildCreditAllocationPreviewResponse({
        availableCreditCents: 676900,
        activeAllocationAmountCents: 200000,
        eligibleObligations: [],
        obligations: [],
        suggestedAllocations: [],
        totalOutstandingAmountCents: 0,
        totalSuggestedAllocationAmountCents: 0,
        remainingAvailableCreditCents: 676900,
        allowed: false,
        blockedReasons: ["no_outstanding_obligations"],
        existingActiveAllocations: [
          {
            allocationId: "allocation-1",
            landlordId: "landlord-1",
            leaseId: "lease-1",
            propertyId: "prop-1",
            unitId: "unit-1",
            tenantId: "tenant-1",
            obligationRowId: "obligation-pending-credit",
            obligationKey: "lease-1:2026-06-01:200000",
            allocationAmountCents: 200000,
            currency: "cad",
            status: "active",
            createdAt: "2026-07-15T00:00:00.000Z",
            createdBy: "landlord-1",
            createdByEmail: "landlord@example.com",
            reason: "operator_credit_allocation",
            note: null,
            beforeAvailableCreditCents: 876900,
            beforeOutstandingAmountCents: 200000,
            afterAvailableCreditCents: 676900,
            afterOutstandingAmountCents: 0,
            previewFingerprint: "preview-fingerprint-1",
            idempotencyKey: "idempotency-1",
            sourceType: "lease_credit_allocation",
          },
        ],
      }),
      noLegalOrLifecycleEffect: true,
    });
    mocks.reverseCreditAllocation.mockResolvedValue({ ok: true });
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
    expect(screen.getByRole("link", { name: "Back to lease summary" })).toHaveAttribute("href", "/leases/lease-1/summary");
    expect(screen.getByRole("link", { name: "Open operations" })).toHaveAttribute("href", "/operations");
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
    expect(screen.getByRole("columnheader", { name: "Method/Ref" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ledger entry cards")).toBeInTheDocument();
    expect(screen.getAllByText("+$1,450.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-$100.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Balance").length).toBeGreaterThan(0);
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

  it("explains available credit when a rent charge still needs review", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValueOnce(buildCreditAllocationLedgerResponse(baseLedgerResponse, "reviewed"));

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Credit balance needs allocation review")).toBeInTheDocument();
    expect(screen.getByText(/a \$2,000.00 rent charge was not yet matched to/i)).toBeInTheDocument();
    expect(screen.getByText("Review and apply available credit to the rent charge.")).toBeInTheDocument();
    expect(screen.getByText("Review payment allocation")).toBeInTheDocument();
    expect(screen.getAllByText("Allocation review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A rent charge was not yet matched to the tenant's available credit.").length).toBeGreaterThan(0);
    expect(screen.getByText("Review and apply available credit to the rent charge before resolving this item.")).toBeInTheDocument();
    expect(screen.getByText("Recommended next action")).toBeInTheDocument();
    expect(screen.queryByText("Resolved outcome")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.queryByText("Review / resolve")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark reviewed:/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("A rent charge was not yet matched to the tenant's available credit.").length).toBeGreaterThan(0);
    expect(screen.getByText("Rent charge was not yet matched to available credit")).toBeInTheDocument();
    expect(screen.queryByText("obligation_pending_after_due_date")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reviewed").length).toBeGreaterThan(0);
    expect(screen.getByText(/reviewed or resolved status does not mark rent paid/i)).toBeInTheDocument();
    expect(screen.queryByText("Overdue Rent")).not.toBeInTheDocument();
    expect(screen.queryByText("Rent obligation is overdue.")).not.toBeInTheDocument();
    expect(screen.queryByText("Record payment or contact the tenant, then resolve once the ledger is updated.")).not.toBeInTheDocument();
  });

  it("shows an operator-confirmed credit allocation panel when preview is available", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValueOnce(buildCreditAllocationLedgerResponse(baseLedgerResponse, "reviewed"));

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Allocate available lease credit" });
    await waitFor(() => expect(mocks.fetchCreditAllocationPreview).toHaveBeenCalledWith("lease-1"));
    expect(screen.getByText("This lease has available credit, but a rent charge was not yet matched to that credit. Review and apply available credit to the rent charge.")).toBeInTheDocument();
    expect(screen.getByText("Available credit")).toBeInTheDocument();
    expect(screen.getAllByText("$8,769.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rent charge outstanding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$2,000.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Suggested credit to apply")).toBeInTheDocument();
    expect(screen.getByText("Available credit after allocation")).toBeInTheDocument();
    expect(screen.getByText("$6,769.00")).toBeInTheDocument();
    expect(screen.getByText("Existing lease credit available for operator-reviewed allocation")).toBeInTheDocument();
    expect(screen.queryByText(/collection resolved/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/legal compliance/i)).not.toBeInTheDocument();
  });

  it("uses active allocation records to avoid stale outstanding warning copy after reload", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValueOnce(buildCreditAllocationLedgerResponse(baseLedgerResponse, "reviewed"));
    mocks.fetchCreditAllocationPreview.mockResolvedValueOnce(buildActiveCreditAllocationPreviewResponse());

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Remaining lease credit available")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lease credit allocation recorded" })).toBeInTheDocument();
    expect(screen.getByText("Available credit has been applied to this rent charge. These records show operator-reviewed allocations and do not edit historical payment records.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Allocate available lease credit" })).not.toBeInTheDocument();
    expect(screen.queryByText("This lease has available credit, but a rent charge was not yet matched to that credit. Review and apply available credit to the rent charge.")).not.toBeInTheDocument();
    expect(screen.getByText(/available credit remaining after \$2,000.00 was applied to the rent charge/i)).toBeInTheDocument();
    expect(screen.getByText(/ledger balance remains -\$8,769.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Rent charge outstanding after allocation: \$0.00/i)).toBeInTheDocument();
    expect(screen.getAllByText("Ledger balance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Credit applied").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Available credit after allocation").length).toBeGreaterThan(0);
    expect(screen.queryByText(/but \$2,000.00 remains outstanding on specific obligations/i)).not.toBeInTheDocument();
    expect(screen.getByText("Active allocation history")).toBeInTheDocument();
    expect(screen.getAllByText("$0.00 after allocation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Allocated from credit: $2,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Original outstanding: $2,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Credit allocation recorded").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Existing lease credit covers this rent charge/i).length).toBeGreaterThan(0);
  });

  it("keeps apply disabled until confirmation and sends the current preview fingerprint", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValue(buildCreditAllocationLedgerResponse(baseLedgerResponse, "reviewed"));

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    const applyButton = await screen.findByRole("button", { name: "Apply credit allocation" });
    expect(applyButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText("I have reviewed the credit balance and rent charge details."));
    expect(applyButton).not.toBeDisabled();
    fireEvent.click(applyButton);

    await waitFor(() => expect(mocks.applyCreditAllocation).toHaveBeenCalledWith(
      "lease-1",
      expect.objectContaining({
        obligationRowId: "obligation-pending-credit",
        allocationAmountCents: 200000,
        previewFingerprint: "preview-fingerprint-1",
        idempotencyKey: expect.stringContaining("lease-credit-allocation:lease-1:obligation-pending-credit:"),
      })
    ));
    expect(mocks.applyCreditAllocation.mock.calls[0][1]).not.toHaveProperty("obligationKey");
  });

  it("renders allocation success details after apply", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValue(buildCreditAllocationLedgerResponse(baseLedgerResponse, "reviewed"));

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByLabelText("I have reviewed the credit balance and rent charge details."));
    fireEvent.click(screen.getByRole("button", { name: "Apply credit allocation" }));

    expect((await screen.findAllByText("Credit allocation recorded")).length).toBeGreaterThan(0);
    expect(screen.getByText("Credit was applied to the rent charge.")).toBeInTheDocument();
    expect(screen.getByText("Historical payment records were not edited.")).toBeInTheDocument();
    expect(screen.getAllByText("allocation-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$6,769.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$0.00").length).toBeGreaterThan(0);
    expect(screen.getByText("This allocation records how existing lease credit was applied to a rent charge. It does not edit historical payment records.")).toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchLeaseLedger).toHaveBeenCalledTimes(2));
  });

  it("renders stale preview errors with refresh-safe copy", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValue(buildCreditAllocationLedgerResponse(baseLedgerResponse, "reviewed"));
    mocks.applyCreditAllocation.mockRejectedValueOnce({ code: "CREDIT_ALLOCATION_STATE_STALE" });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByLabelText("I have reviewed the credit balance and rent charge details."));
    fireEvent.click(screen.getByRole("button", { name: "Apply credit allocation" }));

    expect(await screen.findByText("Ledger changed since this preview was generated. Refresh the allocation preview and try again.")).toBeInTheDocument();
    expect(screen.queryByText("Credit allocation recorded")).not.toBeInTheDocument();
  });

  it("renders generic allocation failures with ledger-safe copy", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValue(buildCreditAllocationLedgerResponse(baseLedgerResponse, "reviewed"));
    mocks.applyCreditAllocation.mockRejectedValueOnce(new Error("network failed"));

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByLabelText("I have reviewed the credit balance and rent charge details."));
    fireEvent.click(screen.getByRole("button", { name: "Apply credit allocation" }));

    expect(await screen.findByText("Credit allocation could not be recorded. No ledger records were changed.")).toBeInTheDocument();
  });

  it("does not show the allocation panel when the preview is blocked with no eligible obligations", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValueOnce(buildCreditAllocationLedgerResponse(baseLedgerResponse, "reviewed"));
    mocks.fetchCreditAllocationPreview.mockResolvedValueOnce(buildCreditAllocationPreviewResponse({
      allowed: false,
      eligibleObligations: [],
      obligations: [],
      suggestedAllocations: [],
      blockedReasons: ["no_outstanding_obligations"],
      totalOutstandingAmountCents: 0,
      totalSuggestedAllocationAmountCents: 0,
    }));

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Credit balance needs allocation review")).toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchCreditAllocationPreview).toHaveBeenCalledWith("lease-1"));
    await waitFor(() => expect(screen.queryByText("Allocate available lease credit")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Apply credit allocation" })).not.toBeInTheDocument();
  });

  it("renders resolved allocation-review decisions as passive workflow state", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValueOnce(buildCreditAllocationLedgerResponse(baseLedgerResponse, "resolved"));

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Credit balance needs allocation review")).toBeInTheDocument();
    expect(screen.getByText("Review payment allocation")).toBeInTheDocument();
    expect(screen.getAllByText("Allocation review").length).toBeGreaterThan(0);
    expect(screen.getByText("Resolved outcome")).toBeInTheDocument();
    expect(screen.getByText("Marked resolved as an allocation-review item. Review available credit before taking further action.")).toBeInTheDocument();
    expect(screen.queryByText("Recommended next action")).not.toBeInTheDocument();
    expect(screen.queryByText("Review and apply available credit to the rent charge before resolving this item.")).not.toBeInTheDocument();
    expect(screen.getAllByText("Already resolved").length).toBeGreaterThan(0);
    expect(screen.getByText("Last action: Resolved")).toBeInTheDocument();
    expect(screen.queryByText("Review / resolve")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark reviewed:/ })).not.toBeInTheDocument();
    expect(mocks.patchDecisionAction).not.toHaveBeenCalled();
    expect(screen.queryByText("Overdue Rent")).not.toBeInTheDocument();
    expect(screen.queryByText("Rent obligation is overdue.")).not.toBeInTheDocument();
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

    expect(screen.getAllByText("Overdue — Rent past due date (Obligation Missing After Due Date)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Missing — No rent payment found after due date (Missing Rent Payment After Due Date)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Underpaid — Partial payment received (Obligation Partially Paid)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed — Payment did not complete (Obligation Payment Failed)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual review required — Payment mismatch or incomplete evidence (Obligation Requires Manual Review)").length).toBeGreaterThan(0);
    expect(screen.queryByText("obligation missing after due date")).not.toBeInTheDocument();
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
    expect(screen.getAllByRole("link", { name: "Payment ledger" }).some((link) => link.getAttribute("href") === "/leases/lease-1/ledger")).toBe(true);
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
    expect(screen.getAllByText("+$1,450.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1,450.00").length).toBeGreaterThan(0);
  });

  it("opens browser print preview for lease ledger PDF output", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {
      const printRoot = document.querySelector('[data-print-root="true"].lease-ledger-print-root');
      expect(document.body.getAttribute("data-print-root-active")).toBe("true");
      expect(document.body.getAttribute("data-print-mode")).toBe("lease-ledger");
      expect(printRoot?.textContent).toContain("Lease Ledger");
      expect(printRoot?.textContent).toContain("RentChain");
      expect(printRoot?.textContent).toContain("Harbour View · Unit 101");
      expect(printRoot?.textContent).toContain("Generated");
      expect(printRoot?.textContent).toContain("Charges");
      expect(printRoot?.textContent).toContain("Operational summary");
      expect(printRoot?.textContent).toContain("Lease execution summary");
      expect(printRoot?.textContent).toContain("Payment obligation summary");
      expect(printRoot?.textContent).toContain("Decision summary");
      expect(printRoot?.textContent).toContain("Ledger entries");
      expect(printRoot?.textContent).toContain("Description");
      expect(printRoot?.textContent).toContain("Monthly totals");
      expect(printRoot?.textContent).toContain("Lease notes");
      expect(printRoot?.textContent).toContain("Call tenant next week");
      expect(printRoot?.querySelector(".lease-ledger-print-export")).not.toBeNull();
      expect(printRoot?.querySelector(".lease-ledger-print-obligations-table")).not.toBeNull();
      expect(printRoot?.querySelector(".lease-ledger-print-ledger-table")).not.toBeNull();
      expect(printRoot?.querySelector('[aria-label="Ledger entry cards"]')).toBeNull();
      expect(printRoot?.querySelector('[aria-label="Payment obligation cards"]')).toBeNull();
      expect(printRoot?.textContent).not.toContain("Method / ref");
      expect(printRoot?.querySelector("button")).toBeNull();
      expect(printRoot?.querySelector("input")).toBeNull();
      expect(printRoot?.querySelector("select")).toBeNull();
      expect(printRoot?.querySelector("textarea")).toBeNull();
      expect(printRoot?.textContent).not.toContain("Add note");
      expect(printRoot?.textContent).not.toContain("Add charge");
      expect(printRoot?.textContent).not.toContain("Export CSV");
      expect(printRoot?.textContent).not.toContain("Print / Save PDF");
      expect(printRoot?.textContent).not.toContain("Import payments CSV");
      window.dispatchEvent(new Event("afterprint"));
    });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findAllByText("Harbour View · Unit 101");
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));

    await waitFor(() => expect(printSpy).toHaveBeenCalled());
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/leases/lease-1/ledger/export.pdf"),
      expect.anything()
    );
    expect(document.querySelector('[data-print-root="true"].lease-ledger-print-root')).not.toBeInTheDocument();
    expect(document.body.hasAttribute("data-print-root-active")).toBe(false);
    printSpy.mockRestore();
  });

  it("prints active allocation state with recorded-credit copy", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValueOnce(buildCreditAllocationLedgerResponse(baseLedgerResponse, "reviewed"));
    mocks.fetchCreditAllocationPreview.mockResolvedValueOnce(buildActiveCreditAllocationPreviewResponse());
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {
      const printRoot = document.querySelector('[data-print-root="true"].lease-ledger-print-root');
      const printText = printRoot?.textContent || "";
      expect(printText).toContain("Remaining lease credit available");
      expect(printText).toContain("This lease has $6,769.00 of available credit remaining after $2,000.00 was applied to the rent charge.");
      expect(printText).toContain("The ledger balance remains -$8,769.00 because historical payment records were not edited.");
      expect(printText).toContain("Rent charge outstanding after allocation: $0.00.");
      expect(printText).toContain("Ledger balance");
      expect(printText).toContain("Credit applied");
      expect(printText).toContain("Available credit after allocation");
      expect(printText).not.toContain("This lease has available credit, but a rent charge was not yet matched to that credit.");
      expect(printText).not.toContain("Apply credit allocation");
      window.dispatchEvent(new Event("afterprint"));
    });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Lease credit allocation recorded" });
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));

    await waitFor(() => expect(printSpy).toHaveBeenCalled());
    printSpy.mockRestore();
  });

  it("prints allocation-review signal reasons as readable evidence copy", async () => {
    const baseLedgerResponse = await mocks.fetchLeaseLedger("lease-1");
    mocks.fetchLeaseLedger.mockClear();
    mocks.fetchLeaseLedger.mockResolvedValueOnce(buildCreditAllocationLedgerResponse(baseLedgerResponse, "resolved"));
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {
      const printRoot = document.querySelector('[data-print-root="true"].lease-ledger-print-root');
      const printText = printRoot?.textContent || "";
      const printDecisionText = printRoot?.querySelector(".lease-ledger-print-decision")?.textContent || "";
      expect(printText).toContain("Review payment allocation");
      expect(printText).toContain("Allocation review");
      expect(printText).toContain("A rent charge was not yet matched to the tenant's available credit.");
      expect(printText).not.toContain("Allocate available lease credit");
      expect(printText).not.toContain("Apply credit allocation");
      expect(printText).not.toContain("I have reviewed the credit balance and rent charge details.");
      expect(printDecisionText).toContain("Resolved outcome");
      expect(printDecisionText).toContain("Marked resolved as an allocation-review item. Review available credit before taking further action.");
      expect(printDecisionText).not.toContain("Recommended next action");
      expect(printDecisionText).not.toContain("Review and apply available credit to the rent charge before resolving this item.");
      expect(printText).toContain("Signal reason: Rent charge was not yet matched to available credit");
      expect(printText).not.toContain("obligation_pending_after_due_date");
      window.dispatchEvent(new Event("afterprint"));
    });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Review payment allocation");
    await screen.findByText("Allocate available lease credit");
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));

    await waitFor(() => expect(printSpy).toHaveBeenCalled());
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
