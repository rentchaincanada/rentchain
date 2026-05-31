import { createHash } from "crypto";
import type { TenantLedgerEntry } from "../tenantLedgerService";
import type { RentPaymentSummary } from "../rentPayments/rentPaymentService";
import type { TenantBalanceSummary } from "../tenantBalanceService";
import {
  deriveTenantSafeProjectionMetadata,
  type TenantSafeProjectionName,
  type TenantSafeProjectionScopeType,
} from "./tenantSafeProjectionContract";

export type TenantFinancialProjectionKind = "ledger" | "payment" | "balance";

type TenantFinancialMetadataInput = {
  projectionName: TenantSafeProjectionName;
  scopeType: TenantSafeProjectionScopeType;
  sourceCollections: string[];
  relationshipBasis: string;
};

function publicReference(kind: string, raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const digest = createHash("sha256").update(`${kind}:${value}`).digest("hex").slice(0, 12);
  return `${kind}-ref-${digest}`;
}

function safeString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
  if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
  return null;
}

function normalizeAmountToCents(value: unknown): number | null {
  const amount = safeNumber(value);
  if (amount == null) return null;
  return Math.round(amount * 100);
}

export function buildTenantFinancialProjectionMetadata(input: TenantFinancialMetadataInput) {
  const sourceCollections = Array.from(new Set(input.sourceCollections.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  return {
    ...deriveTenantSafeProjectionMetadata({
      projectionName: input.projectionName,
      scopeType: input.scopeType,
      sourceCollections,
      relationshipBasis: input.relationshipBasis,
      internalReferencePolicy:
        "Tenant financial responses use derived display references and never expose raw ledger, transaction, provider, landlord, or unit identifiers.",
    }),
    sourceCollections,
    sourceRefs: [],
  };
}

export function projectTenantLedgerItem(entry: TenantLedgerEntry | Record<string, any>) {
  const type = String(entry?.type || "").toLowerCase();
  const mappedType: "rent" | "fee" | "adjustment" | "payment" = type.includes("payment")
    ? "payment"
    : type.includes("fee")
    ? "fee"
    : type.includes("adjust")
    ? "adjustment"
    : "rent";
  const occurredAt = toMillis((entry as any).date ?? (entry as any).occurredAt) ?? Date.now();
  const amount = safeNumber((entry as any).amount);
  return {
    id:
      publicReference("ledger", (entry as any).id ?? (entry as any).referenceId ?? `${type}:${occurredAt}:${amount}`) ||
      "ledger-ref-unavailable",
    type: mappedType,
    title:
      mappedType === "payment"
        ? "Payment recorded"
        : mappedType === "fee"
        ? "Fee recorded"
        : mappedType === "adjustment"
        ? "Adjustment recorded"
        : "Rent recorded",
    description: safeString((entry as any).notes ?? (entry as any).label ?? (entry as any).description) || undefined,
    amountCents: normalizeAmountToCents(Math.abs(amount ?? 0)),
    currency: safeString((entry as any).currency),
    period: safeString((entry as any).period),
    purpose: safeString((entry as any).purpose ?? (entry as any)?.meta?.purpose),
    purposeLabel: safeString((entry as any).purposeLabel ?? (entry as any)?.meta?.purposeLabel),
    occurredAt,
  };
}

export function projectTenantFinancialEvent(event: Record<string, any>) {
  return projectTenantLedgerItem({
    id: event.id,
    type: event.type,
    amount: event.amount ?? event.amountCents,
    currency: event.currency,
    period: event.period,
    purpose: event.purpose,
    purposeLabel: event.purposeLabel,
    date: event.occurredAt ?? event.createdAt,
    label: event.title,
    notes: event.description,
  });
}

function projectPaymentItem(item: NonNullable<RentPaymentSummary["latestPayment"]> | null) {
  if (!item) return null;
  return {
    id: publicReference("payment", item.id) || "payment-ref-unavailable",
    amountCents: item.amountCents,
    currency: item.currency,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    paidAt: item.paidAt || null,
  };
}

export function projectTenantRentPaymentSummary(summary: RentPaymentSummary): RentPaymentSummary {
  const history = summary.paymentExperience.history.map((item) => projectPaymentItem(item)).filter(Boolean) as NonNullable<
    RentPaymentSummary["latestPayment"]
  >[];
  return {
    paymentRail: {
      enabled: summary.paymentRail.enabled,
      enabledAt: summary.paymentRail.enabledAt,
      processor: summary.paymentRail.processor,
      blockedReason: summary.paymentRail.blockedReason,
    },
    latestPayment: projectPaymentItem(summary.latestPayment),
    paymentExperience: {
      history,
      latestStatus: summary.paymentExperience.latestStatus,
      retryAvailable: summary.paymentExperience.retryAvailable,
      receiptSummary: {
        available: summary.paymentExperience.receiptSummary.available,
        label: summary.paymentExperience.receiptSummary.label,
        amountCents: summary.paymentExperience.receiptSummary.amountCents,
        paidAt: summary.paymentExperience.receiptSummary.paidAt,
        leaseReference: publicReference("lease", summary.paymentExperience.receiptSummary.leaseReference),
      },
    },
  };
}

export function projectTenantBalanceSummary(summary: TenantBalanceSummary) {
  return {
    tenantReference: publicReference("tenant", summary.tenantId),
    totalCharges: summary.totalCharges,
    totalPayments: summary.totalPayments,
    totalAdjustments: summary.totalAdjustments,
    totalNsfFees: summary.totalNsfFees,
    currentBalance: summary.currentBalance,
    lastPaymentDate: summary.lastPaymentDate,
    lastPaymentAmount: summary.lastPaymentAmount,
    nextChargeDate: summary.nextChargeDate,
    nextChargeAmount: summary.nextChargeAmount,
  };
}
