import type { ReceivableAgingAllocationPolicy } from "./agingProjection";
import type { RentRollLeaseStatus } from "./rentRollProjection";

export const LANDLORD_LEASE_RECEIVABLES_SCHEMA_VERSION = "landlord_lease_receivables_v1" as const;

export type AccountingSourceState = "complete" | "incomplete" | "ambiguous";
export type TenantMappingState = "resolved" | "missing" | "ambiguous";
export type LeaseReceivablesCompletenessStatus = "complete" | "partial" | "unavailable";

export type LandlordLeaseReceivablesAssemblerInput = {
  leaseId: unknown;
  propertyId: unknown;
  unitId?: unknown;
  responsibilityId?: unknown;
  tenantId?: unknown;
  propertyDisplayName?: unknown;
  unitDisplayName?: unknown;
  tenantDisplayName?: unknown;
  responsibilityDisplayName?: unknown;
  tenantMappingState: unknown;
  leaseStatus: unknown;
  leaseStartDate?: unknown;
  leaseEndDate?: unknown;
  monthlyRentCents?: unknown;
  dueDay?: unknown;
  billingFrequency?: unknown;
  currency?: unknown;
  depositAmountCents?: unknown;
  sourceLeaseVersion?: unknown;
  asOfDate: unknown;
  previewThroughDate?: unknown;
  expectedPreviewFingerprint?: unknown;
  transactions: readonly unknown[];
  transactionSourceState: unknown;
  legacyBalanceCents?: unknown;
  agingAllocationPolicy?: ReceivableAgingAllocationPolicy;
};

export type LandlordSafeWarning = {
  code: string;
  severity: "review" | "info";
  message: string;
};

export type LandlordLeaseReceivablesDto = {
  schemaVersion: typeof LANDLORD_LEASE_RECEIVABLES_SCHEMA_VERSION;
  asOfDate: string | null;
  currency: "cad";
  leaseSummary: {
    propertyDisplayName: string | null;
    unitDisplayName: string | null;
    tenantDisplayName: string | null;
    responsibilityDisplayName: string | null;
    leaseStatus: RentRollLeaseStatus;
    leaseStatusLabel: string;
  };
  billingSummary: {
    monthlyRentCents: number | null;
    scheduledRentDisplay: string | null;
    billingFrequency: "monthly" | null;
    dueDay: number | null;
    leaseStartDate: string | null;
    leaseEndDate: string | null;
  };
  balanceSummary: {
    chargesCents: number;
    creditsCents: number;
    appliedPaymentsCents: number;
    reversalsCents: number;
    writeOffsCents: number;
    adjustmentIncreasesCents: number;
    adjustmentDecreasesCents: number;
    netBalanceCents: number;
    outstandingCents: number;
    overpaymentCents: number;
    balanceDisplay: string;
  } | null;
  agingSummary: {
    allocationPolicy: ReceivableAgingAllocationPolicy;
    currentCents: number;
    days1To30Cents: number;
    days31To60Cents: number;
    days61To90Cents: number;
    days90PlusCents: number;
    totalOutstandingCents: number;
  } | null;
  rentRollSummary: {
    scheduledRentCents: number;
    currentBalanceCents: number;
    outstandingCents: number;
    overpaymentCents: number;
    nextDueDate: string | null;
  } | null;
  schedulePreviewSummary: {
    status: "available" | "unavailable";
    scheduledRentCents: number | null;
    depositChargeCents: number | null;
    occurrenceCount: number | null;
    nextDueDate: string | null;
    previewFingerprint: string | null;
    stale: boolean;
  };
  sourceEquivalence: {
    status: "equivalent" | "mismatch" | "not_provided" | "unavailable";
  };
  dataCompleteness: {
    status: LeaseReceivablesCompletenessStatus;
    missing: string[];
  };
  warnings: LandlordSafeWarning[];
  sourceFingerprint: string;
};
