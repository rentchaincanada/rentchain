import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addLeaseCharge,
  addLeasePayment,
  fetchLeaseLedger,
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
import { triggerDocumentDownload } from "../lib/documentRendering";
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
} from "@/lib/decisions/decisionDisplay";
import { DecisionContextPanel } from "@/components/decisions/DecisionContextPanel";
import { PaymentCsvImportPreviewCard } from "@/components/ledger/PaymentCsvImportPreviewCard";

type ChargeType = "rent" | "fee" | "adjustment";
type PaymentMethod = "cash" | "etransfer" | "cheque" | "bank" | "card" | "other";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
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

function formatPeriod(row: LeaseObligationLedgerRow): string {
  const start = formatDate(row.periodStart);
  const end = formatDate(row.periodEnd);
  if (start === "—" && end === "—") return "—";
  if (start !== "—" && end !== "—") return `${start} - ${end}`;
  return start !== "—" ? start : end;
}

function obligationOutstandingCents(row: LeaseObligationLedgerRow): number {
  return Math.max(0, Number(row.expectedAmountCents || 0) - Number(row.paidAmountCents || 0));
}

const obligationStatusCopy: Record<PaymentObligationStatus, { label: string; bg: string; color: string; border: string }> = {
  expected: { label: "Expected", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  pending: { label: "Pending", bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
  paid: { label: "Paid", bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  underpaid: { label: "Underpaid", bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" },
  overpaid: { label: "Overpaid", bg: "#e0f2fe", color: "#075985", border: "#bae6fd" },
  failed: { label: "Failed", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  missing: { label: "Missing", bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  manual_review_required: { label: "Manual review", bg: "#fae8ff", color: "#86198f", border: "#f5d0fe" },
  unknown: { label: "Unknown", bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
};

const delinquencySignalCopy: Record<DelinquencySignalType, { label: string; reason: string; bg: string; color: string; border: string }> = {
  rent_due: { label: "Rent due", reason: "Rent is due by the due date", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  overdue: { label: "Overdue", reason: "Rent past due date", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  partially_paid: { label: "Underpaid", reason: "Partial payment received", bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" },
  failed_payment: { label: "Failed", reason: "Payment did not complete", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  missing_payment: { label: "Missing", reason: "No rent payment found after due date", bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  manual_review_required: { label: "Manual review required", reason: "Payment mismatch or incomplete evidence", bg: "#fae8ff", color: "#86198f", border: "#f5d0fe" },
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

function decisionWithStatus(decision: DecisionItem, actionType: DecisionActionType): DecisionItem {
  const nextStatus =
    actionType === "reviewed"
      ? "reviewed"
      : actionType === "snoozed"
      ? "snoozed"
      : actionType === "assigned"
      ? "assigned"
      : actionType === "dismissed"
      ? "dismissed"
      : "resolved";
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
}: {
  decision: DecisionItem;
  pending: boolean;
  onAction: (decision: DecisionItem, actionType: DecisionActionType) => void;
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
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {actions.map((action) => (
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
  pending,
  onAction,
}: {
  decision: DecisionItem;
  lease: LandlordActiveLease | null;
  obligationRows: LeaseObligationLedgerRow[];
  delinquencySignals: LeaseDelinquencySignal[];
  pending: boolean;
  onAction: (decision: DecisionItem, actionType: DecisionActionType) => void;
}) {
  const copy = decisionDisplayCopy[decision.decisionType];
  const displayDecision = withDecisionReviewContext(decision, lease);
  const reviewContext = displayDecision.metadata?.reviewContext as Record<string, string | undefined> | undefined;
  const propertyUnitLabel =
    reviewContext?.propertyLabel && reviewContext?.unitLabel
      ? `${reviewContext.propertyLabel} · ${reviewContext.unitLabel}`
      : reviewContext?.propertyLabel || reviewContext?.unitLabel || null;
  const context = [
    propertyUnitLabel,
    reviewContext?.tenantName || (decision.tenantId ? "Tenant context available" : null),
  ].filter(Boolean);
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong>{copy.label}</strong>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Financial signal</span>
        <DecisionBadge severity={decision.severity} label={copy.badge} />
        <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Workflow status</span>
        <span style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 800 }}>
          {decisionStatusCopy[decision.status || "detected"]}
        </span>
      </div>
      <div style={{ color: "#475569" }}>{decision.reason}</div>
      <div style={{ color: "#64748b", fontSize: 12 }}>
        Workflow actions update review handling only. Financial status is derived from payments, obligations, and reconciliation evidence.
      </div>
      {context.length ? <div style={{ color: "#64748b", fontSize: 12 }}>{context.join(" · ")}</div> : null}
      {decision.latestAction ? (
        <div style={{ color: "#64748b", fontSize: 12 }}>Last action: {decisionStatusCopy[decision.latestAction.nextStatus]}</div>
      ) : null}
      <DecisionContextPanel decision={displayDecision} obligationRows={obligationRows} delinquencySignals={delinquencySignals} />
      <DecisionActionControls decision={decision} pending={pending} onAction={onAction} />
    </div>
  );
}

function reasonTextFromSignal(signal: LeaseDelinquencySignal): string {
  const copy = delinquencySignalCopy[signal.signalType];
  const reason = (signal.reasons || [])[0]?.replace(/_/g, " ");
  return `${copy.label} — ${copy.reason}${reason ? ` (${reason})` : ""}`;
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
}: {
  row: LeaseObligationLedgerRow;
  signals: LeaseDelinquencySignal[];
}) {
  const matchingSignals = signals.filter((signal) => signalMatchesRow(signal, row));
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

export default function LeaseLedgerPage() {
  const { leaseId = "" } = useParams();
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

  const handleDecisionAction = async (decision: DecisionItem, actionType: DecisionActionType) => {
    if (!leaseId) return;
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

  function prettyStatus(value: string | null | undefined) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "Unknown";
    if (normalized === "notice_pending") return "Renew letter needed";
    if (normalized === "renewal_pending") return "Renewal pending";
    if (normalized === "renewal_accepted") return "Renewing";
    if (normalized === "move_out_pending") return "Quitting";
    return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem" }}>Lease Ledger</h1>
          <div style={{ color: "#475569", marginTop: 4 }}>
            {lease
              ? `${formatOperationalLabel({ kind: "property", label: lease.propertyName || lease.propertyAddress, fallbackLabel: "Property", internalId: lease.propertyId })} · ${formatOperationalLabel({ kind: "unit", label: lease.unitNumber ? `Unit ${lease.unitNumber}` : lease.unitLabel, fallbackLabel: "Unit", internalId: lease.unitId })}`
              : "Lease ledger"}
          </div>
          <div style={{ color: "#64748b", marginTop: 2, fontSize: 12 }}>{formatInternalReference("lease", leaseId)}</div>
          {lease ? (
            <div style={{ color: "#334155", marginTop: 6, display: "grid", gap: 2 }}>
              <div>
                {lease.tenantName || "Tenant not linked"} · {prettyStatus(lease.status)}
                {lease.archivedAt ? ` · Archived ${formatDate(lease.archivedAt)}` : ""}
              </div>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/leases?view=archived">View archive</Link>
          <button aria-label="Add lease note" onClick={() => setShowNoteModal(true)}>Add note</button>
          <button onClick={() => setShowChargeModal(true)}>Add charge</button>
          <button onClick={() => setShowPaymentModal(true)}>Record payment</button>
          <button onClick={() => void exportLedger("csv")}>Export CSV</button>
          <button onClick={() => void exportLedger("pdf")}>Export PDF</button>
          <button onClick={() => void toggleArchive()} disabled={saving || !lease}>
            {lease?.archivedAt ? "Restore lease" : "Archive lease"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#334155" }}>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#334155" }}>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={loadLedger}>Apply</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Charges</div>
          <strong>{formatCurrencyCents(totals.chargesCents)}</strong>
        </div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Payments</div>
          <strong>{formatCurrencyCents(totals.paymentsCents)}</strong>
        </div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Balance</div>
          <strong>{formatCurrencyCents(totals.balanceCents)}</strong>
        </div>
      </div>

      <PaymentCsvImportPreviewCard />

      {lease?.leaseExecution ? (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff", display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Lease execution</div>
          <div style={{ fontWeight: 800 }}>{lease.leaseExecution.executionLabel}</div>
          <div style={{ color: "#475569" }}>{lease.leaseExecution.executionDescription}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Tenant signature</div>
              <strong>{lease.leaseExecution.tenantSignatureStatus.replace(/_/g, " ")}</strong>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Landlord signature</div>
              <strong>{lease.leaseExecution.landlordSignatureStatus.replace(/_/g, " ")}</strong>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Next action</div>
              <strong>{executionNextActionLabel(lease.leaseExecution.requiredNextAction)}</strong>
            </div>
          </div>
        </div>
      ) : null}

      <section style={{ display: "grid", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Decisions</h2>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
            Read-only decisions derived from detected lease and payment signals.
          </div>
          <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
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
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>Active decision count</div>
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
                  pending={decisionActionPendingId === decision.decisionId}
                  onAction={handleDecisionAction}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Financial delinquency summary</h2>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
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
          <div style={{ border: "1px solid #f5d0fe", borderRadius: 10, padding: 10, background: "#fdf4ff" }}>
            <div style={{ fontSize: 12, color: "#86198f" }}>Manual Review</div>
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
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
            Read-only view of expected rent, execution records, and reconciliation evidence.
          </div>
          <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
            Obligation status is financial truth from payments and reconciliation. Decision workflow actions do not change these values.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Expected</div>
            <strong>{formatCurrencyCents(obligationSummary?.expectedAmountCents || 0)}</strong>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Paid</div>
            <strong>{formatCurrencyCents(obligationSummary?.paidAmountCents || 0)}</strong>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Outstanding</div>
            <strong>{formatCurrencyCents(obligationSummary?.outstandingAmountCents || 0)}</strong>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Manual Review</div>
            <strong>{obligationSummary?.manualReviewCount || 0}</strong>
          </div>
        </div>
        {obligationRows.length === 0 ? (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, color: "#64748b", background: "#fff" }}>
            Obligation ledger is not available yet for this lease.
          </div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Period", "Due date", "Expected", "Paid", "Outstanding", "Financial status", "Financial signal", "Evidence"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {obligationRows.map((row) => (
                  <tr key={row.rowId}>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{formatPeriod(row)}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{formatDate(row.dueDate)}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{formatCurrencyCents(row.expectedAmountCents)}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{formatCurrencyCents(row.paidAmountCents)}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{formatCurrencyCents(obligationOutstandingCents(row))}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                      <ObligationStatusBadge status={row.obligationStatus || "unknown"} />
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", minWidth: 220 }}>
                      <DelinquencyIndicators row={row} signals={delinquencySignals} />
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", color: "#475569" }}>{prettyEvidenceStatus(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {loading ? (
        <div>Loading ledger…</div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Date", "Type", "Category", "Amount", "Method/Ref", "Notes", "Balance"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, color: "#64748b" }}>
                    No ledger entries for this range.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{entry.effectiveDate}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textTransform: "capitalize" }}>{entry.entryType}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textTransform: "capitalize" }}>{entry.category}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", color: entry.entryType === "payment" ? "#047857" : "#0f172a" }}>
                      {formatSignedCurrencyCents(entry.amountCents, entry.entryType)}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                      {[entry.method, entry.reference].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{entry.notes || "—"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{formatCurrencyCents(entry.balanceCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 10,
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
