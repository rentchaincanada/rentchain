import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addLeaseCharge,
  addLeasePayment,
  applyCreditAllocation,
  fetchCreditAllocationPreview,
  type ApplyCreditAllocationResponse,
  fetchLeaseLedger,
  type LeaseCreditAllocationPreview,
  type LeaseCreditAllocationPreviewObligation,
  type LeaseCreditAllocationSummary,
  type DelinquencySignalType,
  type LeaseObligationLedgerRow,
  type LeaseObligationLedgerSummary,
  type LeaseDelinquencySignal,
  type LeaseDelinquencySummary,
  type LeaseLedgerEntry,
  type PaymentObligationStatus,
} from "../api/leaseLedgerApi";
import { downloadAuthenticatedExport } from "../api/exportDownload";
import { patchDecisionAction } from "@/api/decisionApi";
import {
  createPrintRoot,
  nextRenderFrame,
  PRINT_MODE_ATTRIBUTE,
  PRINT_ROOT_ACTIVE_ATTRIBUTE,
  triggerDocumentDownload,
} from "../lib/documentRendering";
import {
  archiveLeaseRecord,
  createLeaseNote,
  getLeaseById,
  getLeaseNotes,
  restoreLeaseRecord,
  type LandlordActiveLease,
  type LeaseNote,
} from "@/api/leasesApi";
import { formatInternalReference, formatOperationalLabel, slugifyOperationalReference } from "@/lib/identityReferences";
import {
  decisionDisplayCopy,
  decisionSeverityStyle,
  decisionStatusCopy,
  summarizeDecisionItems,
  type DecisionActionType,
  type DecisionItem,
  type DecisionSeverity,
  type DecisionStatus,
} from "@/lib/decisions/decisionDisplay";
import { findRelatedDelinquencySignal, findRelatedObligationRow, formatSignalReason } from "@/lib/decisions/decisionContext";
import { DecisionContextPanel } from "@/components/decisions/DecisionContextPanel";
import { PaymentCsvImportPreviewCard } from "@/components/ledger/PaymentCsvImportPreviewCard";
import "./LeaseLedgerPage.css";

type ChargeType = "rent" | "fee" | "adjustment";
type PaymentMethod = "cash" | "etransfer" | "cheque" | "bank" | "card" | "other";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function creditAllocationErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : error instanceof Error
        ? error.message
        : "";
  switch (code) {
    case "CREDIT_ALLOCATION_STATE_STALE":
      return "Ledger changed since this preview was generated. Refresh the allocation preview and try again.";
    case "CREDIT_ALLOCATION_AMOUNT_EXCEEDS_CREDIT":
      return "The allocation amount exceeds the available credit.";
    case "CREDIT_ALLOCATION_AMOUNT_EXCEEDS_OUTSTANDING":
      return "The allocation amount exceeds the obligation outstanding amount.";
    case "CREDIT_ALLOCATION_IDEMPOTENCY_CONFLICT":
      return "This allocation request conflicts with a previous submission. Refresh and try again.";
    default:
      return "Credit allocation could not be recorded. No ledger records were changed.";
  }
}

function centsFromInput(input: string): number | null {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function formatCurrencyCents(cents: number | null | undefined): string {
  const centsNumber = Number(cents || 0);
  const negative = centsNumber < 0;
  const amount = Math.abs(centsNumber) / 100;
  return `${negative ? "-" : ""}$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedCurrencyCents(cents: number, entryType: LeaseLedgerEntry["entryType"]): string {
  const prefix = entryType === "payment" ? "-" : "+";
  return `${prefix}${formatCurrencyCents(Math.abs(Number(cents || 0)))}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function prettyLeaseStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized === "notice_pending") return "Renew letter needed";
  if (normalized === "renewal_pending") return "Renewal pending";
  if (normalized === "renewal_accepted") return "Renewing";
  if (normalized === "move_out_pending") return "Quitting";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPeriod(row: LeaseObligationLedgerRow): string {
  const start = formatDate(row.periodStart);
  const end = formatDate(row.periodEnd);
  if (start === "—" && end === "—") return "—";
  if (start !== "—" && end !== "—") return `${start} - ${end}`;
  return start !== "—" ? start : end;
}

function formatAllocationPeriod(row: Pick<LeaseCreditAllocationPreviewObligation, "periodStart" | "periodEnd">): string {
  const start = formatDate(row.periodStart);
  const end = formatDate(row.periodEnd);
  if (start === "—" && end === "—") return "—";
  if (start !== "—" && end !== "—") return `${start} - ${end}`;
  return start !== "—" ? start : end;
}

function obligationOutstandingCents(row: LeaseObligationLedgerRow): number {
  return Math.max(0, Number(row.expectedAmountCents || 0) - Number(row.paidAmountCents || 0));
}

function totalOutstandingObligationCents(
  obligationRows: LeaseObligationLedgerRow[],
  obligationSummary: LeaseObligationLedgerSummary | null
): number {
  const summaryOutstanding = Number(obligationSummary?.outstandingAmountCents);
  if (Number.isFinite(summaryOutstanding) && summaryOutstanding > 0) return Math.round(summaryOutstanding);
  return obligationRows.reduce((sum, row) => sum + obligationOutstandingCents(row), 0);
}

function hasCreditBalanceAllocationReview(balanceCents: number, outstandingObligationCents: number): boolean {
  return Number(balanceCents || 0) < 0 && Number(outstandingObligationCents || 0) > 0;
}

const obligationStatusCopy: Record<PaymentObligationStatus, { label: string; bg: string; color: string; border: string }> = {
  expected: { label: "Expected", bg: "#fffaf1", color: "#63594d", border: "rgba(91,70,48,0.18)" },
  pending: { label: "Pending", bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
  paid: { label: "Paid", bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  underpaid: { label: "Underpaid", bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" },
  overpaid: { label: "Overpaid", bg: "rgba(36,88,66,0.1)", color: "#245842", border: "rgba(36,88,66,0.22)" },
  failed: { label: "Failed", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  missing: { label: "Missing", bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  manual_review_required: { label: "Manual review", bg: "#fff6e8", color: "#5b462f", border: "rgba(184,130,62,0.34)" },
  unknown: { label: "Unknown", bg: "#fffaf1", color: "#63594d", border: "rgba(91,70,48,0.18)" },
};

const delinquencySignalCopy: Record<DelinquencySignalType, { label: string; reason: string; bg: string; color: string; border: string }> = {
  rent_due: { label: "Rent due", reason: "Rent is due by the due date", bg: "#fffaf1", color: "#63594d", border: "rgba(91,70,48,0.18)" },
  overdue: { label: "Overdue", reason: "Rent past due date", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  partially_paid: { label: "Underpaid", reason: "Partial payment received", bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" },
  failed_payment: { label: "Failed", reason: "Payment did not complete", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  missing_payment: { label: "Missing", reason: "No rent payment found after due date", bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  manual_review_required: { label: "Manual review required", reason: "Payment mismatch or incomplete evidence", bg: "#fff6e8", color: "#5b462f", border: "rgba(184,130,62,0.34)" },
};

const obligationFallbackReason: Record<PaymentObligationStatus, string> = {
  expected: "Expected rent obligation",
  pending: "Payment pending",
  paid: "Obligation satisfied",
  underpaid: "Partial payment received",
  overpaid: "Payment exceeds expected amount",
  failed: "Payment did not complete",
  missing: "Expected payment is missing",
  manual_review_required: "Payment mismatch or incomplete evidence",
  unknown: "Obligation state needs review",
};

function ObligationStatusBadge({ status }: { status: PaymentObligationStatus }) {
  const copy = obligationStatusCopy[status] || obligationStatusCopy.unknown;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: `1px solid ${copy.border}`,
        background: copy.bg,
        color: copy.color,
        padding: "3px 8px",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {copy.label}
    </span>
  );
}

function DelinquencySignalBadge({ signalType }: { signalType: DelinquencySignalType }) {
  const copy = delinquencySignalCopy[signalType];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: `1px solid ${copy.border}`,
        background: copy.bg,
        color: copy.color,
        padding: "3px 8px",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {copy.label}
    </span>
  );
}

function DecisionBadge({ severity, label }: { severity: DecisionSeverity; label: string }) {
  const style = decisionSeverityStyle[severity] || decisionSeverityStyle.info;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.color,
        padding: "3px 8px",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function statusForDecisionAction(actionType: DecisionActionType): DecisionStatus {
  if (actionType === "reviewed") return "reviewed";
  if (actionType === "snoozed") return "snoozed";
  if (actionType === "assigned") return "assigned";
  if (actionType === "dismissed") return "dismissed";
  return "resolved";
}

function currentDecisionStatus(decision: DecisionItem): DecisionStatus {
  return decision.status || "detected";
}

function decisionActionChangesStatus(decision: DecisionItem, actionType: DecisionActionType): boolean {
  return statusForDecisionAction(actionType) !== currentDecisionStatus(decision);
}

function isTerminalDecisionStatus(status: DecisionStatus): boolean {
  return status === "resolved" || status === "dismissed";
}

function decisionPassiveLabel(decision: DecisionItem): string {
  const status = currentDecisionStatus(decision);
  if (status === "resolved") return "Already resolved";
  if (status === "dismissed") return "Dismissed";
  return decisionStatusCopy[status];
}

function DecisionWorkflowPassiveState({ decision }: { decision: DecisionItem }) {
  return (
    <div style={{ border: "1px solid rgba(91,70,48,0.16)", background: "#fffaf1", borderRadius: 10, padding: "8px 10px", color: "#3f382f" }}>
      <strong>{decisionPassiveLabel(decision)}</strong>
      <div style={{ color: "#63594d", fontSize: 12, marginTop: 2 }}>
        No state-changing decision action is currently available.
      </div>
    </div>
  );
}

function decisionWithStatus(decision: DecisionItem, actionType: DecisionActionType): DecisionItem {
  const nextStatus = statusForDecisionAction(actionType);
  return {
    ...decision,
    status: nextStatus,
    latestAction: {
      actionId: `local-${decision.decisionId}-${actionType}`,
      decisionId: decision.decisionId,
      actionType,
      previousStatus: decision.status || "detected",
      nextStatus,
      createdAt: new Date().toISOString(),
    },
  };
}

function DecisionActionControls({
  decision,
  pending,
  onAction,
  primaryActionType,
}: {
  decision: DecisionItem;
  pending: boolean;
  onAction: (decision: DecisionItem, actionType: DecisionActionType) => void;
  primaryActionType?: DecisionActionType | null;
}) {
  const actions: Array<{ actionType: DecisionActionType; label: string; description: string }> = [
    {
      actionType: "reviewed",
      label: "Mark reviewed",
      description: "Marks this issue as reviewed by staff. Does not change balances or payment records.",
    },
    {
      actionType: "snoozed",
      label: "Snooze",
      description: "Temporarily hides this issue until later review. Does not affect ledger or delinquency calculations.",
    },
    {
      actionType: "assigned",
      label: "Assign",
      description: "Assigns this review item to a team/person. Does not change financial records.",
    },
    {
      actionType: "dismissed",
      label: "Dismiss",
      description: "Dismisses this signal from active review. Does not delete ledger/payment history.",
    },
    {
      actionType: "resolved",
      label: "Resolve",
      description: "Marks the operational review task as resolved. Does not automatically modify balances or obligations.",
    },
  ];
  const status = currentDecisionStatus(decision);
  if (isTerminalDecisionStatus(status)) return null;
  const availableActions = actions.filter(
    (action) => action.actionType !== primaryActionType && decisionActionChangesStatus(decision, action.actionType)
  );
  if (availableActions.length === 0) return <DecisionWorkflowPassiveState decision={decision} />;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {availableActions.map((action) => (
        <button
          key={action.actionType}
          type="button"
          disabled={pending}
          title={action.description}
          aria-label={`${action.label}: ${action.description}`}
          onClick={() => onAction(decision, action.actionType)}
          style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "6px 9px", fontWeight: 700 }}
        >
          {pending ? "Saving..." : action.label}
        </button>
      ))}
    </div>
  );
}

function readableText(value: unknown, fallback = "Not available"): string {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function metadataNumber(decision: DecisionItem, key: string): number | null {
  const value = Number(decision.metadata?.[key]);
  return Number.isFinite(value) ? value : null;
}

function metadataString(decision: DecisionItem, key: string): string | null {
  const value = String(decision.metadata?.[key] ?? "").trim();
  return value || null;
}

function recommendedDecisionAction(decision: DecisionItem): { label: string; cta: "record_payment" | "resolve"; helper: string } {
  switch (decision.decisionType) {
    case "review_overdue_rent":
    case "review_underpaid_rent":
    case "review_missing_payment":
      return {
        label: "Record payment or contact the tenant, then resolve once the ledger is updated.",
        cta: "record_payment",
        helper: "Opens the existing record payment workflow.",
      };
    case "review_failed_payment":
      return {
        label: "Review payment evidence and follow up before resolving the issue.",
        cta: "resolve",
        helper: "Marks the operational review item resolved only.",
      };
    case "review_manual_payment_issue":
      return {
        label: "Review the mismatch and resolve after the evidence is reconciled.",
        cta: "resolve",
        helper: "Marks the operational review item resolved only.",
      };
    default:
      return {
        label: "Review the issue and resolve when the source record is correct.",
        cta: "resolve",
        helper: "Marks the operational review item resolved only.",
      };
  }
}

function allocationReviewRecommendedAction(): { label: string; cta: "resolve"; helper: string } {
  return {
    label: "Review and allocate unmatched payments before taking any overdue-rent action.",
    cta: "resolve",
    helper: "Marks the operational review item resolved only after allocation review is complete.",
  };
}

function decisionActionDisplay(
  action: { label: string; cta: "record_payment" | "resolve"; helper: string },
  options: { allocationReviewRequired: boolean; status: DecisionStatus }
): { heading: string; label: string; cta: "record_payment" | "resolve"; helper: string } {
  if (options.allocationReviewRequired && options.status === "resolved") {
    return {
      heading: "Resolved outcome",
      label:
        "Marked resolved as an allocation-review item. No rent-collection action should be taken until unmatched payments are reviewed.",
      cta: action.cta,
      helper: action.helper,
    };
  }
  return {
    heading: "Recommended next action",
    ...action,
  };
}

function allocationReviewDecision(decision: DecisionItem): DecisionItem {
  return {
    ...decision,
    reason: "Payments exceed charges in aggregate, but one or more obligations remain unmatched.",
    metadata: {
      ...(decision.metadata || {}),
      signalType: "allocation_review",
      signalReasons: ["aggregate_credit_balance_with_unmatched_obligations"],
    },
  };
}

function buildDecisionSummaryFacts(
  decision: DecisionItem,
  lease: LandlordActiveLease | null,
  obligationRows: LeaseObligationLedgerRow[],
  delinquencySignals: LeaseDelinquencySignal[],
  allocationReviewRequired: boolean
) {
  const displayDecision = withDecisionReviewContext(allocationReviewRequired ? allocationReviewDecision(decision) : decision, lease);
  const reviewContext = displayDecision.metadata?.reviewContext as Record<string, string | undefined> | undefined;
  const relatedRow = findRelatedObligationRow(displayDecision, obligationRows);
  const relatedSignal = findRelatedDelinquencySignal(displayDecision, delinquencySignals);
  const outstandingAmountCents =
    relatedSignal?.outstandingAmountCents ??
    metadataNumber(displayDecision, "outstandingAmountCents") ??
    (relatedRow ? obligationOutstandingCents(relatedRow) : null);
  const dueDate = relatedSignal?.dueDate || relatedRow?.dueDate || metadataString(displayDecision, "dueDate");
  const obligationStatus = relatedRow?.obligationStatus || metadataString(displayDecision, "obligationStatus");
  const propertyUnitLabel =
    reviewContext?.propertyLabel && reviewContext?.unitLabel
      ? `${reviewContext.propertyLabel} · ${reviewContext.unitLabel}`
      : reviewContext?.propertyLabel || reviewContext?.unitLabel || "Property / unit context available";

  return {
    displayDecision,
    tenantLabel: reviewContext?.tenantName || (displayDecision.tenantId ? "Tenant context available" : "Tenant not linked"),
    propertyUnitLabel,
    outstandingAmount: outstandingAmountCents != null ? formatCurrencyCents(outstandingAmountCents) : "Not available",
    dueDate: dueDate ? formatDate(dueDate) : "Not available",
    obligationStatus: readableText(obligationStatus),
    recommendedAction: allocationReviewRequired ? allocationReviewRecommendedAction() : recommendedDecisionAction(displayDecision),
  };
}

function buildDecisionReviewContext(lease: LandlordActiveLease | null): Record<string, string> | null {
  if (!lease) return null;
  const propertyLabel = formatOperationalLabel({
    kind: "property",
    label: lease.propertyName || lease.propertyAddress || lease.propertyLabel,
    fallbackLabel: "Property",
    internalId: lease.propertyId,
  });
  const unitLabel = formatOperationalLabel({
    kind: "unit",
    label: lease.unitNumber ? `Unit ${lease.unitNumber}` : lease.unitLabel,
    fallbackLabel: "Unit",
    internalId: lease.unitId,
  });
  const tenantName = String(lease.tenantName || "").trim();
  return {
    propertyLabel,
    unitLabel,
    tenantName,
    leaseLabel: `${propertyLabel} · ${unitLabel}`,
  };
}

function withDecisionReviewContext(decision: DecisionItem, lease: LandlordActiveLease | null): DecisionItem {
  const reviewContext = buildDecisionReviewContext(lease);
  if (!reviewContext) return decision;
  return {
    ...decision,
    metadata: {
      ...(decision.metadata || {}),
      reviewContext: {
        ...(typeof decision.metadata?.reviewContext === "object" && decision.metadata.reviewContext ? decision.metadata.reviewContext : {}),
        ...reviewContext,
      },
    },
  };
}

function DecisionRow({
  decision,
  lease,
  obligationRows,
  delinquencySignals,
  allocationReviewRequired,
  pending,
  onAction,
  onRecordPayment,
}: {
  decision: DecisionItem;
  lease: LandlordActiveLease | null;
  obligationRows: LeaseObligationLedgerRow[];
  delinquencySignals: LeaseDelinquencySignal[];
  allocationReviewRequired: boolean;
  pending: boolean;
  onAction: (decision: DecisionItem, actionType: DecisionActionType) => void;
  onRecordPayment: () => void;
}) {
  const copy = decisionDisplayCopy[decision.decisionType];
  const displayCopy = allocationReviewRequired
    ? { label: "Review payment allocation", badge: "Allocation review" }
    : copy;
  const summary = buildDecisionSummaryFacts(decision, lease, obligationRows, delinquencySignals, allocationReviewRequired);
  const currentStatus = currentDecisionStatus(decision);
  const hasTerminalStatus = isTerminalDecisionStatus(currentStatus);
  const actionDisplay = decisionActionDisplay(summary.recommendedAction, { allocationReviewRequired, status: currentStatus });
  const primaryActionType = actionDisplay.cta === "resolve" && !hasTerminalStatus ? "resolved" : null;
  return (
    <div className="lease-ledger-decision-card">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong>{displayCopy.label}</strong>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "#63594d", fontSize: 12, fontWeight: 800 }}>Financial signal</span>
        <DecisionBadge severity={allocationReviewRequired ? "warning" : decision.severity} label={displayCopy.badge} />
        <span style={{ color: "#63594d", fontSize: 12, fontWeight: 800 }}>Workflow status</span>
        <span style={{ border: "1px solid rgba(91,70,48,0.18)", background: "#fffaf1", borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 800 }}>
          {decisionStatusCopy[decision.status || "detected"]}
        </span>
      </div>
      <div className="lease-ledger-decision-summary">
        <div className="lease-ledger-decision-primary">
          <span>Issue</span>
          <strong>{summary.displayDecision.reason}</strong>
        </div>
        <div>
          <span>Tenant</span>
          <strong>{summary.tenantLabel}</strong>
        </div>
        <div>
          <span>Property / unit</span>
          <strong>{summary.propertyUnitLabel}</strong>
        </div>
        <div>
          <span>Outstanding</span>
          <strong>{summary.outstandingAmount}</strong>
        </div>
        <div>
          <span>Due date</span>
          <strong>{summary.dueDate}</strong>
        </div>
        <div>
          <span>Obligation status</span>
          <strong>{summary.obligationStatus}</strong>
        </div>
      </div>
      <div className="lease-ledger-next-action">
        <div>
          <span>{actionDisplay.heading}</span>
          <strong>{actionDisplay.label}</strong>
        </div>
        {hasTerminalStatus ? (
          <DecisionWorkflowPassiveState decision={decision} />
        ) : actionDisplay.cta === "record_payment" ? (
          <button type="button" onClick={onRecordPayment} title={actionDisplay.helper}>
            Record payment
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => onAction(decision, "resolved")} title={actionDisplay.helper}>
            {pending ? "Saving..." : "Resolve"}
          </button>
        )}
      </div>
      {decision.latestAction ? (
        <div style={{ color: "#63594d", fontSize: 12 }}>Last action: {decisionStatusCopy[decision.latestAction.nextStatus]}</div>
      ) : null}
      <DecisionContextPanel
        decision={summary.displayDecision}
        obligationRows={obligationRows}
        delinquencySignals={delinquencySignals}
        internalEvidenceMode="advanced"
      />
      <DecisionActionControls decision={decision} pending={pending} onAction={onAction} primaryActionType={primaryActionType} />
    </div>
  );
}

function reasonTextFromSignal(signal: LeaseDelinquencySignal): string {
  const copy = delinquencySignalCopy[signal.signalType];
  const reason = (signal.reasons || [])[0];
  return `${copy.label} — ${copy.reason}${reason ? ` (${formatSignalReason(reason)})` : ""}`;
}

function comparableDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function signalMatchesRow(signal: LeaseDelinquencySignal, row: LeaseObligationLedgerRow): boolean {
  if (signal.paymentIntentId && row.paymentIntentId && signal.paymentIntentId === row.paymentIntentId) return true;
  if (signal.rentPaymentId && row.rentPaymentId && signal.rentPaymentId === row.rentPaymentId) return true;
  if (signal.paymentIntentId || signal.rentPaymentId) return false;
  const sameLease = signal.leaseId === row.leaseId;
  const sameExpected = Number(signal.expectedAmountCents || 0) === Number(row.expectedAmountCents || 0);
  const hasDateAnchor = Boolean(signal.periodStart || signal.periodEnd || signal.dueDate);
  const samePeriod =
    (!signal.periodStart || comparableDate(signal.periodStart) === comparableDate(row.periodStart)) &&
    (!signal.periodEnd || comparableDate(signal.periodEnd) === comparableDate(row.periodEnd)) &&
    (!signal.dueDate || comparableDate(signal.dueDate) === comparableDate(row.dueDate));
  return sameLease && sameExpected && hasDateAnchor && samePeriod;
}

function DelinquencyIndicators({
  row,
  signals,
  allocationReviewRequired = false,
  allocationAdjustment,
}: {
  row: LeaseObligationLedgerRow;
  signals: LeaseDelinquencySignal[];
  allocationReviewRequired?: boolean;
  allocationAdjustment?: ObligationAllocationAdjustment | null;
}) {
  const matchingSignals = signals.filter((signal) => signalMatchesRow(signal, row));
  if (allocationAdjustment) {
    if (allocationAdjustment.outstandingAfterAllocationCents === 0) {
      return (
        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ color: "#166534", fontWeight: 800 }}>Credit allocation recorded</span>
          <span style={{ color: "#475569", fontSize: 12 }}>
            Existing lease credit covers this obligation. Historical payment records were not edited.
          </span>
        </div>
      );
    }
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ color: "#854d0e", fontWeight: 800 }}>Allocation review</span>
        <span style={{ color: "#475569", fontSize: 12 }}>
          Existing lease credit allocation reduced this obligation. Remaining outstanding after allocation:{" "}
          {formatCurrencyCents(allocationAdjustment.outstandingAfterAllocationCents)}.
        </span>
      </div>
    );
  }
  if (allocationReviewRequired && matchingSignals.length > 0) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ color: "#854d0e", fontWeight: 800 }}>Allocation review</span>
        <span style={{ color: "#475569", fontSize: 12 }}>
          Payments exceed charges in aggregate, but this obligation remains unmatched.
        </span>
      </div>
    );
  }
  if (matchingSignals.length === 0) {
    const status = row.obligationStatus || "unknown";
    const copy = obligationStatusCopy[status] || obligationStatusCopy.unknown;
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ color: copy.color, fontWeight: 800 }}>{copy.label}</span>
        <span style={{ color: "#64748b", fontSize: 12 }}>{obligationFallbackReason[status] || obligationFallbackReason.unknown}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {matchingSignals.map((signal) => (
          <DelinquencySignalBadge key={signal.signalId} signalType={signal.signalType} />
        ))}
      </div>
      {matchingSignals.map((signal) => (
        <span key={`${signal.signalId}-reason`} style={{ color: "#475569", fontSize: 12 }}>
          {reasonTextFromSignal(signal)}
        </span>
      ))}
    </div>
  );
}

function ObligationMobileCard({
  row,
  signals,
  allocationReviewRequired,
  allocationAdjustment,
}: {
  row: LeaseObligationLedgerRow;
  signals: LeaseDelinquencySignal[];
  allocationReviewRequired: boolean;
  allocationAdjustment?: ObligationAllocationAdjustment | null;
}) {
  return (
    <article className="lease-ledger-obligation-card">
      <div className="lease-ledger-obligation-card-header">
        <div>
          <span>Period</span>
          <strong>{formatPeriod(row)}</strong>
        </div>
        <ObligationStatusBadge status={row.obligationStatus || "unknown"} />
      </div>
      <div className="lease-ledger-obligation-card-grid">
        <div>
          <span>Due date</span>
          <strong>{formatDate(row.dueDate)}</strong>
        </div>
        <div>
          <span>Expected</span>
          <strong>{formatCurrencyCents(row.expectedAmountCents)}</strong>
        </div>
        <div>
          <span>Paid</span>
          <strong>{formatCurrencyCents(row.paidAmountCents)}</strong>
        </div>
        <div>
          <span>Outstanding</span>
          {allocationAdjustment ? (
            <strong>
              {formatCurrencyCents(allocationAdjustment.outstandingAfterAllocationCents)} after allocation
            </strong>
          ) : (
            <strong>{formatCurrencyCents(obligationOutstandingCents(row))}</strong>
          )}
        </div>
      </div>
      {allocationAdjustment ? (
        <div className="lease-ledger-obligation-card-section">
          <span>Allocated from credit</span>
          <strong>{formatCurrencyCents(allocationAdjustment.allocatedCents)}</strong>
        </div>
      ) : null}
      <div className="lease-ledger-obligation-card-section">
        <span>Financial signal</span>
        <DelinquencyIndicators
          row={row}
          signals={signals}
          allocationReviewRequired={allocationReviewRequired}
          allocationAdjustment={allocationAdjustment}
        />
      </div>
      <div className="lease-ledger-obligation-card-section">
        <span>Evidence</span>
        <strong>{prettyEvidenceStatus(row)}</strong>
      </div>
    </article>
  );
}

function LedgerEntryMobileCard({ entry }: { entry: LeaseLedgerEntry }) {
  const amountColor = entry.entryType === "payment" ? "#047857" : "#0f172a";
  return (
    <article className="lease-ledger-entry-card">
      <div className="lease-ledger-entry-card-header">
        <div>
          <span>Date</span>
          <strong>{formatDate(entry.effectiveDate)}</strong>
        </div>
        <div>
          <span>Amount</span>
          <strong style={{ color: amountColor }}>{formatSignedCurrencyCents(entry.amountCents, entry.entryType)}</strong>
        </div>
      </div>
      <div className="lease-ledger-entry-card-grid">
        <div>
          <span>Type</span>
          <strong>{readableText(entry.entryType)}</strong>
        </div>
        <div>
          <span>Category</span>
          <strong>{readableText(entry.category)}</strong>
        </div>
        <div>
          <span>Method/ref</span>
          <strong>{[entry.method, entry.reference].filter(Boolean).join(" · ") || "—"}</strong>
        </div>
        <div>
          <span>Balance</span>
          <strong>{formatCurrencyCents(entry.balanceCents)}</strong>
        </div>
      </div>
      <div className="lease-ledger-entry-card-section">
        <span>Notes</span>
        <strong>{entry.notes || "—"}</strong>
      </div>
    </article>
  );
}

function leasePropertyUnitLabel(lease: LandlordActiveLease | null): string {
  if (!lease) return "Lease ledger";
  const propertyLabel = formatOperationalLabel({
    kind: "property",
    label: lease.propertyName || lease.propertyAddress || lease.propertyLabel,
    fallbackLabel: "Property",
    internalId: lease.propertyId,
  });
  const unitLabel = formatOperationalLabel({
    kind: "unit",
    label: lease.unitNumber ? `Unit ${lease.unitNumber}` : lease.unitLabel,
    fallbackLabel: "Unit",
    internalId: lease.unitId,
  });
  return `${propertyLabel} · ${unitLabel}`;
}

function printFinancialSignalText(
  row: LeaseObligationLedgerRow,
  signals: LeaseDelinquencySignal[],
  allocationReviewRequired: boolean,
  allocationAdjustment?: ObligationAllocationAdjustment | null
): string {
  const matchingSignals = signals.filter((signal) => signalMatchesRow(signal, row));
  if (allocationAdjustment) {
    if (allocationAdjustment.outstandingAfterAllocationCents === 0) {
      return "Credit allocation recorded — Existing lease credit covers this obligation. Historical payment records were not edited.";
    }
    return `Allocation review — Existing lease credit allocation reduced this obligation. Remaining outstanding after allocation: ${formatCurrencyCents(
      allocationAdjustment.outstandingAfterAllocationCents
    )}.`;
  }
  if (allocationReviewRequired && matchingSignals.length > 0) {
    return "Allocation review — Payments exceed charges in aggregate, but this obligation remains unmatched.";
  }
  if (matchingSignals.length === 0) {
    const status = row.obligationStatus || "unknown";
    const copy = obligationStatusCopy[status] || obligationStatusCopy.unknown;
    return `${copy.label} — ${obligationFallbackReason[status] || obligationFallbackReason.unknown}`;
  }
  return matchingSignals.map((signal) => reasonTextFromSignal(signal)).join("; ");
}

function printSignalReasonText(row: LeaseObligationLedgerRow, signals: LeaseDelinquencySignal[]): string | null {
  const labels = signals
    .filter((signal) => signalMatchesRow(signal, row))
    .flatMap((signal) => signal.reasons || [])
    .map((reason) => formatSignalReason(reason))
    .filter((reason) => reason !== "Not specified");
  const uniqueLabels = Array.from(new Set(labels));
  return uniqueLabels.length ? uniqueLabels.join("; ") : null;
}

function printEvidenceText(row: LeaseObligationLedgerRow, signals: LeaseDelinquencySignal[]): string {
  const signalReason = printSignalReasonText(row, signals);
  const evidence = prettyEvidenceStatus(row);
  return signalReason ? `${evidence}. Signal reason: ${signalReason}` : evidence;
}

function printLedgerEntryDescription(entry: LeaseLedgerEntry): string {
  return [
    readableText(entry.entryType),
    readableText(entry.category),
    entry.method ? readableText(entry.method) : null,
    entry.reference,
  ]
    .filter(Boolean)
    .join(" · ");
}

function LeaseLedgerPrintExport({
  lease,
  totals,
  monthlyRows,
  obligationRows,
  obligationSummary,
  outstandingObligationCents,
  hasUnallocatedCreditNotice,
  creditAllocationPreview,
  delinquencySignals,
  delinquencySummary,
  decisions,
  decisionSummary,
  entries,
  notes,
}: {
  lease: LandlordActiveLease | null;
  totals: { chargesCents: number; paymentsCents: number; balanceCents: number };
  monthlyRows: Array<[string, { chargesCents: number; paymentsCents: number; netCents: number }]>;
  obligationRows: LeaseObligationLedgerRow[];
  obligationSummary: LeaseObligationLedgerSummary | null;
  outstandingObligationCents: number;
  hasUnallocatedCreditNotice: boolean;
  creditAllocationPreview: LeaseCreditAllocationPreview | null;
  delinquencySignals: LeaseDelinquencySignal[];
  delinquencySummary: LeaseDelinquencySummary | null;
  decisions: DecisionItem[];
  decisionSummary: ReturnType<typeof summarizeDecisionItems>;
  entries: LeaseLedgerEntry[];
  notes: LeaseNote[];
}) {
  const propertyUnitLabel = leasePropertyUnitLabel(lease);
  const tenantLabel = lease?.tenantName || "Tenant not linked";
  const singleObligationRow = obligationRows.length === 1 ? obligationRows[0] : null;
  const singleObligationAllocationAdjustment = singleObligationRow
    ? allocationAdjustmentForObligation(singleObligationRow, creditAllocationPreview)
    : null;
  const creditAllocationPresentation = buildCreditAllocationPresentation(creditAllocationPreview, totals, outstandingObligationCents);
  const creditAllocationNotice = creditAllocationNoticeCopy(creditAllocationPresentation, totals.balanceCents);
  return (
    <div className="lease-ledger-print-export">
      <div className="lease-ledger-print-page lease-ledger-print-page-summary">
        <header className="lease-ledger-print-header">
          <div className="lease-ledger-print-brand">RentChain</div>
          <div>
            <h1>Lease Ledger</h1>
            <p>Operational ledger export for review and evidence reference.</p>
          </div>
          <div className="lease-ledger-print-meta">
            <div>
              <span>Property / unit</span>
              <strong>{propertyUnitLabel}</strong>
            </div>
            <div>
              <span>Tenant</span>
              <strong>{tenantLabel}</strong>
            </div>
            <div>
              <span>Lease status</span>
              <strong>{prettyLeaseStatus(lease?.status)}</strong>
            </div>
            <div>
              <span>Generated</span>
              <strong>{formatDateTime(new Date())}</strong>
            </div>
          </div>
        </header>

        <section className="lease-ledger-print-section lease-ledger-print-section-compact">
          <h2>Operational summary</h2>
          <div className="lease-ledger-print-summary-grid">
            <div>
              <span>Charges</span>
              <strong>{formatCurrencyCents(totals.chargesCents)}</strong>
            </div>
            <div>
              <span>Payments</span>
              <strong>{formatCurrencyCents(totals.paymentsCents)}</strong>
            </div>
            <div>
              <span>Balance</span>
              <strong>{formatCurrencyCents(totals.balanceCents)}</strong>
            </div>
            <div>
              <span>Outstanding obligations</span>
              <strong>{formatCurrencyCents(outstandingObligationCents)}</strong>
            </div>
            <div>
              <span>Overdue signals</span>
              <strong>{delinquencySummary?.overdueCount || 0}</strong>
            </div>
            <div>
              <span>Manual review signals</span>
              <strong>{delinquencySummary?.manualReviewCount || 0}</strong>
            </div>
          </div>
          {hasUnallocatedCreditNotice || creditAllocationPresentation.hasActiveAllocations ? (
            <div className="lease-ledger-print-warning">
              <strong>{creditAllocationNotice.title}</strong>
              {creditAllocationPresentation.hasActiveAllocations ? (
                <>
                  <span>{creditAllocationNotice.body}</span>
                  <span>{creditAllocationNotice.detail}</span>
                </>
              ) : (
                <>
                  <span>
                    This lease has an aggregate credit balance of {formatCurrencyCents(totals.balanceCents)}, but{" "}
                    {formatCurrencyCents(outstandingObligationCents)} remains outstanding on specific obligations because payments have not been matched or allocated.
                  </span>
                  <span>Review and allocate unmatched payments before taking any overdue-rent action.</span>
                </>
              )}
            </div>
          ) : null}
        </section>

        {lease?.leaseExecution ? (
          <section className="lease-ledger-print-section lease-ledger-print-section-compact lease-ledger-print-execution-section">
            <h2>Lease execution summary</h2>
            <div className="lease-ledger-print-execution-line">
              <strong>{lease.leaseExecution.executionLabel}</strong>
              <span>{lease.leaseExecution.executionDescription}</span>
            </div>
            <div className="lease-ledger-print-summary-grid lease-ledger-print-summary-grid-tight">
              <div>
                <span>Tenant signature</span>
                <strong>{lease.leaseExecution.tenantSignatureStatus.replace(/_/g, " ")}</strong>
              </div>
              <div>
                <span>Landlord signature</span>
                <strong>{lease.leaseExecution.landlordSignatureStatus.replace(/_/g, " ")}</strong>
              </div>
              <div>
                <span>Next action</span>
                <strong>{executionNextActionLabel(lease.leaseExecution.requiredNextAction)}</strong>
              </div>
            </div>
          </section>
        ) : null}

        <section className="lease-ledger-print-section lease-ledger-print-section-compact">
          <h2>Decision summary</h2>
          {decisions.length === 0 ? (
            <p>No operational decision items are currently projected for this lease.</p>
          ) : (
            <>
              <div className="lease-ledger-print-summary-grid lease-ledger-print-summary-grid-tight">
                <div>
                  <span>Active critical decisions</span>
                  <strong>{decisionSummary.critical}</strong>
                </div>
                <div>
                  <span>Active warning decisions</span>
                  <strong>{decisionSummary.warning}</strong>
                </div>
                <div>
                  <span>Active decision count</span>
                  <strong>{decisionSummary.total}</strong>
                </div>
              </div>
              <div className="lease-ledger-print-decision-list">
                {decisions.map((decision) => {
                  const summary = buildDecisionSummaryFacts(
                    decision,
                    lease,
                    obligationRows,
                    delinquencySignals,
                    hasUnallocatedCreditNotice
                  );
                  const currentStatus = currentDecisionStatus(decision);
                  const actionDisplay = decisionActionDisplay(summary.recommendedAction, {
                    allocationReviewRequired: hasUnallocatedCreditNotice,
                    status: currentStatus,
                  });
                  const copy = hasUnallocatedCreditNotice
                    ? { label: "Review payment allocation", badge: "Allocation review" }
                    : decisionDisplayCopy[decision.decisionType];
                  return (
                    <article key={decision.decisionId} className="lease-ledger-print-decision">
                      <div>
                        <strong>{copy.label}</strong>
                        <span>{copy.badge} · {decisionStatusCopy[currentDecisionStatus(decision)]}</span>
                      </div>
                      <div>
                        <span>Issue</span>
                        <strong>{summary.displayDecision.reason}</strong>
                      </div>
                      <div>
                        <span>{actionDisplay.heading}</span>
                        <strong>{actionDisplay.label}</strong>
                      </div>
                      {isTerminalDecisionStatus(currentStatus) ? (
                        <div>
                          <span>Action state</span>
                          <strong>{decisionPassiveLabel(decision)} · No state-changing decision action is currently available.</strong>
                        </div>
                      ) : null}
                      {decision.latestAction ? (
                        <div>
                          <span>Last action</span>
                          <strong>
                            {decisionStatusCopy[decision.latestAction.nextStatus]} · {formatDateTime(decision.latestAction.createdAt)}
                          </strong>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section className="lease-ledger-print-section lease-ledger-print-section-compact">
          <h2>Payment obligation summary</h2>
          <div className="lease-ledger-print-summary-grid lease-ledger-print-summary-grid-tight">
            <div>
              <span>Expected</span>
              <strong>{formatCurrencyCents(obligationSummary?.expectedAmountCents || 0)}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{formatCurrencyCents(obligationSummary?.paidAmountCents || 0)}</strong>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>{formatCurrencyCents(obligationSummary?.outstandingAmountCents || 0)}</strong>
            </div>
            <div>
              <span>Manual review</span>
              <strong>{obligationSummary?.manualReviewCount || 0}</strong>
            </div>
          </div>
          {obligationRows.length === 0 ? (
            <p>Obligation ledger is not available yet for this lease.</p>
          ) : singleObligationRow ? (
            <article className="lease-ledger-print-obligation-card">
              <div>
                <span>Period</span>
                <strong>{formatPeriod(singleObligationRow)}</strong>
              </div>
              <div>
                <span>Due date</span>
                <strong>{formatDate(singleObligationRow.dueDate)}</strong>
              </div>
              <div>
                <span>Expected</span>
                <strong>{formatCurrencyCents(singleObligationRow.expectedAmountCents)}</strong>
              </div>
              <div>
                <span>Paid</span>
                <strong>{formatCurrencyCents(singleObligationRow.paidAmountCents)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                {singleObligationAllocationAdjustment ? (
                  <strong>
                    {formatCurrencyCents(singleObligationAllocationAdjustment.outstandingAfterAllocationCents)} after allocation
                  </strong>
                ) : (
                  <strong>{formatCurrencyCents(obligationOutstandingCents(singleObligationRow))}</strong>
                )}
              </div>
              <div>
                <span>Status</span>
                <strong>{obligationStatusCopy[singleObligationRow.obligationStatus || "unknown"]?.label || obligationStatusCopy.unknown.label}</strong>
              </div>
              <div className="lease-ledger-print-obligation-card-wide">
                <span>Financial signal</span>
                <strong>
                  {printFinancialSignalText(
                    singleObligationRow,
                    delinquencySignals,
                    hasUnallocatedCreditNotice,
                    singleObligationAllocationAdjustment
                  )}
                </strong>
              </div>
              <div className="lease-ledger-print-obligation-card-wide">
                <span>Evidence</span>
                <strong>{printEvidenceText(singleObligationRow, delinquencySignals)}</strong>
              </div>
            </article>
          ) : (
            <div className="lease-ledger-print-table-wrap">
              <table className="lease-ledger-print-table lease-ledger-print-obligations-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Due date</th>
                    <th>Expected</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Financial signal</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {obligationRows.map((row) => {
                    const allocationAdjustment = allocationAdjustmentForObligation(row, creditAllocationPreview);
                    return (
                      <tr key={row.rowId}>
                        <td>{formatPeriod(row)}</td>
                        <td>{formatDate(row.dueDate)}</td>
                        <td>{formatCurrencyCents(row.expectedAmountCents)}</td>
                        <td>{formatCurrencyCents(row.paidAmountCents)}</td>
                        <td>
                          {allocationAdjustment
                            ? `${formatCurrencyCents(allocationAdjustment.outstandingAfterAllocationCents)} after allocation`
                            : formatCurrencyCents(obligationOutstandingCents(row))}
                        </td>
                        <td>{obligationStatusCopy[row.obligationStatus || "unknown"]?.label || obligationStatusCopy.unknown.label}</td>
                        <td>{printFinancialSignalText(row, delinquencySignals, hasUnallocatedCreditNotice, allocationAdjustment)}</td>
                        <td>{printEvidenceText(row, delinquencySignals)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="lease-ledger-print-page lease-ledger-print-page-detail">
        <section className="lease-ledger-print-section">
          <h2>Ledger entries</h2>
          {entries.length === 0 ? (
            <p>No ledger entries are available for this range.</p>
          ) : (
            <div className="lease-ledger-print-table-wrap">
              <table className="lease-ledger-print-table lease-ledger-print-ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.effectiveDate)}</td>
                      <td>{printLedgerEntryDescription(entry)}</td>
                      <td>{formatSignedCurrencyCents(entry.amountCents, entry.entryType)}</td>
                      <td>{formatCurrencyCents(entry.balanceCents)}</td>
                      <td>{entry.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {monthlyRows.length ? (
          <section className="lease-ledger-print-section lease-ledger-print-section-compact">
            <h2>Monthly totals</h2>
            <div className="lease-ledger-print-table-wrap">
              <table className="lease-ledger-print-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Charges</th>
                    <th>Payments</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map(([month, row]) => (
                    <tr key={month}>
                      <td>{month}</td>
                      <td>{formatCurrencyCents(row.chargesCents)}</td>
                      <td>{formatCurrencyCents(row.paymentsCents)}</td>
                      <td>{formatCurrencyCents(row.netCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="lease-ledger-print-section lease-ledger-print-section-compact lease-ledger-print-notes-section">
          <h2>Lease notes</h2>
          {notes.length === 0 ? (
            <p>No lease notes yet.</p>
          ) : (
            <div className="lease-ledger-print-note-list">
              {notes.map((note) => (
                <article key={note.id}>
                  <strong>{formatDateTime(note.createdAt)}</strong>
                  <span>{note.note}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function prettyEvidenceStatus(row: LeaseObligationLedgerRow): string {
  const evidence = String(row.evidenceStatus || "").trim();
  if (evidence) return evidence.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const fallback = row.reconciliationStatus || row.rentPaymentStatus || row.paymentIntentStatus || row.source;
  return String(fallback || "none").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function executionNextActionLabel(value: string | null | undefined) {
  switch (String(value || "").trim().toLowerCase()) {
    case "tenant_signature":
      return "Tenant signature";
    case "landlord_signature":
      return "Landlord signature";
    case "review_signed_lease":
      return "Review signed lease";
    case "none":
      return "No action needed";
    default:
      return "Complete lease details";
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 80,
};

const modalCard: React.CSSProperties = {
  width: "min(560px, 96vw)",
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#fff",
  boxShadow: "0 20px 50px rgba(15,23,42,0.2)",
  padding: 18,
};

function createAllocationIdempotencyKey(leaseId: string, obligationRowId: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `lease-credit-allocation:${leaseId}:${obligationRowId}:${random}`;
}

type CreditAllocationPresentation = {
  hasActiveAllocations: boolean;
  activeAllocatedCents: number;
  remainingCreditCents: number;
  adjustedOutstandingCents: number;
};

type ObligationAllocationAdjustment = {
  allocationIds: string[];
  allocatedCents: number;
  outstandingAfterAllocationCents: number;
};

function sumAllocationAmountCents(allocations: LeaseCreditAllocationSummary[]): number {
  return allocations.reduce((total, allocation) => total + Math.max(0, Number(allocation.allocationAmountCents || 0)), 0);
}

function buildCreditAllocationPresentation(
  preview: LeaseCreditAllocationPreview | null,
  totals: { balanceCents: number },
  outstandingObligationCents: number
): CreditAllocationPresentation {
  const activeAllocations = preview?.existingActiveAllocations || [];
  const activeAllocatedCents =
    Number(preview?.activeAllocationAmountCents || 0) || sumAllocationAmountCents(activeAllocations);
  const grossCreditCents = Math.max(0, Number(preview?.grossAvailableCreditCents ?? Math.abs(Math.min(0, totals.balanceCents))));
  const remainingCreditCents = Math.max(
    0,
    Number(preview?.availableCreditCents ?? preview?.remainingAvailableCreditCents ?? grossCreditCents - activeAllocatedCents)
  );
  const adjustedOutstandingCents = Math.max(
    0,
    Number(preview?.totalOutstandingAmountCents ?? outstandingObligationCents - activeAllocatedCents)
  );
  return {
    hasActiveAllocations: activeAllocations.length > 0 || activeAllocatedCents > 0,
    activeAllocatedCents,
    remainingCreditCents,
    adjustedOutstandingCents,
  };
}

function allocationAdjustmentForObligation(
  row: LeaseObligationLedgerRow,
  preview: LeaseCreditAllocationPreview | null
): ObligationAllocationAdjustment | null {
  const matchingAllocations = (preview?.existingActiveAllocations || []).filter(
    (allocation) => allocation.obligationRowId === row.rowId
  );
  if (matchingAllocations.length === 0) return null;
  const allocatedCents = sumAllocationAmountCents(matchingAllocations);
  const latestAllocation = [...matchingAllocations].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
  const outstandingAfterAllocationCents = Math.max(
    0,
    Number(latestAllocation?.afterOutstandingAmountCents ?? obligationOutstandingCents(row) - allocatedCents)
  );
  return {
    allocationIds: matchingAllocations.map((allocation) => allocation.allocationId),
    allocatedCents,
    outstandingAfterAllocationCents,
  };
}

function creditAllocationNoticeCopy(
  presentation: CreditAllocationPresentation,
  aggregateBalanceCents: number
): { title: string; body: string; detail: string } {
  if (!presentation.hasActiveAllocations) {
    return {
      title: "Credit balance needs allocation review",
      body: "",
      detail: "",
    };
  }
  if (presentation.remainingCreditCents > 0) {
    return {
      title: "Remaining lease credit available",
      body: `This lease has ${formatCurrencyCents(
        presentation.remainingCreditCents
      )} of unallocated credit remaining after applying ${formatCurrencyCents(
        presentation.activeAllocatedCents
      )} to the unmatched obligation.`,
      detail: `The aggregate ledger balance remains ${formatCurrencyCents(
        aggregateBalanceCents
      )} because historical payment records were not edited. Obligation outstanding after allocation: ${formatCurrencyCents(
        presentation.adjustedOutstandingCents
      )}.`,
    };
  }
  return {
    title: "Credit allocation recorded",
    body:
      "Existing lease credit has been allocated to the previously unmatched obligation. The aggregate ledger balance remains a credit because historical payment records were not edited.",
    detail: `Obligation outstanding after allocation: ${formatCurrencyCents(presentation.adjustedOutstandingCents)}.`,
  };
}

function CreditAllocationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="lease-credit-allocation-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActiveAllocationSummary({ allocation }: { allocation: LeaseCreditAllocationSummary }) {
  return (
    <article className="lease-credit-allocation-history-item">
      <div>
        <span>Allocation ID</span>
        <strong>{allocation.allocationId}</strong>
      </div>
      <div>
        <span>Amount allocated</span>
        <strong>{formatCurrencyCents(allocation.allocationAmountCents)}</strong>
      </div>
      <div>
        <span>Remaining credit after allocation</span>
        <strong>{formatCurrencyCents(allocation.afterAvailableCreditCents)}</strong>
      </div>
      <div>
        <span>Obligation outstanding after allocation</span>
        <strong>{formatCurrencyCents(allocation.afterOutstandingAmountCents)}</strong>
      </div>
    </article>
  );
}

function LeaseCreditAllocationPanel({
  preview,
  loading,
  error,
  reviewed,
  submitting,
  success,
  successObligation,
  onReviewedChange,
  onApply,
  onRefresh,
}: {
  preview: LeaseCreditAllocationPreview | null;
  loading: boolean;
  error: string | null;
  reviewed: boolean;
  submitting: boolean;
  success: ApplyCreditAllocationResponse | null;
  successObligation: LeaseCreditAllocationPreviewObligation | null;
  onReviewedChange: (checked: boolean) => void;
  onApply: (obligation: LeaseCreditAllocationPreviewObligation) => void;
  onRefresh: () => void;
}) {
  if (loading && !preview) {
    return (
      <section className="lease-credit-allocation-panel lease-ledger-no-print" aria-label="Credit allocation review">
        <h2>Allocate available lease credit</h2>
        <p>Loading allocation preview…</p>
      </section>
    );
  }

  const suggestion = preview?.suggestedAllocations?.[0] || null;
  const obligation = suggestion
    ? preview?.eligibleObligations?.find((item) => item.obligationRowId === suggestion.obligationRowId) || preview?.eligibleObligations?.[0] || null
    : preview?.eligibleObligations?.[0] || null;
  const activeAllocations = preview?.existingActiveAllocations || [];
  const shouldRender = Boolean(success || (preview?.allowed && suggestion && obligation) || activeAllocations.length > 0);
  if (!shouldRender) return null;

  const allocationAmountCents = suggestion?.allocationAmountCents || obligation?.suggestedAllocationAmountCents || 0;
  const remainingCreditCents = suggestion?.afterAvailableCreditCents ?? obligation?.afterAvailableCreditCents ?? preview?.remainingAvailableCreditCents ?? 0;
  const outstandingAfterCents =
    suggestion?.afterOutstandingAmountCents ?? obligation?.obligationOutstandingAfterCents ?? Math.max(0, Number(obligation?.outstandingAmountCents || 0) - allocationAmountCents);
  const applyDisabled = !reviewed || submitting || !preview?.previewFingerprint || !obligation || allocationAmountCents <= 0;

  return (
    <section className="lease-credit-allocation-panel lease-ledger-no-print" aria-label="Credit allocation review">
      <div className="lease-credit-allocation-header">
        <div>
          <h2>Allocate available lease credit</h2>
          <p>
            This lease has available credit, but one or more obligations remain unmatched. Review the suggested allocation before applying
            credit to the obligation.
          </p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading || submitting}>
          {loading ? "Refreshing…" : "Refresh preview"}
        </button>
      </div>

      {success ? (
        <div className="lease-credit-allocation-success" role="status">
          <strong>Credit allocation recorded</strong>
          <span>Existing lease credit was applied to this obligation.</span>
          <span>Historical payment records were not edited.</span>
          <div className="lease-credit-allocation-metrics">
            <CreditAllocationMetric label="Allocation ID" value={success.allocation.allocationId} />
            <CreditAllocationMetric label="Amount allocated" value={formatCurrencyCents(success.allocation.allocationAmountCents)} />
            <CreditAllocationMetric label="Obligation period" value={formatAllocationPeriod({
              periodStart: successObligation?.periodStart || obligation?.periodStart || null,
              periodEnd: successObligation?.periodEnd || obligation?.periodEnd || null,
            })} />
            <CreditAllocationMetric label="Obligation due date" value={formatDate(successObligation?.dueDate || obligation?.dueDate || null)} />
            <CreditAllocationMetric label="Remaining credit after allocation" value={formatCurrencyCents(success.allocation.afterAvailableCreditCents)} />
            <CreditAllocationMetric label="Obligation outstanding after allocation" value={formatCurrencyCents(success.allocation.afterOutstandingAmountCents)} />
          </div>
          <p className="lease-credit-allocation-note">
            This allocation records how existing lease credit was applied to an obligation. It does not edit historical payment records.
          </p>
        </div>
      ) : null}

      {preview && obligation && suggestion ? (
        <>
          <div className="lease-credit-allocation-metrics">
            <CreditAllocationMetric label="Available credit" value={formatCurrencyCents(preview.availableCreditCents)} />
            <CreditAllocationMetric label="Outstanding obligation" value={formatCurrencyCents(obligation.outstandingAmountCents)} />
            <CreditAllocationMetric label="Suggested allocation" value={formatCurrencyCents(allocationAmountCents)} />
            <CreditAllocationMetric label="Remaining credit after allocation" value={formatCurrencyCents(remainingCreditCents)} />
          </div>

          <div className="lease-credit-allocation-obligation">
            <div>
              <span>Period</span>
              <strong>{formatAllocationPeriod(obligation)}</strong>
            </div>
            <div>
              <span>Due date</span>
              <strong>{formatDate(obligation.dueDate)}</strong>
            </div>
            <div>
              <span>Expected</span>
              <strong>{formatCurrencyCents(obligation.expectedAmountCents)}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{formatCurrencyCents(obligation.paidAmountCents)}</strong>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>{formatCurrencyCents(obligation.outstandingAmountCents)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>Allocation review</strong>
            </div>
            <div>
              <span>Evidence</span>
              <strong>Existing lease credit available for operator-reviewed allocation</strong>
            </div>
            <div>
              <span>Obligation outstanding after allocation</span>
              <strong>{formatCurrencyCents(outstandingAfterCents)}</strong>
            </div>
          </div>

          <label className="lease-credit-allocation-confirmation">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => onReviewedChange(event.target.checked)}
              disabled={submitting}
            />
            <span>I have reviewed the credit balance and obligation details.</span>
          </label>
          <p className="lease-credit-allocation-note">
            This records an allocation review and does not edit historical payment records.
          </p>

          {error ? <div className="lease-credit-allocation-error" role="alert">{error}</div> : null}

          <div className="lease-credit-allocation-actions">
            <button type="button" onClick={() => onApply(obligation)} disabled={applyDisabled}>
              {submitting ? "Recording allocation…" : "Apply credit allocation"}
            </button>
          </div>
        </>
      ) : null}

      {activeAllocations.length > 0 ? (
        <div className="lease-credit-allocation-history">
          <h3>Active allocation history</h3>
          <p>These records show operator-reviewed allocations. Reversal controls are deferred to a follow-up workflow.</p>
          {activeAllocations.map((allocation) => (
            <ActiveAllocationSummary key={allocation.allocationId} allocation={allocation} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function LeaseLedgerPage() {
  const { leaseId = "" } = useParams();
  const printSourceRef = React.useRef<HTMLDivElement | null>(null);
  const printExportRef = React.useRef<HTMLDivElement | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaseLedgerEntry[]>([]);
  const [totals, setTotals] = useState({ chargesCents: 0, paymentsCents: 0, balanceCents: 0 });
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, { chargesCents: number; paymentsCents: number; netCents: number }>>({});
  const [obligationRows, setObligationRows] = useState<LeaseObligationLedgerRow[]>([]);
  const [obligationSummary, setObligationSummary] = useState<LeaseObligationLedgerSummary | null>(null);
  const [delinquencySignals, setDelinquencySignals] = useState<LeaseDelinquencySignal[]>([]);
  const [delinquencySummary, setDelinquencySummary] = useState<LeaseDelinquencySummary | null>(null);
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [decisionActionPendingId, setDecisionActionPendingId] = useState<string | null>(null);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lease, setLease] = useState<LandlordActiveLease | null>(null);
  const [notes, setNotes] = useState<LeaseNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isPrintExportMounted, setIsPrintExportMounted] = useState(false);
  const [creditAllocationPreview, setCreditAllocationPreview] = useState<LeaseCreditAllocationPreview | null>(null);
  const [creditAllocationLoading, setCreditAllocationLoading] = useState(false);
  const [creditAllocationError, setCreditAllocationError] = useState<string | null>(null);
  const [creditAllocationReviewed, setCreditAllocationReviewed] = useState(false);
  const [creditAllocationSubmitting, setCreditAllocationSubmitting] = useState(false);
  const [creditAllocationSuccess, setCreditAllocationSuccess] = useState<ApplyCreditAllocationResponse | null>(null);
  const [creditAllocationSuccessObligation, setCreditAllocationSuccessObligation] =
    useState<LeaseCreditAllocationPreviewObligation | null>(null);

  const [chargeDate, setChargeDate] = useState(todayIso());
  const [chargeType, setChargeType] = useState<ChargeType>("rent");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeNotes, setChargeNotes] = useState("");

  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("etransfer");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const decisionSummary = useMemo(() => summarizeDecisionItems(decisions), [decisions]);
  const outstandingObligationCents = useMemo(
    () => totalOutstandingObligationCents(obligationRows, obligationSummary),
    [obligationRows, obligationSummary]
  );
  const hasLeaseCreditBalance = totals.balanceCents < 0;
  const hasUnallocatedCreditNotice = hasCreditBalanceAllocationReview(totals.balanceCents, outstandingObligationCents);
  const creditAllocationPresentation = useMemo(
    () => buildCreditAllocationPresentation(creditAllocationPreview, totals, outstandingObligationCents),
    [creditAllocationPreview, totals, outstandingObligationCents]
  );
  const creditAllocationNotice = creditAllocationNoticeCopy(creditAllocationPresentation, totals.balanceCents);

  const monthlyRows = useMemo(() => {
    return Object.entries(monthlyTotals).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [monthlyTotals]);

  const loadLedger = async (options: { showLoading?: boolean } = {}) => {
    if (!leaseId) return;
    const showLoading = options.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetchLeaseLedger(leaseId, from || undefined, to || undefined);
      setEntries(Array.isArray(res.entries) ? res.entries : []);
      setTotals(res.totals || { chargesCents: 0, paymentsCents: 0, balanceCents: 0 });
      setMonthlyTotals(res.monthlyTotals || {});
      setObligationRows(Array.isArray(res.obligationRows) ? res.obligationRows : []);
      setObligationSummary(res.obligationSummary || null);
      setDelinquencySignals(Array.isArray(res.delinquencySignals) ? res.delinquencySignals : []);
      setDelinquencySummary(res.delinquencySummary || null);
      setDecisions(Array.isArray(res.decisions) ? res.decisions : []);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load lease ledger"));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadCreditAllocationPreview = async () => {
    if (!leaseId) return;
    setCreditAllocationLoading(true);
    setCreditAllocationError(null);
    try {
      const preview = await fetchCreditAllocationPreview(leaseId);
      setCreditAllocationPreview(preview);
      setCreditAllocationReviewed(false);
    } catch (err: unknown) {
      setCreditAllocationPreview(null);
      setCreditAllocationError(creditAllocationErrorMessage(err));
    } finally {
      setCreditAllocationLoading(false);
    }
  };

  const handleDecisionAction = async (decision: DecisionItem, actionType: DecisionActionType) => {
    if (!leaseId) return;
    if (!decisionActionChangesStatus(decision, actionType)) return;
    setDecisionActionPendingId(decision.decisionId);
    const snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const result = await patchDecisionAction(decision.decisionId, {
        leaseId,
        actionType,
        decision,
        assignedTo: actionType === "assigned" ? "operations" : undefined,
        snoozedUntil: actionType === "snoozed" ? snoozedUntil : undefined,
      });
      const nextDecision = result?.decision || decisionWithStatus(decision, actionType);
      setDecisions((current) => current.map((item) => (item.decisionId === decision.decisionId ? nextDecision : item)));
      await loadLedger({ showLoading: false });
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to update decision"));
    } finally {
      setDecisionActionPendingId(null);
    }
  };

  const loadLeaseMeta = async () => {
    if (!leaseId) return;
    try {
      const [leaseResponse, notesResponse] = await Promise.all([
        getLeaseById(leaseId),
        getLeaseNotes(leaseId),
      ]);
      setLease(leaseResponse.lease || null);
      setNotes(Array.isArray(notesResponse.notes) ? notesResponse.notes : []);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load lease details"));
    }
  };

  useEffect(() => {
    loadLedger();
    void loadLeaseMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId]);

  useEffect(() => {
    if (!leaseId || !hasLeaseCreditBalance) {
      setCreditAllocationPreview(null);
      setCreditAllocationError(null);
      setCreditAllocationReviewed(false);
      setCreditAllocationSuccess(null);
      setCreditAllocationSuccessObligation(null);
      return;
    }
    void loadCreditAllocationPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId, hasLeaseCreditBalance, totals.balanceCents, outstandingObligationCents]);

  async function submitCreditAllocation(obligation: LeaseCreditAllocationPreviewObligation) {
    if (!leaseId || !creditAllocationPreview) return;
    const suggestion = creditAllocationPreview.suggestedAllocations.find((item) => item.obligationRowId === obligation.obligationRowId);
    const allocationAmountCents = suggestion?.allocationAmountCents || obligation.suggestedAllocationAmountCents;
    if (!creditAllocationReviewed || !creditAllocationPreview.previewFingerprint || !allocationAmountCents) return;
    setCreditAllocationSubmitting(true);
    setCreditAllocationError(null);
    try {
      const result = await applyCreditAllocation(leaseId, {
        obligationRowId: obligation.obligationRowId,
        allocationAmountCents,
        previewFingerprint: creditAllocationPreview.previewFingerprint,
        idempotencyKey: createAllocationIdempotencyKey(leaseId, obligation.obligationRowId),
      });
      setCreditAllocationSuccess(result);
      setCreditAllocationSuccessObligation(obligation);
      setCreditAllocationPreview(result.preview);
      setCreditAllocationReviewed(false);
      await loadLedger({ showLoading: false });
    } catch (err: unknown) {
      setCreditAllocationError(creditAllocationErrorMessage(err));
      if (typeof err === "object" && err && "preview" in err) {
        const preview = (err as { preview?: LeaseCreditAllocationPreview }).preview;
        if (preview) setCreditAllocationPreview(preview);
      }
    } finally {
      setCreditAllocationSubmitting(false);
    }
  }

  async function submitNote() {
    const note = noteText.trim();
    if (!note) {
      setError("Note text is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createLeaseNote(leaseId, note);
      setNoteText("");
      setShowNoteModal(false);
      await loadLeaseMeta();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save lease note"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (!lease) return;
    const isArchived = Boolean(lease.archivedAt);
    const confirmed = window.confirm(
      isArchived
        ? "Restore this lease to the active lease workspace?"
        : "Archive this lease from the landlord lease workspace? You can restore it later from View archive."
    );
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      if (isArchived) {
        await restoreLeaseRecord(lease.id);
      } else {
        await archiveLeaseRecord(lease.id);
      }
      await loadLeaseMeta();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to update archive state"));
    } finally {
      setSaving(false);
    }
  }

  async function submitCharge() {
    const amountCents = centsFromInput(chargeAmount);
    if (!amountCents) {
      setError("Charge amount must be greater than 0.");
      return;
    }
    if (!chargeDate) {
      setError("Charge date is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addLeaseCharge(leaseId, {
        amountCents,
        date: chargeDate,
        type: chargeType,
        notes: chargeNotes.trim() || undefined,
      });
      setShowChargeModal(false);
      setChargeAmount("");
      setChargeNotes("");
      await loadLedger();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to add charge"));
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment() {
    const amountCents = centsFromInput(paymentAmount);
    if (!amountCents) {
      setError("Payment amount must be greater than 0.");
      return;
    }
    if (!paymentDate) {
      setError("Payment date is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addLeasePayment(leaseId, {
        amountCents,
        date: paymentDate,
        method: paymentMethod,
        reference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      await loadLedger();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to record payment"));
    } finally {
      setSaving(false);
    }
  }

  async function exportLedger(format: "csv" | "pdf") {
    const isPdf = format === "pdf";
    try {
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      const queryString = query.toString();
      const path = `/leases/${encodeURIComponent(leaseId)}/ledger/export.${format}${queryString ? `?${queryString}` : ""}`;
      const exportSlug = slugifyOperationalReference(
        [
          "lease-ledger",
          lease?.propertyName || lease?.propertyAddress || "property",
          lease?.unitNumber ? `unit-${lease.unitNumber}` : lease?.unitLabel || "unit",
        ],
        "lease-ledger"
      );
      const { blob, filename } = await downloadAuthenticatedExport({
        path,
        fallbackFilename: `${exportSlug}.${format}`,
        errorMessage: `Failed to export ${format.toUpperCase()}`,
        observability: isPdf
          ? {
              exportType: "lease_ledger",
              renderingPath: "backend_pdfkit",
            }
          : undefined,
      });
      triggerDocumentDownload({ blob, filename, urlApi: URL });
    } catch (err: unknown) {
      setError(errorMessage(err, `Failed to export ${format.toUpperCase()}`));
    }
  }

  async function printOrExportLedgerPdf() {
    if (typeof window !== "undefined" && typeof window.print === "function") {
      setIsPrintExportMounted(true);
      await nextRenderFrame(window);
      const printableSource = printExportRef.current || printSourceRef.current;
      if (!printableSource || typeof document === "undefined") {
        setIsPrintExportMounted(false);
        window.print();
        return;
      }

      const body = document.body;
      const previousMode = body.getAttribute(PRINT_MODE_ATTRIBUTE);
      const printableRoot = createPrintRoot(document);
      printableRoot.classList.add("lease-ledger-print-root");
      printableRoot.appendChild(printableSource.cloneNode(true));
      let cleanedUp = false;

      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        window.removeEventListener("afterprint", cleanup);
        printableRoot.remove();
        setIsPrintExportMounted(false);
        body.removeAttribute(PRINT_ROOT_ACTIVE_ATTRIBUTE);
        if (previousMode) {
          body.setAttribute(PRINT_MODE_ATTRIBUTE, previousMode);
        } else {
          body.removeAttribute(PRINT_MODE_ATTRIBUTE);
        }
      };

      try {
        body.setAttribute(PRINT_MODE_ATTRIBUTE, "lease-ledger");
        body.setAttribute(PRINT_ROOT_ACTIVE_ATTRIBUTE, "true");
        body.appendChild(printableRoot);
        window.addEventListener("afterprint", cleanup, { once: true });
        await nextRenderFrame(window);
        window.print();
      } finally {
        window.setTimeout(cleanup, 250);
      }
      return;
    }
    await exportLedger("pdf");
  }

  return (
    <div className="lease-ledger-page" ref={printSourceRef}>
      {isPrintExportMounted ? (
        <div ref={printExportRef} aria-hidden="true">
          <LeaseLedgerPrintExport
            lease={lease}
            totals={totals}
            monthlyRows={monthlyRows}
            obligationRows={obligationRows}
            obligationSummary={obligationSummary}
            outstandingObligationCents={outstandingObligationCents}
            hasUnallocatedCreditNotice={hasUnallocatedCreditNotice}
            creditAllocationPreview={creditAllocationPreview}
            delinquencySignals={delinquencySignals}
            delinquencySummary={delinquencySummary}
            decisions={decisions}
            decisionSummary={decisionSummary}
            entries={entries}
            notes={notes}
          />
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem" }}>Lease Ledger</h1>
          <div style={{ color: "#475569", marginTop: 4 }}>
            {lease
              ? `${formatOperationalLabel({ kind: "property", label: lease.propertyName || lease.propertyAddress, fallbackLabel: "Property", internalId: lease.propertyId })} · ${formatOperationalLabel({ kind: "unit", label: lease.unitNumber ? `Unit ${lease.unitNumber}` : lease.unitLabel, fallbackLabel: "Unit", internalId: lease.unitId })}`
              : "Lease ledger"}
          </div>
          <details className="lease-ledger-advanced-reference">
            <summary>Advanced lease reference</summary>
            <div>{formatInternalReference("lease", leaseId)}</div>
          </details>
          {lease ? (
            <div style={{ color: "#334155", marginTop: 6, display: "grid", gap: 2 }}>
              <div>
                {lease.tenantName || "Tenant not linked"} · {prettyLeaseStatus(lease.status)}
                {lease.archivedAt ? ` · Archived ${formatDate(lease.archivedAt)}` : ""}
              </div>
            </div>
          ) : null}
        </div>
        <div className="lease-ledger-actions">
          <Link to={`/leases/${encodeURIComponent(leaseId)}/summary`}>Back to lease summary</Link>
          <Link to="/operations">Open operations</Link>
          <Link to="/leases?view=archived">View archive</Link>
          <button aria-label="Add lease note" onClick={() => setShowNoteModal(true)}>Add note</button>
          <button onClick={() => setShowChargeModal(true)}>Add charge</button>
          <button onClick={() => setShowPaymentModal(true)}>Record payment</button>
          <button onClick={() => void exportLedger("csv")}>Export CSV</button>
          <button onClick={() => void printOrExportLedgerPdf()}>Print / Save PDF</button>
          <button onClick={() => void toggleArchive()} disabled={saving || !lease}>
            {lease?.archivedAt ? "Restore lease" : "Archive lease"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#3f382f" }}>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#3f382f" }}>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={loadLedger}>Apply</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 10, padding: 10, background: "#fff6e8", boxShadow: "0 10px 24px rgba(59,44,28,0.08)" }}>
          <div style={{ fontSize: 12, color: "#63594d" }}>Charges</div>
          <strong>{formatCurrencyCents(totals.chargesCents)}</strong>
        </div>
        <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 10, padding: 10, background: "#fff6e8", boxShadow: "0 10px 24px rgba(59,44,28,0.08)" }}>
          <div style={{ fontSize: 12, color: "#63594d" }}>Payments</div>
          <strong>{formatCurrencyCents(totals.paymentsCents)}</strong>
        </div>
        <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 10, padding: 10, background: "#fff6e8", boxShadow: "0 10px 24px rgba(59,44,28,0.08)" }}>
          <div style={{ fontSize: 12, color: "#63594d" }}>Balance</div>
          <strong>{formatCurrencyCents(totals.balanceCents)}</strong>
        </div>
      </div>
      {hasUnallocatedCreditNotice || creditAllocationPresentation.hasActiveAllocations ? (
        <div style={{ border: "1px solid #fde68a", borderRadius: 12, padding: 12, background: "#fffbeb", color: "#713f12", display: "grid", gap: 4 }}>
          <strong>{creditAllocationNotice.title}</strong>
          {creditAllocationPresentation.hasActiveAllocations ? (
            <>
              <span>{creditAllocationNotice.body}</span>
              <span>{creditAllocationNotice.detail}</span>
            </>
          ) : (
            <>
              <span>
                This lease has an aggregate credit balance of {formatCurrencyCents(totals.balanceCents)}, but{" "}
                {formatCurrencyCents(outstandingObligationCents)} remains outstanding on specific obligations because payments have not been
                matched or allocated to those obligations.
              </span>
              <span>Review the obligation rows before resolving overdue decisions.</span>
            </>
          )}
        </div>
      ) : null}

      {hasLeaseCreditBalance ? (
        <LeaseCreditAllocationPanel
          preview={creditAllocationPreview}
          loading={creditAllocationLoading}
          error={creditAllocationError}
          reviewed={creditAllocationReviewed}
          submitting={creditAllocationSubmitting}
          success={creditAllocationSuccess}
          successObligation={creditAllocationSuccessObligation}
          onReviewedChange={setCreditAllocationReviewed}
          onApply={(obligation) => void submitCreditAllocation(obligation)}
          onRefresh={() => void loadCreditAllocationPreview()}
        />
      ) : null}

      <section className="lease-ledger-csv-card">
        <div className="lease-ledger-csv-card-header">
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#211c17" }}>AI-assisted payment CSV import</div>
            <div style={{ color: "#63594d", fontSize: 13, marginTop: 3 }}>
              Upload payment rows when you need assisted matching.
            </div>
          </div>
          <button type="button" onClick={() => setIsCsvImportOpen((current) => !current)}>
            {isCsvImportOpen ? "Hide" : "Import payments CSV"}
          </button>
        </div>
        {isCsvImportOpen ? (
          <div className="lease-ledger-csv-panel">
            <PaymentCsvImportPreviewCard onImportComplete={() => void loadLedger({ showLoading: false })} />
          </div>
        ) : null}
      </section>

      {lease?.leaseExecution ? (
        <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 10, padding: 12, background: "#fff6e8", boxShadow: "0 10px 24px rgba(59,44,28,0.08)", display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#63594d", textTransform: "uppercase", letterSpacing: "0.04em" }}>Lease execution</div>
          <div style={{ color: "#211c17", fontWeight: 800 }}>{lease.leaseExecution.executionLabel}</div>
          <div style={{ color: "#3f382f" }}>{lease.leaseExecution.executionDescription}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: "#63594d" }}>Tenant signature</div>
              <strong>{lease.leaseExecution.tenantSignatureStatus.replace(/_/g, " ")}</strong>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#63594d" }}>Landlord signature</div>
              <strong>{lease.leaseExecution.landlordSignatureStatus.replace(/_/g, " ")}</strong>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#63594d" }}>Next action</div>
              <strong>{executionNextActionLabel(lease.leaseExecution.requiredNextAction)}</strong>
            </div>
          </div>
        </div>
      ) : null}

      <section style={{ display: "grid", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Decisions</h2>
          <div style={{ color: "#63594d", fontSize: 13, marginTop: 3 }}>
            Read-only decisions derived from detected lease and payment signals.
          </div>
          <div style={{ color: "#3f382f", fontSize: 13, marginTop: 4 }}>
            These actions manage operational review workflow only. They do not change lease balances, payment records, or ledger history.
          </div>
        </div>
        {decisions.length === 0 ? (
          <div style={{ border: "1px solid #bbf7d0", borderRadius: 12, padding: 12, color: "#166534", background: "#f0fdf4" }}>
            No issues detected. Everything is up to date.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              <div style={{ border: "1px solid #fecaca", borderRadius: 10, padding: 10, background: "#fef2f2" }}>
                <div style={{ fontSize: 12, color: "#991b1b" }}>Active critical decisions</div>
                <strong>{decisionSummary.critical}</strong>
              </div>
              <div style={{ border: "1px solid #fed7aa", borderRadius: 10, padding: 10, background: "#fff7ed" }}>
                <div style={{ fontSize: 12, color: "#9a3412" }}>Active warning decisions</div>
                <strong>{decisionSummary.warning}</strong>
              </div>
              <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 10, padding: 10, background: "#fff6e8" }}>
                <div style={{ fontSize: 12, color: "#63594d" }}>Active decision count</div>
                <strong>{decisionSummary.total}</strong>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {decisions.map((decision) => (
                <DecisionRow
                  key={decision.decisionId}
                  decision={decision}
                  lease={lease}
                  obligationRows={obligationRows}
                  delinquencySignals={delinquencySignals}
                  allocationReviewRequired={hasUnallocatedCreditNotice}
                  pending={decisionActionPendingId === decision.decisionId}
                  onAction={handleDecisionAction}
                  onRecordPayment={() => setShowPaymentModal(true)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Financial delinquency summary</h2>
          <div style={{ color: "#63594d", fontSize: 13, marginTop: 3 }}>
            Read-only detection based on obligation ledger signals.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
          <div style={{ border: "1px solid #fecaca", borderRadius: 10, padding: 10, background: "#fef2f2" }}>
            <div style={{ fontSize: 12, color: "#991b1b" }}>Overdue</div>
            <strong>{delinquencySummary?.overdueCount || 0}</strong>
          </div>
          <div style={{ border: "1px solid #fde68a", borderRadius: 10, padding: 10, background: "#fffbeb" }}>
            <div style={{ fontSize: 12, color: "#92400e" }}>Outstanding</div>
            <strong>{formatCurrencyCents(delinquencySummary?.totalOutstandingCents || 0)}</strong>
          </div>
          <div style={{ border: "1px solid #fed7aa", borderRadius: 10, padding: 10, background: "#fff7ed" }}>
            <div style={{ fontSize: 12, color: "#9a3412" }}>Underpaid</div>
            <strong>{delinquencySummary?.partiallyPaidCount || 0}</strong>
          </div>
          <div style={{ border: "1px solid rgba(91,70,48,0.18)", borderRadius: 10, padding: 10, background: "#fff6e8" }}>
            <div style={{ fontSize: 12, color: "#63594d" }}>Manual Review</div>
            <strong>{delinquencySummary?.manualReviewCount || 0}</strong>
          </div>
        </div>
        {delinquencySignals.length === 0 ? (
          <div style={{ border: "1px solid #bbf7d0", borderRadius: 12, padding: 12, color: "#166534", background: "#f0fdf4" }}>
            All rent obligations are up to date.
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Payment obligations</h2>
          <div style={{ color: "#63594d", fontSize: 13, marginTop: 3 }}>
            Read-only view of expected rent, execution records, and reconciliation evidence.
          </div>
          <div style={{ color: "#3f382f", fontSize: 13, marginTop: 4 }}>
            Obligation status is financial truth from payments and reconciliation. Decision workflow actions do not change these values.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
          <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 10, padding: 10, background: "#fff6e8" }}>
            <div style={{ fontSize: 12, color: "#63594d" }}>Expected</div>
            <strong>{formatCurrencyCents(obligationSummary?.expectedAmountCents || 0)}</strong>
          </div>
          <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 10, padding: 10, background: "#fff6e8" }}>
            <div style={{ fontSize: 12, color: "#63594d" }}>Paid</div>
            <strong>{formatCurrencyCents(obligationSummary?.paidAmountCents || 0)}</strong>
          </div>
          <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 10, padding: 10, background: "#fff6e8" }}>
            <div style={{ fontSize: 12, color: "#63594d" }}>Outstanding</div>
            <strong>{formatCurrencyCents(obligationSummary?.outstandingAmountCents || 0)}</strong>
          </div>
          <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 10, padding: 10, background: "#fff6e8" }}>
            <div style={{ fontSize: 12, color: "#63594d" }}>Manual Review</div>
            <strong>{obligationSummary?.manualReviewCount || 0}</strong>
          </div>
        </div>
        {obligationRows.length === 0 ? (
          <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 12, padding: 12, color: "#63594d", background: "#fff6e8" }}>
            Obligation ledger is not available yet for this lease.
          </div>
        ) : (
          <>
          <div className="lease-ledger-obligations-table" style={{ overflowX: "auto", border: "1px solid rgba(91,70,48,0.16)", borderRadius: 12, background: "#fffaf1" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
              <thead>
                <tr style={{ background: "#f4eadc" }}>
                  {["Period", "Due date", "Expected", "Paid", "Outstanding", "Financial status", "Financial signal", "Evidence"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid rgba(91,70,48,0.16)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {obligationRows.map((row) => {
                  const allocationAdjustment = allocationAdjustmentForObligation(row, creditAllocationPreview);
                  return (
                    <tr key={row.rowId}>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>{formatPeriod(row)}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>{formatDate(row.dueDate)}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>{formatCurrencyCents(row.expectedAmountCents)}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>{formatCurrencyCents(row.paidAmountCents)}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>
                        {allocationAdjustment ? (
                          <div className="lease-ledger-obligation-allocation-cell">
                            <strong>{formatCurrencyCents(allocationAdjustment.outstandingAfterAllocationCents)} after allocation</strong>
                            <span>Allocated from credit: {formatCurrencyCents(allocationAdjustment.allocatedCents)}</span>
                            <span>Original outstanding: {formatCurrencyCents(obligationOutstandingCents(row))}</span>
                          </div>
                        ) : (
                          formatCurrencyCents(obligationOutstandingCents(row))
                        )}
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>
                        <ObligationStatusBadge status={row.obligationStatus || "unknown"} />
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)", minWidth: 220 }}>
                        <DelinquencyIndicators
                          row={row}
                          signals={delinquencySignals}
                          allocationReviewRequired={hasUnallocatedCreditNotice}
                          allocationAdjustment={allocationAdjustment}
                        />
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)", color: "#3f382f" }}>{prettyEvidenceStatus(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="lease-ledger-obligation-cards" aria-label="Payment obligation cards">
            {obligationRows.map((row) => (
              <ObligationMobileCard
                key={row.rowId}
                row={row}
                signals={delinquencySignals}
                allocationReviewRequired={hasUnallocatedCreditNotice}
                allocationAdjustment={allocationAdjustmentForObligation(row, creditAllocationPreview)}
              />
            ))}
          </div>
          </>
        )}
      </section>

      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {loading ? (
        <div>Loading ledger…</div>
      ) : entries.length === 0 ? (
        <div style={{ border: "1px solid rgba(91,70,48,0.16)", borderRadius: 12, padding: 12, color: "#63594d", background: "#fff6e8" }}>
          No ledger entries for this range.
        </div>
      ) : (
        <>
          <div className="lease-ledger-entries-table" style={{ overflowX: "auto", border: "1px solid rgba(91,70,48,0.16)", borderRadius: 12, background: "#fffaf1" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr style={{ background: "#f4eadc" }}>
                  {["Date", "Type", "Category", "Amount", "Method/Ref", "Notes", "Balance"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid rgba(91,70,48,0.16)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>{entry.effectiveDate}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)", textTransform: "capitalize" }}>{entry.entryType}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)", textTransform: "capitalize" }}>{entry.category}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)", color: entry.entryType === "payment" ? "#047857" : "#211c17" }}>
                      {formatSignedCurrencyCents(entry.amountCents, entry.entryType)}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>
                      {[entry.method, entry.reference].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>{entry.notes || "—"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(91,70,48,0.12)" }}>{formatCurrencyCents(entry.balanceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lease-ledger-entry-cards" aria-label="Ledger entry cards">
            {entries.map((entry) => (
              <LedgerEntryMobileCard key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      )}

      {monthlyRows.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Monthly totals</h2>
          {monthlyRows.map(([month, row]) => (
            <div
              key={month}
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                border: "1px solid rgba(91,70,48,0.16)",
                borderRadius: 10,
                padding: 10,
                background: "#fff6e8",
              }}
            >
              <strong style={{ minWidth: 90 }}>{month}</strong>
              <span>Charges: {formatCurrencyCents(row.chargesCents)}</span>
              <span>Payments: {formatCurrencyCents(row.paymentsCents)}</span>
              <span>Net: {formatCurrencyCents(row.netCents)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Lease notes</h2>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
          {notes.length === 0 ? <div style={{ color: "#64748b" }}>No lease notes yet.</div> : null}
          {notes.map((note) => (
            <div key={note.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#0f172a" }}>{note.note}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                {typeof note.createdAt === "number" ? new Date(note.createdAt).toLocaleString() : String(note.createdAt || "—")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNoteModal ? (
        <div style={modalBackdrop} onClick={() => !saving && setShowNoteModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add lease note</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <label>
                Note
                <textarea rows={5} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setShowNoteModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="button" onClick={() => void submitNote()} disabled={saving}>
                  {saving ? "Saving…" : "Save note"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showChargeModal ? (
        <div style={modalBackdrop} onClick={() => !saving && setShowChargeModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add charge</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <label>
                Date
                <input type="date" value={chargeDate} onChange={(e) => setChargeDate(e.target.value)} />
              </label>
              <label>
                Type
                <select value={chargeType} onChange={(e) => setChargeType(e.target.value as ChargeType)}>
                  <option value="rent">Rent</option>
                  <option value="fee">Fee</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </label>
              <label>
                Amount (CAD)
                <input type="number" min="0" step="0.01" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
              </label>
              <label>
                Notes (optional)
                <textarea value={chargeNotes} onChange={(e) => setChargeNotes(e.target.value)} rows={3} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button disabled={saving} onClick={() => setShowChargeModal(false)}>Cancel</button>
              <button disabled={saving} onClick={submitCharge}>{saving ? "Saving…" : "Save charge"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showPaymentModal ? (
        <div style={modalBackdrop} onClick={() => !saving && setShowPaymentModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Record payment</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <label>
                Date
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </label>
              <label>
                Method
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">Cash</option>
                  <option value="etransfer">eTransfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank">Bank</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Amount (CAD)
                <input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              </label>
              <label>
                Reference (optional)
                <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
              </label>
              <label>
                Notes (optional)
                <textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={3} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button disabled={saving} onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button disabled={saving} onClick={submitPayment}>{saving ? "Saving…" : "Record payment"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
