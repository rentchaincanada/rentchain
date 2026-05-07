import type {
  DebtReference,
  DebtReferenceStatus,
  DebtReferenceType,
  DeriveRentalDebtProfileInput,
  RentalDebtCanonicalEvent,
  RentalDebtProfile,
  RentalDebtStatus,
} from "./rentalDebtTypes";
import { debtIdPart, debtReference, debtRestriction } from "./debtRestrictionModels";

const REDACTIONS = [
  "Collections execution payloads, bureau reporting payloads, public debt lists, and public accountability marketplace payloads are excluded.",
  "Raw payment account details, private tenant data, unrestricted delinquency histories, and raw screening or credit bureau payloads are excluded.",
  "Rental debt accountability is visibility metadata only; no autonomous enforcement, collections execution, bureau reporting, or public debt exposure is enabled.",
  "Debt references are consent-aware, permission scoped, and manually reviewed before any accountability use.",
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

function recordId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function referenceStatus(record: Record<string, any>, verifiedStatuses: string[]): DebtReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion || record?.paymentStatus, 80).toLowerCase();
  if (status === "blocked" || status === "disputed" || status === "elevated" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") {
    return "blocked";
  }
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function statusForType(referenceType: DebtReferenceType, record: Record<string, any>): DebtReferenceStatus {
  if (referenceType === "review") return referenceStatus(record, ["ready_for_review", "completed", "verified", "reviewed"]);
  if (referenceType === "audit" && asString(record?.eventType || record?.type, 120)) return "verified";
  if (referenceType === "payment_default") return referenceStatus(record, ["verified", "available", "reviewed", "confirmed", "past_due", "overdue", "defaulted"]);
  if (referenceType === "delinquency") return referenceStatus(record, ["verified", "available", "reviewed", "confirmed", "past_due", "overdue", "delinquent"]);
  return referenceStatus(record, ["ready_for_review", "verified", "available", "completed", "stable", "active", "configured"]);
}

function profileStatus(hasContext: boolean, references: DebtReference[]): RentalDebtStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked" && (reference.referenceType === "consent" || reference.referenceType === "dispute"))) return "blocked";
  const criticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "consent" ||
        reference.referenceType === "review" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "audit")
  );
  if (criticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "blocked" || reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_verified";
  return "verified";
}

function event(input: {
  eventType: RentalDebtCanonicalEvent["eventType"];
  status: RentalDebtStatus;
  rentalDebtId: string;
  summary: string;
}): RentalDebtCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^rental_debt_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "rental_debt_profile",
    resourceId: input.rentalDebtId,
    summary: input.summary,
  };
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: DebtReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): DebtReference[] {
  if (!input.records.length) {
    return [
      debtReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for rental debt accountability review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return debtReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available for rental debt accountability review.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for debt accountability safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function deriveRentalDebtProfile(input: DeriveRentalDebtProfileInput): RentalDebtProfile {
  const landlordId = asString(input.landlordId, 240) || "unknown";
  const tenantId = asString(input.tenantId, 240) || "unknown";
  const rentalDebtId = debtIdPart(["rental_debt", landlordId, tenantId].join(":")) || "rental_debt:unknown";

  const paymentDefaultRecords = asArray(input.paymentDefaultRecords);
  const delinquencyRecords = asArray(input.delinquencyRecords);
  const disputeRecords = asArray(input.disputeRecords);
  const consentRecords = asArray(input.consentRecords);
  const reviewRecords = asArray(input.reviewRecords);
  const evidencePacks = asArray(input.evidencePacks);
  const auditEvents = asArray(input.auditEvents);

  const paymentDefaultReferences = referencesFor({
    records: paymentDefaultRecords,
    fallback: "payment-default",
    referenceType: "payment_default",
    idKeys: ["paymentDefaultId", "ledgerEventId", "paymentId", "rentPaymentId", "id"],
    label: "Payment-default reference",
    description: "Payment-default and missed-payment metadata",
    destination: "/ledger",
    blockedReason: "Payment-default reference is blocked.",
  });
  const delinquencyReferences = referencesFor({
    records: delinquencyRecords,
    fallback: "delinquency",
    referenceType: "delinquency",
    idKeys: ["delinquencyId", "ledgerEventId", "rentPaymentId", "paymentId", "id"],
    label: "Delinquency evidence reference",
    description: "Delinquency evidence lineage metadata",
    destination: "/verified-rental-history",
    blockedReason: "Delinquency evidence lineage is blocked.",
  });
  const disputeReferences = referencesFor({
    records: disputeRecords,
    fallback: "dispute",
    referenceType: "dispute",
    idKeys: ["disputeId", "disputeGovernanceId", "caseId", "id"],
    label: "Dispute linkage reference",
    description: "Dispute linkage and dispute-governance metadata",
    destination: "/review-timeline",
    blockedReason: "Dispute linkage is blocked.",
  });
  const consentReferences = referencesFor({
    records: consentRecords,
    fallback: "consent",
    referenceType: "consent",
    idKeys: ["consentId", "consentGovernanceId", "identityConsentId", "id"],
    label: "Consent governance reference",
    description: "Consent governance and access-control metadata",
    destination: "/identity-layer",
    blockedReason: "Consent governance lineage is missing or blocked.",
  });
  const reviewReferences = referencesFor({
    records: reviewRecords,
    fallback: "review",
    referenceType: "review",
    idKeys: ["reviewSessionId", "operatorReviewId", "id"],
    label: "Debt review lineage reference",
    description: "Manual debt review lineage metadata",
    destination: "/review-timeline",
    blockedReason: "Debt review lineage is blocked.",
  });
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Debt evidence lineage reference",
    description: "Debt evidence lineage metadata",
    destination: "/evidence-packs",
    blockedReason: "Debt evidence lineage is blocked.",
  });
  const auditReferences = referencesFor({
    records: auditEvents.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "auditId", "id"],
    label: "Debt audit lineage reference",
    description: "Debt audit lineage metadata",
    destination: "/review-timeline",
    blockedReason: "Debt audit lineage is blocked.",
  });

  const allReferences = [
    ...paymentDefaultReferences,
    ...delinquencyReferences,
    ...disputeReferences,
    ...consentReferences,
    ...reviewReferences,
    ...evidenceReferences,
    ...auditReferences,
  ];
  const hasContext = Boolean(
    paymentDefaultRecords.length ||
      delinquencyRecords.length ||
      disputeRecords.length ||
      consentRecords.length ||
      reviewRecords.length ||
      evidencePacks.length ||
      auditEvents.length
  );
  const status = profileStatus(hasContext, allReferences);
  const debtRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      debtRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for rental debt accountability review.`,
        blockedReason: reference.blockedReason,
      })
    );
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...debtRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: RentalDebtCanonicalEvent[] = [
    event({
      eventType: "rental_debt_profile_derived",
      status,
      rentalDebtId,
      summary: "Rental debt profile derived from payment-default, delinquency, dispute, consent, review, evidence, and audit metadata.",
    }),
    event({
      eventType: "rental_debt_redaction_applied",
      status,
      rentalDebtId,
      summary: "Collections, bureau reporting, public debt exposure, raw payment, private tenant, and unrestricted delinquency payloads were excluded.",
    }),
  ];
  if (debtRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "rental_debt_restriction_detected",
        status,
        rentalDebtId,
        summary: "Rental debt accountability restrictions are visible for manual review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_verified") {
    canonicalEvents.push(
      event({
        eventType: "rental_debt_review_required",
        status,
        rentalDebtId,
        summary: "Manual rental debt accountability review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "rental_debt_blocked",
        status,
        rentalDebtId,
        summary: "Rental debt accountability profile is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    rentalDebtId,
    status,
    landlordId,
    tenantId,
    manualReviewRequired: true,
    collectionsExecutionEnabled: false,
    bureauReportingEnabled: false,
    publicDebtExposureEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: debtRestrictions.length,
    },
    paymentDefaultReferences,
    delinquencyReferences,
    disputeReferences,
    consentReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    debtRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
