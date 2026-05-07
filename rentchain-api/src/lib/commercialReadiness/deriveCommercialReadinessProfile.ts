import type {
  CommercialCanonicalEvent,
  CommercialReadinessProfile,
  CommercialReadinessStatus,
  CommercialReference,
  DeriveCommercialReadinessProfileInput,
} from "./commercialReadinessTypes";
import { commercialIdPart, commercialReference, commercialRestriction } from "./commercialRestrictionModels";

const DEFAULT_READINESS_KEY = "institutional-commercial-operations-readiness-v1";

const REDACTIONS = [
  "Payment credentials, subscription secrets, customer financial histories, and payment account details are excluded.",
  "Commercial readiness is metadata only; no billing, charging, contract, messaging, onboarding, or commercialization execution is enabled.",
  "Sensitive tenant, payment, screening, private document, customer financial, and admin-only commercial payloads are excluded.",
  "Public self-service monetization controls, unrestricted commercial telemetry, and payment-provider execution payloads are excluded.",
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

function readinessStatus(hasContext: boolean, references: CommercialReference[]): CommercialReadinessStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  const hasCriticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "pricing" ||
        reference.referenceType === "billing" ||
        reference.referenceType === "onboarding" ||
        reference.referenceType === "operational_risk" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "review")
  );
  if (hasCriticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

function event(input: {
  eventType: CommercialCanonicalEvent["eventType"];
  status: CommercialReadinessStatus;
  commercialReadinessId: string;
  summary: string;
}): CommercialCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^commercial_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "commercial_readiness_profile",
    resourceId: input.commercialReadinessId,
    summary: input.summary,
  };
}

function statusFromRecord(record: Record<string, any>, verifiedStatuses: string[]): CommercialReference["status"] {
  const status = asString(record?.status || record?.state || record?.conclusion, 80).toLowerCase();
  if (status === "blocked" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function readyBlockedStatus(record: Record<string, any>, readyStatuses: string[]): CommercialReference["status"] {
  const status = asString(record?.status || record?.state || record?.conclusion, 80).toLowerCase();
  if (status === "blocked" || status === "failed" || status === "failure") return "blocked";
  if (readyStatuses.includes(status)) return "verified";
  if (status === "unknown" || status === "unavailable" || status === "missing" || status === "pending") return "unavailable";
  return "partially_verified";
}

function releaseStatus(profile: Record<string, any>): CommercialReference["status"] {
  const status = asString(profile?.status, 80);
  if (status === "blocked") return "blocked";
  if (status === "ready_for_review") return "verified";
  if (status === "unknown" || status === "review_required") return "unavailable";
  return "partially_verified";
}

function operationalRiskStatus(profile: Record<string, any>): CommercialReference["status"] {
  const status = asString(profile?.status, 80);
  if (status === "blocked" || status === "elevated") return "blocked";
  if (status === "stable") return "verified";
  if (status === "unknown") return "unavailable";
  return "partially_verified";
}

export function deriveCommercialReadinessProfile(input: DeriveCommercialReadinessProfileInput): CommercialReadinessProfile {
  const readinessKey = asString(input.readinessKey, 160) || DEFAULT_READINESS_KEY;
  const commercialReadinessId =
    commercialIdPart(["commercial_readiness", readinessKey].join(":")) || "commercial_readiness:unknown";

  const pricingReadiness = asArray(input.pricingReadiness);
  const billingReadiness = asArray(input.billingReadiness);
  const subscriptionReadiness = asArray(input.subscriptionReadiness);
  const onboardingReadiness = asArray(input.enterpriseOnboardingReadiness);
  const supportReadiness = asArray(input.supportReadiness);
  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const releaseGovernanceProfiles = asArray(input.releaseGovernanceProfiles);
  const reviews = asArray(input.operatorReviewSessions);
  const evidencePacks = asArray(input.evidencePacks);
  const auditEvents = asArray(input.auditEvents);

  const pricingReferences = pricingReadiness.length
    ? pricingReadiness.map((pricing) => {
        const status = readyBlockedStatus(pricing, ["verified", "ready_for_review", "configured", "available"]);
        return commercialReference({
          idParts: ["pricing", recordId(pricing, ["pricingReadinessId", "pricingId", "key", "id"]) || "unknown"],
          referenceType: "pricing",
          status,
          label: "Pricing governance reference",
          description: "Pricing governance metadata is available for commercial readiness review.",
          lineageReferences: [recordId(pricing, ["pricingReadinessId", "pricingId", "key", "id"])].filter(Boolean),
          destination: "/site/pricing",
          blockedReason: status === "blocked" ? "Pricing governance readiness is blocked." : null,
        });
      })
    : [
        commercialReference({
          idParts: ["pricing", "missing"],
          referenceType: "pricing",
          status: "unavailable",
          label: "Pricing governance reference",
          description: "Pricing governance metadata is unavailable for commercial readiness review.",
          destination: "/site/pricing",
        }),
      ];

  const billingReferences = billingReadiness.length
    ? billingReadiness.map((billing) => {
        const status = readyBlockedStatus(billing, ["verified", "ready_for_review", "configured"]);
        return commercialReference({
          idParts: ["billing", recordId(billing, ["billingReadinessId", "billingId", "key", "id"]) || "unknown"],
          referenceType: "billing",
          status,
          label: "Billing readiness reference",
          description: "Billing readiness metadata is available for commercial readiness review.",
          lineageReferences: [recordId(billing, ["billingReadinessId", "billingId", "key", "id"])].filter(Boolean),
          destination: "/billing",
          blockedReason: status === "blocked" ? "Billing governance restriction is unresolved." : null,
        });
      })
    : [
        commercialReference({
          idParts: ["billing", "missing"],
          referenceType: "billing",
          status: "unavailable",
          label: "Billing readiness reference",
          description: "Billing readiness metadata is unavailable for commercial readiness review.",
          destination: "/billing",
        }),
      ];

  const subscriptionReferences = subscriptionReadiness.length
    ? subscriptionReadiness.map((subscription) => {
        const status = statusFromRecord(subscription, ["verified", "ready_for_review", "active", "configured"]);
        return commercialReference({
          idParts: ["subscription", recordId(subscription, ["subscriptionReadinessId", "subscriptionId", "key", "id"]) || "unknown"],
          referenceType: "subscription",
          status,
          label: "Subscription governance reference",
          description: "Subscription governance metadata is available for commercial readiness review.",
          lineageReferences: [recordId(subscription, ["subscriptionReadinessId", "subscriptionId", "key", "id"])].filter(Boolean),
          destination: "/billing",
          blockedReason: status === "blocked" ? "Subscription governance readiness is blocked." : null,
        });
      })
    : [
        commercialReference({
          idParts: ["subscription", "missing"],
          referenceType: "subscription",
          status: "unavailable",
          label: "Subscription governance reference",
          description: "Subscription governance metadata is unavailable for commercial readiness review.",
          destination: "/billing",
        }),
      ];

  const onboardingReferences = onboardingReadiness.length
    ? onboardingReadiness.map((readiness) => {
        const status = readyBlockedStatus(readiness, ["ready_for_review", "verified"]);
        return commercialReference({
          idParts: ["onboarding", recordId(readiness, ["onboardingReadinessId", "institutionOnboardingId", "id"]) || "unknown"],
          referenceType: "onboarding",
          status,
          label: "Enterprise onboarding readiness",
          description: "Enterprise onboarding readiness is available for commercial readiness review.",
          lineageReferences: [recordId(readiness, ["onboardingReadinessId", "institutionOnboardingId", "id"])].filter(Boolean),
          destination: "/institution-onboarding-readiness",
          blockedReason: status === "blocked" ? "Enterprise onboarding readiness is blocked." : null,
        });
      })
    : [
        commercialReference({
          idParts: ["onboarding", "missing"],
          referenceType: "onboarding",
          status: "unavailable",
          label: "Enterprise onboarding readiness",
          description: "Enterprise onboarding readiness metadata is unavailable for commercial readiness review.",
          destination: "/institution-onboarding-readiness",
        }),
      ];

  const supportReferences = supportReadiness.length
    ? supportReadiness.map((support) => {
        const status = readyBlockedStatus(support, ["verified", "ready_for_review", "stable"]);
        return commercialReference({
          idParts: ["support", recordId(support, ["supportReadinessId", "supportId", "id"]) || "unknown"],
          referenceType: "support",
          status,
          label: "Customer-operation support readiness",
          description: "Customer-operation and support readiness metadata is available for commercial readiness review.",
          lineageReferences: [recordId(support, ["supportReadinessId", "supportId", "id"])].filter(Boolean),
          destination: "/admin/support-console",
          blockedReason: status === "blocked" ? "Support readiness is blocked." : null,
        });
      })
    : [
        commercialReference({
          idParts: ["support", "missing"],
          referenceType: "support",
          status: "unavailable",
          label: "Customer-operation support readiness",
          description: "Support readiness metadata is unavailable for commercial readiness review.",
          destination: "/admin/support-console",
        }),
      ];

  const operationalRiskReferences = operationalRiskProfiles.length
    ? operationalRiskProfiles.map((profile) => {
        const status = operationalRiskStatus(profile);
        return commercialReference({
          idParts: ["operational_risk", recordId(profile, ["operationalRiskId", "id"]) || "unknown"],
          referenceType: "operational_risk",
          status,
          label: "Operational risk dependency",
          description: "Operational risk readiness is available for commercial readiness review.",
          lineageReferences: [recordId(profile, ["operationalRiskId", "id"])].filter(Boolean),
          destination: "/operational-risk",
          blockedReason: status === "blocked" ? "Unresolved operational risk blocks commercial readiness." : null,
        });
      })
    : [
        commercialReference({
          idParts: ["operational_risk", "missing"],
          referenceType: "operational_risk",
          status: "unavailable",
          label: "Operational risk dependency",
          description: "Operational risk readiness is unavailable for commercial readiness review.",
          destination: "/operational-risk",
        }),
      ];

  const releaseReferences = releaseGovernanceProfiles.length
    ? releaseGovernanceProfiles.map((profile) => {
        const status = releaseStatus(profile);
        return commercialReference({
          idParts: ["release", recordId(profile, ["releaseGovernanceId", "releaseVersion", "id"]) || "unknown"],
          referenceType: "release",
          status,
          label: "Release governance dependency",
          description: "Release governance readiness is available for commercial readiness review.",
          lineageReferences: [recordId(profile, ["releaseGovernanceId", "releaseVersion", "id"])].filter(Boolean),
          destination: "/admin/release-governance",
          blockedReason: status === "blocked" ? "Release governance readiness is blocked." : null,
        });
      })
    : [
        commercialReference({
          idParts: ["release", "missing"],
          referenceType: "release",
          status: "unavailable",
          label: "Release governance dependency",
          description: "Release governance readiness is unavailable for commercial readiness review.",
          destination: "/admin/release-governance",
        }),
      ];

  const evidenceReferences = evidencePacks.length
    ? evidencePacks.map((pack) => {
        const status = readyBlockedStatus(pack, ["ready_for_review", "verified"]);
        return commercialReference({
          idParts: ["evidence", recordId(pack, ["evidencePackId", "id"]) || "unknown"],
          referenceType: "evidence",
          status,
          label: "Evidence lineage reference",
          description: "Evidence lineage is available for commercial readiness review.",
          lineageReferences: [recordId(pack, ["evidencePackId", "id"])].filter(Boolean),
          destination: "/evidence-packs",
          blockedReason: status === "blocked" ? "Evidence lineage is blocked." : null,
        });
      })
    : [
        commercialReference({
          idParts: ["evidence", "missing"],
          referenceType: "evidence",
          status: "unavailable",
          label: "Evidence lineage reference",
          description: "Evidence lineage is unavailable for commercial readiness review.",
          destination: "/evidence-packs",
        }),
      ];

  const reviewReferences = reviews.length
    ? reviews.map((review) => {
        const status = review.status === "completed" ? "verified" : review.status === "blocked" ? "blocked" : "partially_verified";
        return commercialReference({
          idParts: ["review", recordId(review, ["reviewSessionId", "id"]) || "unknown"],
          referenceType: "review",
          status,
          label: "Review lineage reference",
          description: "Operator review lineage is available for commercial readiness review.",
          lineageReferences: [recordId(review, ["reviewSessionId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: status === "blocked" ? "Operator review lineage is blocked." : null,
        });
      })
    : [
        commercialReference({
          idParts: ["review", "missing"],
          referenceType: "review",
          status: "unavailable",
          label: "Review lineage reference",
          description: "Operator review lineage is unavailable for commercial readiness review.",
          destination: "/review-timeline",
        }),
      ];

  const auditReferences = auditEvents.length
    ? auditEvents.slice(0, 20).map((record) =>
        commercialReference({
          idParts: ["audit", recordId(record, ["eventId", "id"]) || "unknown"],
          referenceType: "audit",
          status: record.redacted ? "partially_verified" : "verified",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is available for commercial readiness review.",
          lineageReferences: [recordId(record, ["eventId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          redacted: Boolean(record.redacted),
          redactionReason: record.redacted ? "Audit payload is redacted for commercial readiness safety." : null,
        })
      )
    : [
        commercialReference({
          idParts: ["audit", "missing"],
          referenceType: "audit",
          status: "unavailable",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is unavailable for commercial readiness review.",
          destination: "/review-timeline",
        }),
      ];

  const allReferences = [
    ...pricingReferences,
    ...billingReferences,
    ...subscriptionReferences,
    ...onboardingReferences,
    ...supportReferences,
    ...operationalRiskReferences,
    ...releaseReferences,
    ...evidenceReferences,
    ...reviewReferences,
    ...auditReferences,
  ];

  const commercialRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      commercialRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for commercial readiness.`,
        blockedReason: reference.blockedReason,
      })
    );

  const hasContext = Boolean(
    pricingReadiness.length ||
      billingReadiness.length ||
      subscriptionReadiness.length ||
      onboardingReadiness.length ||
      supportReadiness.length ||
      operationalRiskProfiles.length ||
      releaseGovernanceProfiles.length ||
      reviews.length ||
      evidencePacks.length ||
      auditEvents.length
  );
  const status = readinessStatus(hasContext, allReferences);
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...commercialRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: CommercialCanonicalEvent[] = [
    event({
      eventType: "commercial_readiness_profile_derived",
      status,
      commercialReadinessId,
      summary:
        "Commercial readiness profile derived from pricing, billing, subscription, onboarding, support, operational risk, release, evidence, review, and audit metadata.",
    }),
    event({
      eventType: "commercial_readiness_redaction_applied",
      status,
      commercialReadinessId,
      summary:
        "Payment credentials, subscription secrets, customer financial histories, billing execution payloads, contract execution payloads, and public monetization controls were excluded.",
    }),
  ];
  if (commercialRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "commercial_readiness_restriction_detected",
        status,
        commercialReadinessId,
        summary: "Commercialization restrictions are visible for manual approval review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "commercial_readiness_review_required",
        status,
        commercialReadinessId,
        summary: "Manual commercial readiness review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "commercial_readiness_blocked",
        status,
        commercialReadinessId,
        summary: "Commercial readiness is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    commercialReadinessId,
    status,
    manualApprovalRequired: true,
    autonomousBillingEnabled: false,
    autonomousCommercializationEnabled: false,
    publicSelfServiceEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: commercialRestrictions.length,
    },
    pricingReferences,
    billingReferences,
    subscriptionReferences,
    onboardingReferences,
    supportReferences,
    operationalRiskReferences,
    releaseReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    commercialRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
