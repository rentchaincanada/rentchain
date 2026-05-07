import type {
  DerivePublicExposureHardeningProfileInput,
  PublicExposureCanonicalEvent,
  PublicExposureHardeningProfile,
  PublicExposureHardeningStatus,
  PublicExposureReference,
} from "./publicExposureHardeningTypes";
import { publicExposureIdPart, publicExposureReference, publicExposureRestriction } from "./publicExposureRestrictionModels";

const DEFAULT_HARDENING_KEY = "controlled-production-exposure-readiness-v1";

const REDACTIONS = [
  "Deployment credentials, tokens, secrets, and environment values are excluded.",
  "Sensitive tenant, payment, screening, private document, and admin-only infrastructure payloads are excluded.",
  "Public exposure hardening is readiness metadata only; no autonomous deployment, rollback, or public launch execution is enabled.",
  "Unrestricted operational telemetry, infrastructure mutation APIs, and secret-management execution are excluded.",
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

function readinessStatus(hasContext: boolean, references: PublicExposureReference[]): PublicExposureHardeningStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  const hasCriticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "release" ||
        reference.referenceType === "rollback" ||
        reference.referenceType === "operational_risk" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "review" ||
        reference.referenceType === "security")
  );
  if (hasCriticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

function event(input: {
  eventType: PublicExposureCanonicalEvent["eventType"];
  status: PublicExposureHardeningStatus;
  publicExposureHardeningId: string;
  summary: string;
}): PublicExposureCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^public_exposure_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "public_exposure_hardening_profile",
    resourceId: input.publicExposureHardeningId,
    summary: input.summary,
  };
}

function statusFromRecord(record: Record<string, any>, verifiedStatuses: string[]): PublicExposureReference["status"] {
  const status = asString(record?.status || record?.state || record?.conclusion, 80).toLowerCase();
  if (status === "blocked" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function releaseStatus(profile: Record<string, any>): PublicExposureReference["status"] {
  const status = asString(profile?.status, 80);
  if (status === "blocked") return "blocked";
  if (status === "ready_for_review") return "verified";
  if (status === "unknown" || status === "review_required") return "unavailable";
  return "partially_verified";
}

function operationalRiskStatus(profile: Record<string, any>): PublicExposureReference["status"] {
  const status = asString(profile?.status, 80);
  if (status === "blocked" || status === "elevated") return "blocked";
  if (status === "stable") return "verified";
  if (status === "unknown") return "unavailable";
  return "partially_verified";
}

function readyBlockedStatus(record: Record<string, any>, readyStatuses: string[]): PublicExposureReference["status"] {
  const status = asString(record?.status, 80);
  if (status === "blocked") return "blocked";
  if (readyStatuses.includes(status)) return "verified";
  if (status === "unknown" || status === "unavailable") return "unavailable";
  return "partially_verified";
}

export function derivePublicExposureHardeningProfile(input: DerivePublicExposureHardeningProfileInput): PublicExposureHardeningProfile {
  const hardeningKey = asString(input.hardeningKey, 160) || DEFAULT_HARDENING_KEY;
  const publicExposureHardeningId =
    publicExposureIdPart(["public_exposure_hardening", hardeningKey].join(":")) || "public_exposure_hardening:unknown";

  const releaseGovernanceProfiles = asArray(input.releaseGovernanceProfiles);
  const rollbackArtifacts = asArray(input.rollbackArtifacts);
  const securityReadiness = asArray(input.securityReadiness);
  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const onboardingReadiness = asArray(input.institutionOnboardingReadiness);
  const supportReadiness = asArray(input.supportReadiness);
  const reviews = asArray(input.operatorReviewSessions);
  const evidencePacks = asArray(input.evidencePacks);
  const auditEvents = asArray(input.auditEvents);

  const releaseReferences = releaseGovernanceProfiles.length
    ? releaseGovernanceProfiles.map((profile) => {
        const status = releaseStatus(profile);
        return publicExposureReference({
          idParts: ["release", recordId(profile, ["releaseGovernanceId", "releaseVersion", "id"]) || "unknown"],
          referenceType: "release",
          status,
          label: "Release readiness reference",
          description: "Release governance readiness is available for public exposure hardening review.",
          lineageReferences: [recordId(profile, ["releaseGovernanceId", "releaseVersion", "id"])].filter(Boolean),
          destination: "/admin/release-governance",
          blockedReason: status === "blocked" ? "Release governance readiness is blocked." : null,
        });
      })
    : [
        publicExposureReference({
          idParts: ["release", "missing"],
          referenceType: "release",
          status: "unavailable",
          label: "Release readiness reference",
          description: "Release governance readiness is unavailable for public exposure hardening review.",
          destination: "/admin/release-governance",
        }),
      ];

  const rollbackReferences = rollbackArtifacts.length
    ? rollbackArtifacts.map((artifact) =>
        publicExposureReference({
          idParts: ["rollback", recordId(artifact, ["artifactId", "rollbackId", "path", "id"]) || "unknown"],
          referenceType: "rollback",
          status: statusFromRecord(artifact, ["verified", "complete", "ready_for_review", "passed"]),
          label: "Rollback readiness reference",
          description: "Rollback readiness metadata is available for manual public exposure review.",
          lineageReferences: [recordId(artifact, ["artifactId", "rollbackId", "path", "id"])].filter(Boolean),
          destination: asString(artifact.path, 240) || "/admin/release-governance",
          blockedReason:
            statusFromRecord(artifact, ["verified", "complete", "ready_for_review", "passed"]) === "blocked"
              ? "Rollback readiness is blocked."
              : null,
        })
      )
    : [
        publicExposureReference({
          idParts: ["rollback", "missing"],
          referenceType: "rollback",
          status: "unavailable",
          label: "Rollback readiness reference",
          description: "Rollback readiness metadata is unavailable for public exposure hardening review.",
          destination: "/admin/release-governance",
        }),
      ];

  const securityReferences = securityReadiness.length
    ? securityReadiness.map((security) => {
        const status = readyBlockedStatus(security, ["verified", "ready_for_review", "passed"]);
        return publicExposureReference({
          idParts: ["security", recordId(security, ["securityReadinessId", "checkId", "id"]) || "unknown"],
          referenceType: "security",
          status,
          label: "Security readiness reference",
          description: "Security readiness metadata is available for public exposure hardening review.",
          lineageReferences: [recordId(security, ["securityReadinessId", "checkId", "id"])].filter(Boolean),
          destination: "/admin/ops",
          blockedReason: status === "blocked" ? "Security readiness restriction is unresolved." : null,
        });
      })
    : [
        publicExposureReference({
          idParts: ["security", "missing"],
          referenceType: "security",
          status: "unavailable",
          label: "Security readiness reference",
          description: "Security readiness metadata is unavailable for public exposure hardening review.",
          destination: "/admin/ops",
        }),
      ];

  const operationalRiskReferences = operationalRiskProfiles.length
    ? operationalRiskProfiles.map((profile) => {
        const status = operationalRiskStatus(profile);
        return publicExposureReference({
          idParts: ["operational_risk", recordId(profile, ["operationalRiskId", "id"]) || "unknown"],
          referenceType: "operational_risk",
          status,
          label: "Operational risk dependency",
          description: "Operational risk readiness is available for public exposure hardening review.",
          lineageReferences: [recordId(profile, ["operationalRiskId", "id"])].filter(Boolean),
          destination: "/operational-risk",
          blockedReason: status === "blocked" ? "Unresolved operational risk blocks public exposure readiness." : null,
        });
      })
    : [
        publicExposureReference({
          idParts: ["operational_risk", "missing"],
          referenceType: "operational_risk",
          status: "unavailable",
          label: "Operational risk dependency",
          description: "Operational risk readiness is unavailable for public exposure hardening review.",
          destination: "/operational-risk",
        }),
      ];

  const onboardingReferences = onboardingReadiness.length
    ? onboardingReadiness.map((readiness) => {
        const status = readyBlockedStatus(readiness, ["ready_for_review"]);
        return publicExposureReference({
          idParts: ["onboarding", recordId(readiness, ["onboardingReadinessId", "id"]) || "unknown"],
          referenceType: "onboarding",
          status,
          label: "Onboarding readiness dependency",
          description: "Institution onboarding readiness is available for public exposure hardening review.",
          lineageReferences: [recordId(readiness, ["onboardingReadinessId", "id"])].filter(Boolean),
          destination: "/institution-onboarding-readiness",
          blockedReason: status === "blocked" ? "Onboarding readiness is blocked." : null,
        });
      })
    : [
        publicExposureReference({
          idParts: ["onboarding", "missing"],
          referenceType: "onboarding",
          status: "unavailable",
          label: "Onboarding readiness dependency",
          description: "Onboarding readiness metadata is unavailable for public exposure hardening review.",
          destination: "/institution-onboarding-readiness",
        }),
      ];

  const supportReferences = supportReadiness.length
    ? supportReadiness.map((support) => {
        const status = readyBlockedStatus(support, ["verified", "ready_for_review", "stable"]);
        return publicExposureReference({
          idParts: ["support", recordId(support, ["supportReadinessId", "supportId", "id"]) || "unknown"],
          referenceType: "support",
          status,
          label: "Support readiness dependency",
          description: "Support readiness metadata is available for public exposure hardening review.",
          lineageReferences: [recordId(support, ["supportReadinessId", "supportId", "id"])].filter(Boolean),
          destination: "/admin/support-console",
          blockedReason: status === "blocked" ? "Support readiness is blocked." : null,
        });
      })
    : [
        publicExposureReference({
          idParts: ["support", "missing"],
          referenceType: "support",
          status: "unavailable",
          label: "Support readiness dependency",
          description: "Support readiness metadata is unavailable for public exposure hardening review.",
          destination: "/admin/support-console",
        }),
      ];

  const evidenceReferences = evidencePacks.length
    ? evidencePacks.map((pack) => {
        const status = readyBlockedStatus(pack, ["ready_for_review"]);
        return publicExposureReference({
          idParts: ["evidence", recordId(pack, ["evidencePackId", "id"]) || "unknown"],
          referenceType: "evidence",
          status,
          label: "Evidence lineage reference",
          description: "Evidence lineage is available for public exposure hardening review.",
          lineageReferences: [recordId(pack, ["evidencePackId", "id"])].filter(Boolean),
          destination: "/evidence-packs",
          blockedReason: status === "blocked" ? "Evidence lineage is blocked." : null,
        });
      })
    : [
        publicExposureReference({
          idParts: ["evidence", "missing"],
          referenceType: "evidence",
          status: "unavailable",
          label: "Evidence lineage reference",
          description: "Evidence lineage is unavailable for public exposure hardening review.",
          destination: "/evidence-packs",
        }),
      ];

  const reviewReferences = reviews.length
    ? reviews.map((review) => {
        const status = review.status === "completed" ? "verified" : review.status === "blocked" ? "blocked" : "partially_verified";
        return publicExposureReference({
          idParts: ["review", recordId(review, ["reviewSessionId", "id"]) || "unknown"],
          referenceType: "review",
          status,
          label: "Review lineage reference",
          description: "Operator review lineage is available for public exposure hardening review.",
          lineageReferences: [recordId(review, ["reviewSessionId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: status === "blocked" ? "Operator review lineage is blocked." : null,
        });
      })
    : [
        publicExposureReference({
          idParts: ["review", "missing"],
          referenceType: "review",
          status: "unavailable",
          label: "Review lineage reference",
          description: "Operator review lineage is unavailable for public exposure hardening review.",
          destination: "/review-timeline",
        }),
      ];

  const auditReferences = auditEvents.length
    ? auditEvents.slice(0, 20).map((record) =>
        publicExposureReference({
          idParts: ["audit", recordId(record, ["eventId", "id"]) || "unknown"],
          referenceType: "audit",
          status: record.redacted ? "partially_verified" : "verified",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is available for public exposure hardening review.",
          lineageReferences: [recordId(record, ["eventId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          redacted: Boolean(record.redacted),
          redactionReason: record.redacted ? "Audit payload is redacted for public exposure hardening safety." : null,
        })
      )
    : [
        publicExposureReference({
          idParts: ["audit", "missing"],
          referenceType: "audit",
          status: "unavailable",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is unavailable for public exposure hardening review.",
          destination: "/review-timeline",
        }),
      ];

  const allReferences = [
    ...releaseReferences,
    ...rollbackReferences,
    ...securityReferences,
    ...operationalRiskReferences,
    ...onboardingReferences,
    ...supportReferences,
    ...evidenceReferences,
    ...reviewReferences,
    ...auditReferences,
  ];

  const publicExposureRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      publicExposureRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for public exposure hardening readiness.`,
        blockedReason: reference.blockedReason,
      })
    );

  const hasContext = Boolean(
    releaseGovernanceProfiles.length ||
      rollbackArtifacts.length ||
      securityReadiness.length ||
      operationalRiskProfiles.length ||
      onboardingReadiness.length ||
      supportReadiness.length ||
      reviews.length ||
      evidencePacks.length ||
      auditEvents.length
  );
  const status = readinessStatus(hasContext, allReferences);
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...publicExposureRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: PublicExposureCanonicalEvent[] = [
    event({
      eventType: "public_exposure_hardening_profile_derived",
      status,
      publicExposureHardeningId,
      summary:
        "Public exposure hardening profile derived from release, rollback, security, operational risk, onboarding, support, evidence, review, and audit metadata.",
    }),
    event({
      eventType: "public_exposure_redaction_applied",
      status,
      publicExposureHardeningId,
      summary:
        "Secrets, credentials, sensitive tenant/payment/screening payloads, unrestricted infrastructure telemetry, deployment execution, rollback execution, and launch payloads were excluded.",
    }),
  ];
  if (publicExposureRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "public_exposure_restriction_detected",
        status,
        publicExposureHardeningId,
        summary: "Public exposure restrictions are visible for manual approval review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "public_exposure_review_required",
        status,
        publicExposureHardeningId,
        summary: "Manual public exposure hardening review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "public_exposure_blocked",
        status,
        publicExposureHardeningId,
        summary: "Public exposure hardening readiness is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    publicExposureHardeningId,
    status,
    manualApprovalRequired: true,
    autonomousLaunchEnabled: false,
    autonomousRollbackEnabled: false,
    publicExposureEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: publicExposureRestrictions.length,
    },
    releaseReferences,
    rollbackReferences,
    securityReferences,
    operationalRiskReferences,
    onboardingReferences,
    supportReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    publicExposureRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
