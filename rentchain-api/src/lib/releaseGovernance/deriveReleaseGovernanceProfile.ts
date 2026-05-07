import type {
  DeriveReleaseGovernanceProfileInput,
  ReleaseGovernanceCanonicalEvent,
  ReleaseGovernanceProfile,
  ReleaseGovernanceStatus,
  ReleaseReference,
} from "./releaseGovernanceTypes";
import { releaseGovernanceIdPart, releaseReference, releaseRestriction } from "./releaseRestrictionModels";

const DEFAULT_RELEASE_VERSION = "v0.9.0-core-foundation";

const REDACTIONS = [
  "Deployment credentials, tokens, secrets, and environment values are excluded.",
  "Sensitive admin-only infrastructure telemetry and unrestricted CI/CD logs are excluded.",
  "Production mutation, deployment execution, rollback execution, and public launch payloads are excluded.",
  "Release governance is readiness metadata only; no autonomous deployment, rollback, or launch execution is enabled.",
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

function referenceId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function statusFromRecord(record: Record<string, any>, verifiedStatuses: string[]): ReleaseReference["status"] {
  const status = asString(record?.status || record?.conclusion || record?.state, 80).toLowerCase();
  if (status === "blocked" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function readinessStatus(hasContext: boolean, references: ReleaseReference[]): ReleaseGovernanceStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  if (references.some((reference) => reference.status === "unavailable")) return "review_required";
  if (references.some((reference) => reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

function event(input: {
  eventType: ReleaseGovernanceCanonicalEvent["eventType"];
  status: ReleaseGovernanceStatus;
  releaseGovernanceId: string;
  summary: string;
}): ReleaseGovernanceCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^release_governance_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "release_governance_profile",
    resourceId: input.releaseGovernanceId,
    summary: input.summary,
  };
}

export function deriveReleaseGovernanceProfile(input: DeriveReleaseGovernanceProfileInput): ReleaseGovernanceProfile {
  const releaseVersion = asString(input.releaseVersion, 160) || DEFAULT_RELEASE_VERSION;
  const releaseGovernanceId =
    releaseGovernanceIdPart(["release_governance", releaseVersion].join(":")) || "release_governance:unknown";

  const releaseArtifacts = asArray(input.releaseArtifacts);
  const deploymentChecks = asArray(input.deploymentChecks);
  const rollbackArtifacts = asArray(input.rollbackArtifacts);
  const qaRecords = asArray(input.qaRecords);
  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const auditEvents = asArray(input.auditEvents);

  const releaseReferences = releaseArtifacts.length
    ? releaseArtifacts.map((artifact) =>
        releaseReference({
          idParts: ["release", referenceId(artifact, ["artifactId", "path", "id"]) || "unknown"],
          referenceType: "release",
          status: statusFromRecord(artifact, ["verified", "complete", "ready_for_review"]),
          label: "Release readiness reference",
          description: "Release governance artifact is available for manual release readiness review.",
          lineageReferences: [referenceId(artifact, ["artifactId", "path", "id"])].filter(Boolean),
          destination: asString(artifact.path, 240) || null,
          blockedReason: artifact.status === "blocked" ? "Release readiness artifact is blocked." : null,
        })
      )
    : [
        releaseReference({
          idParts: ["release", "missing"],
          referenceType: "release",
          status: "unavailable",
          label: "Release readiness reference",
          description: "Release governance artifacts are unavailable.",
        }),
      ];

  const deploymentReferences = deploymentChecks.length
    ? deploymentChecks.map((check) =>
        releaseReference({
          idParts: ["deployment", referenceId(check, ["checkId", "name", "id"]) || "unknown"],
          referenceType: "deployment",
          status: statusFromRecord(check, ["success", "passed", "verified"]),
          label: "Deployment readiness visibility",
          description: "CI/CD readiness metadata is available as visibility only and cannot trigger deployment.",
          lineageReferences: [referenceId(check, ["checkId", "name", "id"])].filter(Boolean),
          blockedReason: statusFromRecord(check, ["success", "passed", "verified"]) === "blocked" ? "Deployment readiness check is blocked." : null,
        })
      )
    : [
        releaseReference({
          idParts: ["deployment", "missing"],
          referenceType: "deployment",
          status: "unavailable",
          label: "Deployment readiness visibility",
          description: "CI/CD readiness metadata is unavailable.",
        }),
      ];

  const rollbackReferences = rollbackArtifacts.length
    ? rollbackArtifacts.map((artifact) =>
        releaseReference({
          idParts: ["rollback", referenceId(artifact, ["artifactId", "path", "id"]) || "unknown"],
          referenceType: "rollback",
          status: statusFromRecord(artifact, ["verified", "complete", "ready_for_review"]),
          label: "Rollback readiness reference",
          description: "Rollback governance artifact is available for manual rollback readiness review.",
          lineageReferences: [referenceId(artifact, ["artifactId", "path", "id"])].filter(Boolean),
          destination: asString(artifact.path, 240) || null,
        })
      )
    : [
        releaseReference({
          idParts: ["rollback", "missing"],
          referenceType: "rollback",
          status: "unavailable",
          label: "Rollback readiness reference",
          description: "Rollback readiness metadata is unavailable.",
        }),
      ];

  const qaReferences = qaRecords.length
    ? qaRecords.map((record) =>
        releaseReference({
          idParts: ["qa", referenceId(record, ["qaId", "checkId", "id"]) || "unknown"],
          referenceType: "qa",
          status: statusFromRecord(record, ["verified", "passed", "success", "complete"]),
          label: "QA verification reference",
          description: "QA verification metadata is available for release governance review.",
          lineageReferences: [referenceId(record, ["qaId", "checkId", "id"])].filter(Boolean),
          blockedReason: statusFromRecord(record, ["verified", "passed", "success", "complete"]) === "blocked" ? "QA verification is blocked." : null,
        })
      )
    : [
        releaseReference({
          idParts: ["qa", "missing"],
          referenceType: "qa",
          status: "unavailable",
          label: "QA verification reference",
          description: "QA verification metadata is unavailable.",
        }),
      ];

  const operationalRiskReferences = operationalRiskProfiles.length
    ? operationalRiskProfiles.map((profile) =>
        releaseReference({
          idParts: ["operational_risk", referenceId(profile, ["operationalRiskId", "id"]) || "unknown"],
          referenceType: "operational_risk",
          status: profile.status === "stable" ? "verified" : profile.status === "blocked" || profile.status === "elevated" ? "blocked" : "partially_verified",
          label: "Operational risk release dependency",
          description: "Operational risk metadata is available for release governance review.",
          lineageReferences: [referenceId(profile, ["operationalRiskId", "id"])].filter(Boolean),
          destination: "/operational-risk",
          blockedReason: profile.status === "blocked" || profile.status === "elevated" ? "Operational risk exposure must be reviewed before release readiness." : null,
        })
      )
    : [
        releaseReference({
          idParts: ["operational_risk", "missing"],
          referenceType: "operational_risk",
          status: "unavailable",
          label: "Operational risk release dependency",
          description: "Operational risk metadata is unavailable.",
          destination: "/operational-risk",
        }),
      ];

  const evidenceReferences = evidencePacks.length
    ? evidencePacks.map((pack) =>
        releaseReference({
          idParts: ["evidence", referenceId(pack, ["evidencePackId", "id"]) || "unknown"],
          referenceType: "evidence",
          status: pack.status === "blocked" ? "blocked" : pack.status === "ready_for_review" ? "verified" : "partially_verified",
          label: "Evidence lineage reference",
          description: "Evidence lineage is available for release governance review.",
          lineageReferences: [referenceId(pack, ["evidencePackId", "id"])].filter(Boolean),
          destination: "/evidence-packs",
          blockedReason: pack.status === "blocked" ? "Evidence lineage is blocked." : null,
        })
      )
    : [
        releaseReference({
          idParts: ["evidence", "missing"],
          referenceType: "evidence",
          status: "unavailable",
          label: "Evidence lineage reference",
          description: "Evidence lineage is unavailable.",
          destination: "/evidence-packs",
        }),
      ];

  const reviewReferences = reviews.length
    ? reviews.map((review) =>
        releaseReference({
          idParts: ["review", referenceId(review, ["reviewSessionId", "id"]) || "unknown"],
          referenceType: "review",
          status: review.status === "completed" ? "verified" : review.status === "blocked" ? "blocked" : "partially_verified",
          label: "Review lineage reference",
          description: "Operator review lineage is available for release governance review.",
          lineageReferences: [referenceId(review, ["reviewSessionId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: review.status === "blocked" ? "Operator review lineage is blocked." : null,
        })
      )
    : [
        releaseReference({
          idParts: ["review", "missing"],
          referenceType: "review",
          status: "unavailable",
          label: "Review lineage reference",
          description: "Operator review lineage is unavailable.",
          destination: "/review-timeline",
        }),
      ];

  const auditReferences = auditEvents.length
    ? auditEvents.slice(0, 20).map((record) =>
        releaseReference({
          idParts: ["audit", referenceId(record, ["eventId", "id"]) || "unknown"],
          referenceType: "audit",
          status: record.redacted ? "partially_verified" : "verified",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is available for release governance review.",
          lineageReferences: [referenceId(record, ["eventId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          redacted: Boolean(record.redacted),
          redactionReason: record.redacted ? "Audit payload is redacted for release governance safety." : null,
        })
      )
    : [
        releaseReference({
          idParts: ["audit", "missing"],
          referenceType: "audit",
          status: "unavailable",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is unavailable.",
          destination: "/review-timeline",
        }),
      ];

  const allReferences = [
    ...releaseReferences,
    ...deploymentReferences,
    ...rollbackReferences,
    ...qaReferences,
    ...operationalRiskReferences,
    ...evidenceReferences,
    ...reviewReferences,
    ...auditReferences,
  ];

  const releaseRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      releaseRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for release governance readiness.`,
        blockedReason: reference.blockedReason,
      })
    );

  const hasContext = Boolean(
    releaseArtifacts.length ||
      deploymentChecks.length ||
      rollbackArtifacts.length ||
      qaRecords.length ||
      operationalRiskProfiles.length ||
      evidencePacks.length ||
      reviews.length ||
      auditEvents.length
  );
  const status = readinessStatus(hasContext, allReferences);
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...releaseRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: ReleaseGovernanceCanonicalEvent[] = [
    event({
      eventType: "release_governance_profile_derived",
      status,
      releaseGovernanceId,
      summary: "Release governance profile derived from release, deployment, rollback, QA, operational risk, evidence, review, and audit metadata.",
    }),
    event({
      eventType: "release_governance_redaction_applied",
      status,
      releaseGovernanceId,
      summary: "Secrets, tokens, credentials, unrestricted infrastructure telemetry, deployment execution, rollback execution, and launch payloads were excluded.",
    }),
  ];
  if (releaseRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "release_governance_restriction_detected",
        status,
        releaseGovernanceId,
        summary: "Release governance restrictions are visible for manual approval review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "release_governance_review_required",
        status,
        releaseGovernanceId,
        summary: "Manual release governance review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "release_governance_blocked",
        status,
        releaseGovernanceId,
        summary: "Release governance readiness is blocked by unresolved readiness restrictions.",
      })
    );
  }

  return {
    releaseGovernanceId,
    releaseVersion,
    status,
    manualApprovalRequired: true,
    autonomousDeploymentEnabled: false,
    autonomousRollbackEnabled: false,
    publicLaunchEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: releaseRestrictions.length,
    },
    releaseReferences,
    deploymentReferences,
    rollbackReferences,
    qaReferences,
    operationalRiskReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    releaseRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
