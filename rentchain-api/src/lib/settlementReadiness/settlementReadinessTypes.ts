import type { AuditComplianceReadiness } from "../auditCompliance/auditComplianceTypes";
import type { DecisionInboxItem } from "../decisions/decisionInboxTypes";
import type { PaymentObligationLedgerRow } from "../payments/paymentObligationLedger";
import type { PaymentReconciliationRecord } from "../payments/paymentReconciliationRecords";

export type SettlementReadinessStatus = "ready_for_review" | "partially_ready" | "blocked" | "unknown";

export type SettlementReferenceType =
  | "payment_event"
  | "ledger_entry"
  | "reconciliation_item"
  | "export_reference"
  | "audit_reference"
  | "delinquency_reference"
  | "review_reference";

export type SettlementReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type SettlementCanonicalEventType =
  | "settlement_readiness_derived"
  | "settlement_reconciliation_verified"
  | "settlement_review_required"
  | "settlement_readiness_blocked"
  | "settlement_redaction_applied";

export type SettlementAmountSummary = {
  currency: "CAD";
  amount: string | null;
};

export type SettlementTraceability = {
  ledgerLinked: boolean;
  reviewLinked: boolean;
  evidenceLinked: boolean;
};

export type SettlementReference = {
  settlementReferenceId: string;
  referenceType: SettlementReferenceType;
  status: SettlementReferenceStatus;
  label: string;
  description: string;
  amountSummary: SettlementAmountSummary;
  traceability: SettlementTraceability;
  sourceId: string | null;
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type SettlementDependency = {
  dependencyId: string;
  label: string;
  status: "available" | "missing" | "blocked";
  blockedReason: string | null;
};

export type SettlementReadinessSummary = {
  totalReferences: number;
  verifiedReferences: number;
  partiallyVerifiedReferences: number;
  blockedReferences: number;
  unavailableReferences: number;
  totalLedgerAmount: string;
  totalReconciledAmount: string;
};

export type SettlementCanonicalEvent = {
  eventType: SettlementCanonicalEventType;
  action: string;
  status: SettlementReadinessStatus;
  resourceType: "settlement_readiness";
  resourceId: string;
  summary: string;
};

export type SettlementReadiness = {
  settlementReadinessId: string;
  status: SettlementReadinessStatus;
  manualReviewRequired: true;
  paymentExecutionEnabled: false;
  bankingIntegrationEnabled: false;
  tokenizationEnabled: false;
  generatedAt: string;
  summary: SettlementReadinessSummary;
  settlementReferences: SettlementReference[];
  reconciliationReferences: SettlementReference[];
  ledgerReferences: SettlementReference[];
  workflowDependencies: SettlementDependency[];
  evidenceReferences: SettlementReference[];
  reviewReferences: SettlementReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: SettlementCanonicalEvent[];
};

export type DeriveSettlementReadinessInput = {
  landlordId?: unknown;
  propertyId?: unknown;
  leaseId?: unknown;
  generatedAt?: unknown;
  obligationRows?: PaymentObligationLedgerRow[] | null;
  reconciliationRecords?: PaymentReconciliationRecord[] | null;
  paymentEvents?: Record<string, unknown>[] | null;
  evidencePacks?: Record<string, unknown>[] | null;
  operatorReviewSessions?: Record<string, unknown>[] | null;
  auditEvents?: Record<string, unknown>[] | null;
  decisions?: DecisionInboxItem[] | null;
  auditComplianceReadiness?: AuditComplianceReadiness | null;
};
