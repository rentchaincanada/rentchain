import type {
  DeriveSettlementReadinessInput,
  SettlementCanonicalEvent,
  SettlementDependency,
  SettlementReadiness,
  SettlementReadinessStatus,
  SettlementReference,
  SettlementReferenceStatus,
} from "./settlementReadinessTypes";
import { settlementIdPart, settlementReference } from "./settlementReconciliationModels";

const REDACTIONS = [
  "Raw bank account and routing data are excluded.",
  "PCI-sensitive payment details are excluded.",
  "Raw payment processor payloads are excluded.",
  "Unrestricted financial exports are excluded.",
  "Settlement references are summaries only and cannot execute money movement.",
];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function generatedAt(value: unknown): string {
  const raw = asString(value, 120);
  const date = raw ? new Date(raw) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function amountCents(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.round(next) : 0;
}

function idMatches(record: Record<string, unknown>, ids: string[], keys: string[]) {
  const safeIds = ids.map((id) => asString(id, 500)).filter(Boolean);
  if (!safeIds.length) return false;
  return keys.some((key) => safeIds.includes(asString(record[key], 500)));
}

function referenceStatusForRow(row: Record<string, unknown>, reviewLinked: boolean, evidenceLinked: boolean): SettlementReferenceStatus {
  const obligationStatus = asString(row.obligationStatus, 120);
  const evidenceStatus = asString(row.evidenceStatus, 120);
  const reconciliationStatus = asString(row.reconciliationStatus, 120);
  if (["failed", "missing", "manual_review_required"].includes(obligationStatus)) return "blocked";
  if (["failed", "manual_review_required"].includes(evidenceStatus)) return "blocked";
  if (["mismatch", "duplicate_risk", "manual_review_required", "failed"].includes(reconciliationStatus)) return "blocked";
  if (obligationStatus === "paid" && (reconciliationStatus === "reconciled" || evidenceStatus === "reconciled") && reviewLinked && evidenceLinked) {
    return "verified";
  }
  return "partially_verified";
}

function referenceStatusForReconciliation(record: Record<string, unknown>): SettlementReferenceStatus {
  const status = asString(record.reconciliationStatus, 120);
  if (status === "reconciled") return "verified";
  if (["mismatch", "duplicate_risk", "manual_review_required", "failed"].includes(status) || record.requiresManualReview === true) {
    return "blocked";
  }
  return status ? "partially_verified" : "unavailable";
}

function canonicalEvent(input: {
  eventType: SettlementCanonicalEvent["eventType"];
  status: SettlementReadinessStatus;
  settlementReadinessId: string;
  summary: string;
}): SettlementCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^settlement_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "settlement_readiness",
    resourceId: input.settlementReadinessId,
    summary: input.summary,
  };
}

function dependencies(input: DeriveSettlementReadinessInput): SettlementDependency[] {
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const auditReadiness = input.auditComplianceReadiness || null;
  return [
    {
      dependencyId: "evidence_lineage",
      label: "Evidence lineage",
      status: evidencePacks.length ? "available" : "blocked",
      blockedReason: evidencePacks.length ? null : "Settlement readiness requires evidence lineage before institutional review.",
    },
    {
      dependencyId: "operator_review_lineage",
      label: "Operator review lineage",
      status: reviews.length ? "available" : "missing",
      blockedReason: reviews.length ? null : "Operator review lineage is missing or incomplete.",
    },
    {
      dependencyId: "audit_readiness",
      label: "Audit readiness",
      status: auditReadiness?.status === "blocked" ? "blocked" : auditReadiness ? "available" : "missing",
      blockedReason:
        auditReadiness?.status === "blocked"
          ? "Audit/compliance readiness is blocked for this settlement context."
          : auditReadiness
            ? null
            : "Audit/compliance readiness context is unavailable.",
    },
  ];
}

function deriveStatus(input: {
  hasSourceContext: boolean;
  references: SettlementReference[];
  dependencies: SettlementDependency[];
}): SettlementReadinessStatus {
  if (!input.hasSourceContext) return "unknown";
  if (input.references.some((reference) => reference.status === "blocked")) return "blocked";
  if (input.dependencies.some((dependency) => dependency.status === "blocked")) return "blocked";
  if (input.references.some((reference) => reference.status === "partially_verified" || reference.status === "unavailable")) {
    return "partially_ready";
  }
  if (input.dependencies.some((dependency) => dependency.status === "missing")) return "partially_ready";
  return "ready_for_review";
}

export function deriveSettlementReadiness(input: DeriveSettlementReadinessInput): SettlementReadiness {
  const landlordId = asString(input.landlordId, 240);
  const propertyId = asString(input.propertyId, 240);
  const leaseId = asString(input.leaseId, 240);
  const settlementReadinessId =
    settlementIdPart(["settlement_readiness", landlordId || "unknown", propertyId || "portfolio", leaseId || "all"].join(":")) ||
    "settlement_readiness:unknown";
  const rows = asArray(input.obligationRows);
  const reconciliationRecords = asArray(input.reconciliationRecords);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const auditEvents = asArray(input.auditEvents);
  const decisions = asArray(input.decisions);
  const dependencyItems = dependencies(input);

  const ledgerReferences = rows.map((row) => {
    const ids = [row.leaseId, row.propertyId || "", row.paymentIntentId || "", row.rentPaymentId || ""].filter(Boolean);
    const reviewLinked = reviews.some((review) => idMatches(review, ids, ["scopeId", "leaseId", "propertyId", "paymentIntentId", "rentPaymentId"]));
    const evidenceLinked = evidencePacks.some((pack) => idMatches(pack, ids, ["scopeId", "leaseId", "propertyId", "paymentIntentId", "rentPaymentId"]));
    const status = referenceStatusForRow(row as Record<string, unknown>, reviewLinked, evidenceLinked);
    return settlementReference({
      idParts: ["ledger", row.rowId],
      referenceType: "ledger_entry",
      status,
      label: "Ledger settlement trace",
      description: row.reasons?.length ? row.reasons.join(", ") : "Payment obligation ledger row is available for settlement traceability.",
      amountCents: row.paidAmountCents || row.expectedAmountCents,
      currency: row.currency,
      ledgerLinked: true,
      reviewLinked,
      evidenceLinked,
      sourceId: row.rowId,
      destination: row.leaseId ? `/leases/${encodeURIComponent(row.leaseId)}/ledger` : null,
      blockedReason: status === "blocked" ? "Ledger row requires manual reconciliation review before settlement readiness." : null,
    });
  });

  const reconciliationReferences = reconciliationRecords.map((record) => {
    const ids = [record.subjectId || "", record.paymentIntentId || "", record.reconciliationId].filter(Boolean);
    const linkedRow = rows.some((row) => idMatches(row as any, ids, ["paymentIntentId", "rentPaymentId", "rowId"]));
    const status = referenceStatusForReconciliation(record as Record<string, unknown>);
    return settlementReference({
      idParts: ["reconciliation", record.reconciliationId],
      referenceType: "reconciliation_item",
      status,
      label: "Reconciliation reference",
      description: record.reasons?.length ? record.reasons.join(", ") : "Payment reconciliation metadata is available.",
      amountCents: null,
      ledgerLinked: linkedRow,
      reviewLinked: record.requiresManualReview !== true,
      evidenceLinked: Boolean(record.receiptId),
      sourceId: record.reconciliationId,
      destination: null,
      blockedReason: status === "blocked" ? "Reconciliation record requires manual review before settlement readiness." : null,
    });
  });

  const evidenceReferences = evidencePacks.map((pack) =>
    settlementReference({
      idParts: ["evidence", pack.evidencePackId || pack.id || pack.scopeId || "unknown"],
      referenceType: "audit_reference",
      status: pack.status === "blocked" ? "blocked" : "verified",
      label: "Evidence lineage reference",
      description: "Evidence pack summary is available for settlement review.",
      ledgerLinked: true,
      reviewLinked: true,
      evidenceLinked: true,
      sourceId: pack.evidencePackId || pack.id || null,
      destination: "/evidence-packs",
      blockedReason: pack.status === "blocked" ? "Evidence pack is blocked." : null,
    })
  );

  const reviewReferences = reviews.map((review) =>
    settlementReference({
      idParts: ["review", review.reviewSessionId || review.id || "unknown"],
      referenceType: "review_reference",
      status: review.status === "completed" ? "verified" : "partially_verified",
      label: "Operator review settlement reference",
      description: "Operator review lineage is available for settlement readiness.",
      ledgerLinked: true,
      reviewLinked: true,
      evidenceLinked: false,
      sourceId: review.reviewSessionId || review.id || null,
      destination: "/review-timeline",
    })
  );

  const delinquencyReferences = decisions
    .filter((decision) => asString((decision.workflow as any)?.queue || decision.type, 120) === "delinquency_review")
    .map((decision) =>
      settlementReference({
        idParts: ["delinquency", decision.id],
        referenceType: "delinquency_reference",
        status: decision.status === "resolved" || decision.status === "dismissed" ? "verified" : "partially_verified",
        label: "Delinquency settlement dependency",
        description: decision.description || decision.title || "Delinquency review context is visible for settlement readiness.",
        ledgerLinked: Boolean(decision.destination),
        reviewLinked: true,
        evidenceLinked: false,
        sourceId: decision.id,
        destination: decision.destination,
      })
    );

  const auditReferences = auditEvents.slice(0, 12).map((event) =>
    settlementReference({
      idParts: ["audit", event.id || event.eventId || event.type || "unknown"],
      referenceType: "audit_reference",
      status: event.redacted ? "partially_verified" : "verified",
      label: asString(event.type || event.eventType || event.action, 160) || "Audit event reference",
      description: "Audit event summary is available for settlement traceability.",
      ledgerLinked: false,
      reviewLinked: true,
      evidenceLinked: false,
      sourceId: event.id || event.eventId || null,
      destination: "/review-timeline",
      redacted: Boolean(event.redacted),
      redactionReason: event.redacted ? "Audit event payload is redacted for settlement-readiness safety." : null,
    })
  );

  const settlementReferences = [...ledgerReferences, ...reconciliationReferences, ...delinquencyReferences, ...auditReferences];
  const allReferences = [...settlementReferences, ...evidenceReferences, ...reviewReferences];
  const hasSourceContext = Boolean(landlordId && (rows.length || reconciliationRecords.length || evidencePacks.length || reviews.length));
  const status = deriveStatus({ hasSourceContext, references: allReferences, dependencies: dependencyItems });
  const blockedReasons = [
    ...allReferences.map((reference) => reference.blockedReason).filter(Boolean),
    ...dependencyItems.map((dependency) => dependency.blockedReason).filter(Boolean),
  ] as string[];
  const totalLedgerAmount = rows.reduce((sum, row) => sum + amountCents(row.expectedAmountCents), 0);
  const totalReconciledAmount = rows
    .filter((row) => row.reconciliationStatus === "reconciled" || row.evidenceStatus === "reconciled")
    .reduce((sum, row) => sum + amountCents(row.paidAmountCents || row.expectedAmountCents), 0);

  return {
    settlementReadinessId,
    status,
    manualReviewRequired: true,
    paymentExecutionEnabled: false,
    bankingIntegrationEnabled: false,
    tokenizationEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      totalLedgerAmount: (totalLedgerAmount / 100).toFixed(2),
      totalReconciledAmount: (totalReconciledAmount / 100).toFixed(2),
    },
    settlementReferences,
    reconciliationReferences,
    ledgerReferences,
    workflowDependencies: dependencyItems,
    evidenceReferences,
    reviewReferences,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents: [
      canonicalEvent({
        eventType: "settlement_readiness_derived",
        status,
        settlementReadinessId,
        summary: "Settlement readiness was derived from existing ledger, review, evidence, and audit references.",
      }),
      ...(status === "ready_for_review"
        ? [
            canonicalEvent({
              eventType: "settlement_reconciliation_verified",
              status,
              settlementReadinessId,
              summary: "Settlement reconciliation references are verified for manual review.",
            }),
          ]
        : []),
      ...(status === "blocked"
        ? [
            canonicalEvent({
              eventType: "settlement_readiness_blocked",
              status,
              settlementReadinessId,
              summary: "Settlement readiness is blocked by missing or unsafe traceability.",
            }),
          ]
        : []),
      canonicalEvent({
        eventType: "settlement_redaction_applied",
        status,
        settlementReadinessId,
        summary: "Sensitive payment and banking payloads were excluded from settlement readiness.",
      }),
      ...(status === "partially_ready"
        ? [
            canonicalEvent({
              eventType: "settlement_review_required",
              status,
              settlementReadinessId,
              summary: "Manual review is required before settlement coordination can proceed.",
            }),
          ]
        : []),
    ],
  };
}
