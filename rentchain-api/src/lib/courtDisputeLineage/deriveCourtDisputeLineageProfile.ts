import type {
  CourtDisputeCanonicalEvent,
  CourtDisputeLineageProfile,
  CourtDisputeLineageStatus,
  CourtDisputeReference,
  CourtDisputeReferenceStatus,
  CourtDisputeReferenceType,
  DeriveCourtDisputeLineageProfileInput,
} from "./courtDisputeLineageTypes";
import {
  courtDisputeIdPart,
  courtDisputeReference,
  courtDisputeRestriction,
} from "./courtDisputeRestrictionModels";

const REDACTIONS = [
  "Legal filing workflows, court e-filing payloads, filing forms, filing submission payloads, and legal advice outputs are excluded.",
  "Raw court documents, raw payment account details, private tenant data, raw screening or credit bureau payloads, and admin-only payloads are excluded.",
  "Court and dispute lineage is visibility metadata only; no judgment execution, collections execution, bureau reporting, public blacklisting, or autonomous enforcement is enabled.",
  "Filing-readiness and judgment/order references are operational metadata references only and do not imply legal readiness, legal advice, or legal authority.",
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

function referenceStatus(record: Record<string, any>, verifiedStatuses: string[]): CourtDisputeReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion || record?.recordStatus, 80).toLowerCase();
  if (status === "blocked" || status === "sealed" || status === "restricted" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") {
    return "blocked";
  }
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function statusForType(referenceType: CourtDisputeReferenceType, record: Record<string, any>): CourtDisputeReferenceStatus {
  if (referenceType === "review") return referenceStatus(record, ["ready_for_review", "completed", "verified", "reviewed"]);
  if (referenceType === "audit" && asString(record?.eventType || record?.type, 120)) return "verified";
  if (referenceType === "rental_debt") return referenceStatus(record, ["verified", "review_required", "partially_verified"]);
  return referenceStatus(record, ["ready_for_review", "verified", "available", "completed", "stable", "active", "configured"]);
}

function profileStatus(hasContext: boolean, references: CourtDisputeReference[]): CourtDisputeLineageStatus {
  if (!hasContext) return "unknown";
  if (
    references.some(
      (reference) =>
        reference.status === "blocked" &&
        (reference.referenceType === "consent" || reference.referenceType === "dispute" || reference.referenceType === "court_record")
    )
  ) {
    return "blocked";
  }
  const criticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "consent" ||
        reference.referenceType === "dispute" ||
        reference.referenceType === "review" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "audit")
  );
  if (criticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "blocked" || reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_verified";
  return "verified";
}

function event(input: {
  eventType: CourtDisputeCanonicalEvent["eventType"];
  status: CourtDisputeLineageStatus;
  courtDisputeLineageId: string;
  summary: string;
}): CourtDisputeCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^court_dispute_lineage_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "court_dispute_lineage_profile",
    resourceId: input.courtDisputeLineageId,
    summary: input.summary,
  };
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: CourtDisputeReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): CourtDisputeReference[] {
  if (!input.records.length) {
    return [
      courtDisputeReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for court and dispute lineage review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return courtDisputeReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available as operational court and dispute lineage metadata.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for court and dispute lineage safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function deriveCourtDisputeLineageProfile(input: DeriveCourtDisputeLineageProfileInput): CourtDisputeLineageProfile {
  const landlordId = asString(input.landlordId, 240) || "unknown";
  const tenantId = asString(input.tenantId, 240) || "unknown";
  const courtDisputeLineageId =
    courtDisputeIdPart(["court_dispute_lineage", landlordId, tenantId].join(":")) || "court_dispute_lineage:unknown";

  const disputeRecords = asArray(input.disputeRecords);
  const courtRecords = asArray(input.courtRecordReferences);
  const filingReadinessRecords = asArray(input.filingReadinessReferences);
  const judgmentOrderRecords = asArray(input.judgmentOrderReferences);
  const rentalDebtRecords = asArray(input.rentalDebtReferences);
  const consentRecords = asArray(input.consentRecords);
  const reviewRecords = asArray(input.reviewRecords);
  const evidencePacks = asArray(input.evidencePacks);
  const auditEvents = asArray(input.auditEvents);

  const disputeReferences = referencesFor({
    records: disputeRecords,
    fallback: "dispute",
    referenceType: "dispute",
    idKeys: ["disputeId", "disputeGovernanceId", "caseId", "id"],
    label: "Dispute lineage reference",
    description: "Dispute lineage and dispute-governance metadata",
    destination: "/review-timeline",
    blockedReason: "Dispute lineage is blocked.",
  });
  const courtRecordReferences = referencesFor({
    records: courtRecords,
    fallback: "court-record",
    referenceType: "court_record",
    idKeys: ["courtRecordId", "courtReferenceId", "caseId", "id"],
    label: "Court-record metadata reference",
    description: "Court-record reference metadata",
    destination: "/court-dispute-lineage",
    blockedReason: "Court-record metadata reference is blocked.",
  });
  const filingReadinessReferences = referencesFor({
    records: filingReadinessRecords,
    fallback: "filing-readiness",
    referenceType: "filing_readiness",
    idKeys: ["filingReadinessId", "courtFilingReadinessId", "caseId", "id"],
    label: "Filing-readiness metadata reference",
    description: "Read-only filing preparedness metadata",
    destination: "/court-dispute-lineage",
    blockedReason: "Filing-readiness metadata reference is blocked.",
  });
  const judgmentOrderReferences = referencesFor({
    records: judgmentOrderRecords,
    fallback: "judgment-order",
    referenceType: "judgment_order",
    idKeys: ["judgmentOrderId", "orderReferenceId", "caseId", "id"],
    label: "Judgment/order metadata reference",
    description: "Judgment or order reference metadata",
    destination: "/court-dispute-lineage",
    blockedReason: "Judgment/order metadata reference is blocked.",
  });
  const rentalDebtReferences = referencesFor({
    records: rentalDebtRecords,
    fallback: "rental-debt",
    referenceType: "rental_debt",
    idKeys: ["rentalDebtId", "debtReferenceId", "id"],
    label: "Rental debt accountability reference",
    description: "Rental debt accountability linkage metadata",
    destination: "/rental-debt",
    blockedReason: "Rental debt accountability linkage is blocked.",
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
    label: "Court/dispute review lineage reference",
    description: "Manual court/dispute review lineage metadata",
    destination: "/review-timeline",
    blockedReason: "Court/dispute review lineage is blocked.",
  });
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Court/dispute evidence lineage reference",
    description: "Court/dispute evidence lineage metadata",
    destination: "/evidence-packs",
    blockedReason: "Court/dispute evidence lineage is blocked.",
  });
  const auditReferences = referencesFor({
    records: auditEvents.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "auditId", "id"],
    label: "Court/dispute audit lineage reference",
    description: "Court/dispute audit lineage metadata",
    destination: "/review-timeline",
    blockedReason: "Court/dispute audit lineage is blocked.",
  });

  const allReferences = [
    ...disputeReferences,
    ...courtRecordReferences,
    ...filingReadinessReferences,
    ...judgmentOrderReferences,
    ...rentalDebtReferences,
    ...consentReferences,
    ...reviewReferences,
    ...evidenceReferences,
    ...auditReferences,
  ];
  const hasContext = Boolean(
    disputeRecords.length ||
      courtRecords.length ||
      filingReadinessRecords.length ||
      judgmentOrderRecords.length ||
      rentalDebtRecords.length ||
      consentRecords.length ||
      reviewRecords.length ||
      evidencePacks.length ||
      auditEvents.length
  );
  const status = profileStatus(hasContext, allReferences);
  const courtDisputeRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      courtDisputeRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for court and dispute lineage review.`,
        blockedReason: reference.blockedReason,
      })
    );
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...courtDisputeRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: CourtDisputeCanonicalEvent[] = [
    event({
      eventType: "court_dispute_lineage_profile_derived",
      status,
      courtDisputeLineageId,
      summary:
        "Court and dispute lineage profile derived from dispute, court-record, filing-readiness, judgment/order, rental debt, consent, review, evidence, and audit metadata.",
    }),
    event({
      eventType: "court_dispute_lineage_redaction_applied",
      status,
      courtDisputeLineageId,
      summary:
        "Legal filing, court e-filing, raw court document, legal advice, collections, bureau reporting, public exposure, and sensitive payloads were excluded.",
    }),
  ];
  if (courtDisputeRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "court_dispute_lineage_restriction_detected",
        status,
        courtDisputeLineageId,
        summary: "Court and dispute lineage restrictions are visible for manual review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_verified") {
    canonicalEvents.push(
      event({
        eventType: "court_dispute_lineage_review_required",
        status,
        courtDisputeLineageId,
        summary: "Manual court and dispute lineage review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "court_dispute_lineage_blocked",
        status,
        courtDisputeLineageId,
        summary: "Court and dispute lineage profile is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    courtDisputeLineageId,
    status,
    landlordId,
    tenantId,
    manualReviewRequired: true,
    legalFilingExecutionEnabled: false,
    collectionsExecutionEnabled: false,
    bureauReportingEnabled: false,
    publicCourtRecordExposureEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: courtDisputeRestrictions.length,
    },
    disputeReferences,
    courtRecordReferences,
    filingReadinessReferences,
    judgmentOrderReferences,
    rentalDebtReferences,
    consentReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    courtDisputeRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
