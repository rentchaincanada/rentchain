import type { LeaseDelinquencySignal, LeaseObligationLedgerRow } from "@/api/leaseLedgerApi";
import { formatInternalReference } from "@/lib/identityReferences";
import type { DecisionItem } from "./decisionDisplay";

export type DecisionContextLink = {
  key: "lease" | "ledger" | "property" | "tenant" | "admin_review";
  label: string;
  href: string;
  helperText?: string;
};

export type DecisionEvidenceItem = {
  label: string;
  value: string;
};

export type DecisionRelatedData = {
  obligationRows?: LeaseObligationLedgerRow[] | null;
  delinquencySignals?: LeaseDelinquencySignal[] | null;
  includeAdminReviewLink?: boolean;
};

function cleanString(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next || null;
}

function metadataString(decision: DecisionItem, key: string): string | null {
  return cleanString(decision.metadata?.[key]);
}

function metadataNumber(decision: DecisionItem, key: string): number | null {
  const value = Number(decision.metadata?.[key]);
  return Number.isFinite(value) ? value : null;
}

function formatCurrencyCents(value: unknown): string {
  const cents = Number(value || 0);
  const amount = Math.abs(cents) / 100;
  return `${cents < 0 ? "-" : ""}$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function titleCase(value: unknown): string {
  const text = cleanString(value);
  if (!text) return "Context unavailable";
  return text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function datesMatch(a: unknown, b: unknown): boolean {
  const left = cleanString(a);
  const right = cleanString(b);
  if (!left || !right) return false;
  const leftParsed = Date.parse(left);
  const rightParsed = Date.parse(right);
  if (!Number.isFinite(leftParsed) || !Number.isFinite(rightParsed)) return left === right;
  return new Date(leftParsed).toISOString().slice(0, 10) === new Date(rightParsed).toISOString().slice(0, 10);
}

export function findRelatedObligationRow(
  decision: DecisionItem,
  rows: LeaseObligationLedgerRow[] | null | undefined
): LeaseObligationLedgerRow | null {
  const obligationRows = rows || [];
  const obligationRowId = metadataString(decision, "obligationRowId");
  const expectedAmountCents = metadataNumber(decision, "expectedAmountCents");
  const dueDate = metadataString(decision, "dueDate");

  return (
    obligationRows.find((row) => {
      if (obligationRowId && row.rowId === obligationRowId) return true;
      if (decision.paymentIntentId && row.paymentIntentId === decision.paymentIntentId) return true;
      if (decision.rentPaymentId && row.rentPaymentId === decision.rentPaymentId) return true;
      return Boolean(
        decision.leaseId &&
          row.leaseId === decision.leaseId &&
          expectedAmountCents != null &&
          Number(row.expectedAmountCents || 0) === expectedAmountCents &&
          (!dueDate || datesMatch(dueDate, row.dueDate))
      );
    }) || null
  );
}

export function findRelatedDelinquencySignal(
  decision: DecisionItem,
  signals: LeaseDelinquencySignal[] | null | undefined
): LeaseDelinquencySignal | null {
  const delinquencySignals = signals || [];
  const signalId = metadataString(decision, "signalId");
  return (
    delinquencySignals.find((signal) => {
      if (signalId && signal.signalId === signalId) return true;
      if (decision.paymentIntentId && signal.paymentIntentId === decision.paymentIntentId) return true;
      if (decision.rentPaymentId && signal.rentPaymentId === decision.rentPaymentId) return true;
      return Boolean(decision.leaseId && signal.leaseId === decision.leaseId && signal.signalType === decision.metadata?.signalType);
    }) || null
  );
}

export function buildDecisionContextLinks(
  decision: DecisionItem,
  options?: { includeAdminReviewLink?: boolean }
): DecisionContextLink[] {
  const links: DecisionContextLink[] = [];
  if (decision.leaseId) {
    links.push({
      key: "lease",
      label: "Lease summary",
      href: `/leases/${encodeURIComponent(decision.leaseId)}/summary`,
      helperText: "Open lease record",
    });
    links.push({
      key: "ledger",
      label: "Lease ledger",
      href: `/leases/${encodeURIComponent(decision.leaseId)}/ledger`,
      helperText: "Review obligations and payments",
    });
  }
  if (decision.propertyId) {
    const search = new URLSearchParams({ propertyId: decision.propertyId });
    if (decision.unitId) search.set("unitId", decision.unitId);
    links.push({
      key: "property",
      label: decision.unitId ? "Property / unit" : "Property",
      href: `/properties?${search.toString()}`,
      helperText: decision.unitId ? "Open property and unit context" : "Open property context",
    });
  }
  if (decision.tenantId) {
    links.push({
      key: "tenant",
      label: "Tenant",
      href: `/tenants?tenantId=${encodeURIComponent(decision.tenantId)}`,
      helperText: "Open tenant context",
    });
  }
  if (options?.includeAdminReviewLink) {
    links.push({
      key: "admin_review",
      label: "Lifecycle review",
      href: "/admin/lease-lifecycle-review",
      helperText: "Open operator review queue",
    });
  }
  return links;
}

export function buildDecisionEvidenceItems(
  decision: DecisionItem,
  relatedData?: DecisionRelatedData
): DecisionEvidenceItem[] {
  const relatedRow = findRelatedObligationRow(decision, relatedData?.obligationRows);
  const relatedSignal = findRelatedDelinquencySignal(decision, relatedData?.delinquencySignals);
  const outstandingAmountCents =
    relatedSignal?.outstandingAmountCents ??
    metadataNumber(decision, "outstandingAmountCents") ??
    (relatedRow
      ? Math.max(0, Number(relatedRow.expectedAmountCents || 0) - Number(relatedRow.paidAmountCents || 0))
      : null);
  const signalType = relatedSignal?.signalType || metadataString(decision, "signalType");
  const signalReasons = relatedSignal?.reasons?.length
    ? relatedSignal.reasons.join(", ")
    : Array.isArray(decision.metadata?.signalReasons)
    ? (decision.metadata.signalReasons as unknown[]).map((reason) => String(reason)).join(", ")
    : null;
  const lifecycleState = metadataString(decision, "lifecycleState");
  const lifecycleReasons = Array.isArray(decision.metadata?.lifecycleReasons)
    ? (decision.metadata.lifecycleReasons as unknown[]).map((reason) => String(reason)).join(", ")
    : null;

  const items: DecisionEvidenceItem[] = [
    { label: "Decision reason", value: decision.reason || "Context unavailable" },
    { label: "Severity", value: titleCase(decision.severity) },
  ];

  if (signalType) items.push({ label: "Related delinquency signal", value: titleCase(signalType) });
  if (signalReasons) items.push({ label: "Signal reason", value: signalReasons });
  if (relatedRow?.obligationStatus || decision.metadata?.obligationStatus) {
    items.push({ label: "Obligation status", value: titleCase(relatedRow?.obligationStatus || decision.metadata?.obligationStatus) });
  }
  if (outstandingAmountCents != null) {
    items.push({ label: "Outstanding amount", value: formatCurrencyCents(outstandingAmountCents) });
  }
  if (lifecycleState) items.push({ label: "Lease lifecycle state", value: titleCase(lifecycleState) });
  if (lifecycleReasons) items.push({ label: "Lifecycle reason", value: lifecycleReasons });
  if (decision.paymentIntentId) {
    items.push({ label: "Provider payment reference", value: formatInternalReference("payment", decision.paymentIntentId) });
  }
  if (decision.rentPaymentId) {
    items.push({ label: "Internal rent payment reference", value: formatInternalReference("payment", decision.rentPaymentId) });
  }
  if (decision.latestAction) {
    items.push({
      label: "Last action",
      value: `${titleCase(decision.latestAction.nextStatus)}${decision.latestAction.actorEmail ? ` by ${decision.latestAction.actorEmail}` : ""}`,
    });
  }

  return items;
}
