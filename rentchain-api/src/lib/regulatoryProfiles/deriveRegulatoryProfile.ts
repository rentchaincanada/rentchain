import type {
  DeriveRegulatoryProfileInput,
  RegulatoryCanonicalEvent,
  RegulatoryJurisdiction,
  RegulatoryProfile,
  RegulatoryProfileStatus,
  RegulatoryReference,
} from "./regulatoryProfileTypes";
import { regulatoryIdPart, regulatoryReference } from "./regulatoryRestrictionModels";

const REDACTIONS = [
  "Legal opinions and legal advice are excluded.",
  "Government filing payloads are excluded.",
  "Raw screening and credit bureau payloads are excluded.",
  "Sensitive tenant and payment data are excluded.",
  "Regulatory references are operational readiness summaries only.",
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

function jurisdictionFrom(input: DeriveRegulatoryProfileInput): RegulatoryJurisdiction {
  const property = asArray(input.properties)[0] || {};
  return {
    country: "CA",
    province: asString(input.province || property.province || property.provinceState || property.state, 40).toUpperCase() || "UNKNOWN",
    municipality: asString(input.municipality || property.municipality || property.city, 120) || "Unknown municipality",
  };
}

function event(input: {
  eventType: RegulatoryCanonicalEvent["eventType"];
  status: RegulatoryProfileStatus;
  regulatoryProfileId: string;
  summary: string;
}): RegulatoryCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^regulatory_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "regulatory_profile",
    resourceId: input.regulatoryProfileId,
    summary: input.summary,
  };
}

function profileStatus(hasContext: boolean, references: RegulatoryReference[]): RegulatoryProfileStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  if (references.some((reference) => reference.status === "partially_verified" || reference.status === "unavailable")) return "partially_ready";
  return "ready_for_review";
}

export function deriveRegulatoryProfile(input: DeriveRegulatoryProfileInput): RegulatoryProfile {
  const landlordId = asString(input.landlordId, 240);
  const jurisdiction = jurisdictionFrom(input);
  const regulatoryProfileId =
    regulatoryIdPart(["regulatory_profile", landlordId || "unknown", jurisdiction.country, jurisdiction.province, jurisdiction.municipality].join(":")) ||
    "regulatory_profile:unknown";
  const properties = asArray(input.properties);
  const registryStatuses = asArray(input.registryStatuses);
  const screeningOrders = asArray(input.screeningOrders);
  const consentRecords = asArray(input.consentRecords);
  const sharingRooms = asArray(input.sharingRooms);
  const exports = asArray(input.institutionExportPackages);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const auditEvents = asArray(input.auditEvents);
  const settlementReadiness = input.settlementReadiness || null;
  const auditReadiness = input.auditComplianceReadiness || null;

  const registryReferences = (registryStatuses.length ? registryStatuses : properties).map((record, index) => {
    const propertyId = asString(record.propertyId || record.id, 240);
    const verified = ["verified", "matched", "ready", "active"].includes(asString(record.status || record.registryStatus, 80));
    return regulatoryReference({
      idParts: ["registry", propertyId || index],
      referenceType: "registry",
      status: propertyId && verified ? "verified" : propertyId ? "partially_verified" : "unavailable",
      label: "Registry readiness reference",
      description: "Property registry metadata is available for jurisdiction-aware review.",
      jurisdiction,
      restricted: !verified,
      reasons: verified ? [] : ["Registry verification is incomplete or unavailable."],
      evidenceLineage: evidencePacks.map((pack) => asString(pack.evidencePackId || pack.id, 240)).filter(Boolean),
      destination: propertyId ? `/properties?propertyId=${encodeURIComponent(propertyId)}` : null,
    });
  });

  const screeningReadiness = [
    regulatoryReference({
      idParts: ["screening", screeningOrders.length || "none"],
      referenceType: "screening",
      status: screeningOrders.length ? "partially_verified" : "unavailable",
      label: "Screening readiness",
      description: screeningOrders.length
        ? `${screeningOrders.length} screening references are available as summary metadata.`
        : "No landlord-scoped screening readiness references were available.",
      jurisdiction,
      restricted: !screeningOrders.length,
      reasons: screeningOrders.length ? [] : ["Screening readiness lineage is unavailable."],
      reviewLineage: reviews.map((review) => asString(review.reviewSessionId || review.id, 240)).filter(Boolean),
    }),
  ];

  const privacyReadiness = [
    regulatoryReference({
      idParts: ["privacy", consentRecords.length || "none"],
      referenceType: "privacy",
      status: consentRecords.length ? "verified" : "blocked",
      label: "Privacy and consent readiness",
      description: consentRecords.length
        ? `${consentRecords.length} consent references are available for operational review.`
        : "Consent lineage is required before regulated sharing review.",
      jurisdiction,
      restricted: !consentRecords.length,
      reasons: consentRecords.length ? [] : ["Consent lineage is missing."],
      blockedReason: consentRecords.length ? null : "Consent/access lineage is required for regulatory profile readiness.",
    }),
  ];

  const sharingRestrictions = sharingRooms.map((room) => {
    const blocked = room.publiclyAccessible === true || room.externalExecutionEnabled === true || room.status === "blocked";
    return regulatoryReference({
      idParts: ["sharing", room.sharingRoomId || room.id || "unknown"],
      referenceType: "sharing",
      status: blocked ? "blocked" : "verified",
      label: "Institutional sharing restriction",
      description: "Institutional sharing metadata is available for regulatory review.",
      jurisdiction,
      restricted: blocked,
      reasons: blocked ? ["Sharing room metadata indicates public access, external execution, or blocked review state."] : [],
      reviewLineage: reviews.map((review) => asString(review.reviewSessionId || review.id, 240)).filter(Boolean),
      evidenceLineage: evidencePacks.map((pack) => asString(pack.evidencePackId || pack.id, 240)).filter(Boolean),
      destination: "/institutional-sharing-rooms",
      blockedReason: blocked ? "Sharing restriction requires manual review." : null,
    });
  });

  const settlementRestrictions = settlementReadiness
    ? [
        regulatoryReference({
          idParts: ["settlement", settlementReadiness.settlementReadinessId],
          referenceType: "settlement",
          status: settlementReadiness.status === "blocked" ? "blocked" : settlementReadiness.status === "ready_for_review" ? "verified" : "partially_verified",
          label: "Settlement readiness restriction",
          description: "Settlement readiness metadata is available for jurisdiction-aware review.",
          jurisdiction,
          restricted: settlementReadiness.status !== "ready_for_review",
          reasons: settlementReadiness.blockedReasons || [],
          reviewLineage: settlementReadiness.reviewReferences.map((reference) => reference.settlementReferenceId),
          evidenceLineage: settlementReadiness.evidenceReferences.map((reference) => reference.settlementReferenceId),
          destination: "/settlement-readiness",
          blockedReason: settlementReadiness.status === "blocked" ? "Settlement readiness is blocked." : null,
        }),
      ]
    : [
        regulatoryReference({
          idParts: ["settlement", "missing"],
          referenceType: "settlement",
          status: "unavailable",
          label: "Settlement readiness restriction",
          description: "Settlement readiness metadata is unavailable.",
          jurisdiction,
          restricted: true,
          reasons: ["Settlement readiness context is unavailable."],
          destination: "/settlement-readiness",
        }),
      ];

  const exportRestrictions = exports.map((pkg) => {
    const blocked = pkg.externalSubmissionEnabled === true || pkg.status === "blocked";
    return regulatoryReference({
      idParts: ["export", pkg.packageId || pkg.id || "unknown"],
      referenceType: "export",
      status: blocked ? "blocked" : "verified",
      label: "Export/shareability restriction",
      description: "Institution export preview metadata is available.",
      jurisdiction,
      restricted: blocked,
      reasons: blocked ? ["Export preview is blocked or external submission is enabled."] : [],
      destination: "/institution-exports",
      blockedReason: blocked ? "Export restriction requires manual review." : null,
    });
  });

  const auditReferences = auditReadiness
    ? [
        regulatoryReference({
          idParts: ["audit", auditReadiness.readinessId],
          referenceType: "audit",
          status: auditReadiness.status === "blocked" ? "blocked" : auditReadiness.status === "ready_for_review" ? "verified" : "partially_verified",
          label: "Audit/compliance readiness",
          description: "Audit/compliance readiness is available as operational review metadata.",
          jurisdiction,
          restricted: auditReadiness.status !== "ready_for_review",
          reasons: auditReadiness.checks.flatMap((check) => check.blockedReasons || []).slice(0, 8),
          destination: "/audit-compliance",
          blockedReason: auditReadiness.status === "blocked" ? "Audit readiness is blocked." : null,
        }),
      ]
    : [];

  const reviewReferences = reviews.map((review) =>
    regulatoryReference({
      idParts: ["review", review.reviewSessionId || review.id || "unknown"],
      referenceType: "review",
      status: review.status === "completed" ? "verified" : "partially_verified",
      label: "Review lineage",
      description: "Operator review lineage is available for regulatory review.",
      jurisdiction,
      reviewLineage: [asString(review.reviewSessionId || review.id, 240)].filter(Boolean),
      destination: "/review-timeline",
    })
  );

  const evidenceReferences = evidencePacks.map((pack) =>
    regulatoryReference({
      idParts: ["evidence", pack.evidencePackId || pack.id || "unknown"],
      referenceType: "audit",
      status: pack.status === "blocked" ? "blocked" : "verified",
      label: "Evidence lineage",
      description: "Evidence pack metadata is available for regulatory review.",
      jurisdiction,
      evidenceLineage: [asString(pack.evidencePackId || pack.id, 240)].filter(Boolean),
      destination: "/evidence-packs",
      blockedReason: pack.status === "blocked" ? "Evidence pack is blocked." : null,
    })
  );

  const allReferences = [
    ...registryReferences,
    ...screeningReadiness,
    ...privacyReadiness,
    ...sharingRestrictions,
    ...settlementRestrictions,
    ...exportRestrictions,
    ...auditReferences,
    ...reviewReferences,
    ...evidenceReferences,
  ];
  const hasContext = Boolean(landlordId && (properties.length || registryStatuses.length || auditEvents.length || settlementReadiness || auditReadiness));
  const status = profileStatus(hasContext, allReferences);
  const blockedReasons = allReferences.map((reference) => reference.blockedReason).filter(Boolean) as string[];
  const restrictions = allReferences.filter((reference) => reference.restrictionSummary.restricted).length;

  return {
    regulatoryProfileId,
    jurisdiction,
    status,
    manualReviewRequired: true,
    legalCertificationEnabled: false,
    externalRegulatorSubmissionEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyReadyReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions,
    },
    registryReferences,
    screeningReadiness,
    privacyReadiness,
    sharingRestrictions,
    settlementRestrictions: [...settlementRestrictions, ...exportRestrictions, ...auditReferences],
    reviewReferences,
    evidenceReferences,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents: [
      event({
        eventType: "regulatory_profile_derived",
        status,
        regulatoryProfileId,
        summary: "Regulatory profile was derived from jurisdiction, readiness, review, and evidence metadata.",
      }),
      ...(restrictions
        ? [
            event({
              eventType: "regulatory_restriction_detected",
              status,
              regulatoryProfileId,
              summary: "Operational regulatory restrictions were detected for manual review.",
            }),
          ]
        : []),
      ...(status === "blocked"
        ? [
            event({
              eventType: "regulatory_profile_blocked",
              status,
              regulatoryProfileId,
              summary: "Regulatory profile readiness is blocked by missing or unsafe references.",
            }),
          ]
        : []),
      event({
        eventType: "regulatory_redaction_applied",
        status,
        regulatoryProfileId,
        summary: "Sensitive legal, screening, tenant, and payment data were excluded.",
      }),
      ...(status === "partially_ready"
        ? [
            event({
              eventType: "regulatory_review_required",
              status,
              regulatoryProfileId,
              summary: "Manual regulatory profile review is required.",
            }),
          ]
        : []),
    ],
  };
}
