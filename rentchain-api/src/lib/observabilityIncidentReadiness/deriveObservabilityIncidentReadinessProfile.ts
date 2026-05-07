import type {
  DeriveObservabilityIncidentReadinessProfileInput,
  ObservabilityIncidentCanonicalEvent,
  ObservabilityIncidentReadinessProfile,
  ObservabilityIncidentReadinessStatus,
  ObservabilityIncidentReference,
} from "./observabilityIncidentReadinessTypes";
import {
  observabilityIncidentIdPart,
  observabilityIncidentReference,
  observabilityIncidentRestriction,
} from "./observabilityIncidentRestrictionModels";

const DEFAULT_READINESS_KEY = "operational-observability-incident-readiness-v1";

const REDACTIONS = [
  "Sensitive telemetry payloads, stack traces, request bodies, tenant/payment/screening data, and credentials are excluded.",
  "External monitoring integrations, alert sending, autonomous remediation, and production mutation are not enabled.",
  "Incident readiness is review metadata only; no outage declaration, remediation, recovery, or public-status mutation is executed.",
  "Admin-only source records are projected through deterministic readiness references.",
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

function event(input: {
  eventType: ObservabilityIncidentCanonicalEvent["eventType"];
  status: ObservabilityIncidentReadinessStatus;
  observabilityIncidentReadinessId: string;
  summary: string;
}): ObservabilityIncidentCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^observability_incident_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "observability_incident_readiness_profile",
    resourceId: input.observabilityIncidentReadinessId,
    summary: input.summary,
  };
}

function statusFromReadiness(record: Record<string, any>, verifiedStatuses: string[]): ObservabilityIncidentReference["status"] {
  const status = asString(record?.status || record?.state || record?.conclusion, 80).toLowerCase();
  if (status === "blocked" || status === "critical" || status === "major_outage" || status === "failed" || status === "failure") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "unknown" || status === "missing" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function observabilityEventStatus(record: Record<string, any>): ObservabilityIncidentReference["status"] {
  const status = asString(record?.status, 80).toLowerCase();
  const severity = asString(record?.severity, 80).toLowerCase();
  if (status === "open" && severity === "critical") return "blocked";
  if (status === "open" && severity === "warning") return "partially_verified";
  if (status === "resolved" || record.eventType === "workflow_completed") return "verified";
  return "partially_verified";
}

function incidentStatus(record: Record<string, any>): ObservabilityIncidentReference["status"] {
  const status = asString(record?.status, 80).toLowerCase();
  const severity = asString(record?.severity, 80).toLowerCase();
  if (status === "resolved") return "verified";
  if (severity === "critical" || severity === "major") return "blocked";
  if (status === "investigating" || status === "identified" || status === "monitoring") return "partially_verified";
  return "unavailable";
}

function releaseStatus(record: Record<string, any>): ObservabilityIncidentReference["status"] {
  const status = asString(record?.status, 80).toLowerCase();
  if (status === "blocked") return "blocked";
  if (status === "ready_for_review") return "verified";
  if (status === "unknown" || status === "review_required") return "unavailable";
  return "partially_verified";
}

function publicExposureStatus(record: Record<string, any>): ObservabilityIncidentReference["status"] {
  const status = asString(record?.status, 80).toLowerCase();
  if (status === "blocked") return "blocked";
  if (status === "ready_for_review") return "verified";
  if (status === "unknown" || status === "review_required") return "unavailable";
  return "partially_verified";
}

function readinessStatus(hasContext: boolean, references: ObservabilityIncidentReference[]): ObservabilityIncidentReadinessStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  const missingCritical = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "observability" ||
        reference.referenceType === "incident" ||
        reference.referenceType === "recovery" ||
        reference.referenceType === "escalation" ||
        reference.referenceType === "post_incident_review" ||
        reference.referenceType === "sla" ||
        reference.referenceType === "alert" ||
        reference.referenceType === "audit")
  );
  if (missingCritical) return "review_required";
  if (references.some((reference) => reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

export function deriveObservabilityIncidentReadinessProfile(
  input: DeriveObservabilityIncidentReadinessProfileInput
): ObservabilityIncidentReadinessProfile {
  const readinessKey = asString(input.readinessKey, 160) || DEFAULT_READINESS_KEY;
  const observabilityIncidentReadinessId =
    observabilityIncidentIdPart(["observability_incident_readiness", readinessKey].join(":")) ||
    "observability_incident_readiness:unknown";

  const observabilityEvents = asArray(input.observabilityEvents);
  const statusIncidents = asArray(input.statusIncidents);
  const recoveryReadiness = asArray(input.recoveryReadiness);
  const escalationReadiness = asArray(input.escalationReadiness);
  const postIncidentReviews = asArray(input.postIncidentReviews);
  const slaEvaluations = asArray(input.slaEvaluations);
  const adminAlerts = asArray(input.adminAlerts);
  const releaseGovernanceProfiles = asArray(input.releaseGovernanceProfiles);
  const publicExposureHardeningProfiles = asArray(input.publicExposureHardeningProfiles);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const auditEvents = asArray(input.auditEvents);

  const observabilityReferences = observabilityEvents.length
    ? observabilityEvents.slice(0, 20).map((record) => {
        const status = observabilityEventStatus(record);
        return observabilityIncidentReference({
          idParts: ["observability", recordId(record, ["eventId", "observabilityEventId", "id"]) || "unknown"],
          referenceType: "observability",
          status,
          label: "Observability health reference",
          description: "Internal observability metadata is available for incident readiness review.",
          lineageReferences: [recordId(record, ["eventId", "observabilityEventId", "id"])].filter(Boolean),
          destination: "/admin/observability",
          blockedReason: status === "blocked" ? "Open critical observability event requires incident readiness review." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["observability", "missing"],
          referenceType: "observability",
          status: "unavailable",
          label: "Observability health reference",
          description: "Internal observability metadata is unavailable for incident readiness review.",
          destination: "/admin/observability",
        }),
      ];

  const incidentReferences = statusIncidents.length
    ? statusIncidents.slice(0, 20).map((record) => {
        const status = incidentStatus(record);
        return observabilityIncidentReference({
          idParts: ["incident", recordId(record, ["incidentId", "id"]) || "unknown"],
          referenceType: "incident",
          status,
          label: "Incident visibility reference",
          description: "Incident metadata is available for manual incident readiness review.",
          lineageReferences: [recordId(record, ["incidentId", "id"])].filter(Boolean),
          destination: "/status",
          blockedReason: status === "blocked" ? "Active major or critical incident blocks readiness." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["incident", "none-active"],
          referenceType: "incident",
          status: "verified",
          label: "Incident visibility reference",
          description: "No active incident metadata requires escalation in this readiness snapshot.",
          destination: "/status",
        }),
      ];

  const outageReferences = statusIncidents.filter((record) => ["major", "critical"].includes(asString(record.severity, 80).toLowerCase())).length
    ? statusIncidents
        .filter((record) => ["major", "critical"].includes(asString(record.severity, 80).toLowerCase()))
        .slice(0, 12)
        .map((record) =>
          observabilityIncidentReference({
            idParts: ["outage", recordId(record, ["incidentId", "id"]) || "unknown"],
            referenceType: "outage",
            status: incidentStatus(record),
            label: "Outage lineage reference",
            description: "Outage lineage metadata is available for manual review.",
            lineageReferences: [recordId(record, ["incidentId", "id"])].filter(Boolean),
            destination: "/status",
            blockedReason: incidentStatus(record) === "blocked" ? "Unresolved outage lineage blocks incident readiness." : null,
          })
        )
    : [
        observabilityIncidentReference({
          idParts: ["outage", "none-active"],
          referenceType: "outage",
          status: "verified",
          label: "Outage lineage reference",
          description: "No active major or critical outage lineage is present in this readiness snapshot.",
          destination: "/status",
        }),
      ];

  const recoveryReferences = recoveryReadiness.length
    ? recoveryReadiness.map((record) => {
        const status = statusFromReadiness(record, ["verified", "ready_for_review", "complete", "resolved"]);
        return observabilityIncidentReference({
          idParts: ["recovery", recordId(record, ["recoveryReadinessId", "recoveryId", "id"]) || "unknown"],
          referenceType: "recovery",
          status,
          label: "Recovery readiness reference",
          description: "Recovery readiness metadata is available for manual incident readiness review.",
          lineageReferences: [recordId(record, ["recoveryReadinessId", "recoveryId", "id"])].filter(Boolean),
          destination: "/admin/observability",
          blockedReason: status === "blocked" ? "Recovery readiness is blocked." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["recovery", "baseline"],
          referenceType: "recovery",
          status: "verified",
          label: "Recovery readiness reference",
          description: "Manual recovery review remains the baseline; no autonomous recovery execution is enabled.",
          destination: "/admin/observability",
        }),
      ];

  const escalationReferences = escalationReadiness.length
    ? escalationReadiness.map((record) => {
        const status = statusFromReadiness(record, ["verified", "ready_for_review", "complete"]);
        return observabilityIncidentReference({
          idParts: ["escalation", recordId(record, ["escalationReadinessId", "escalationId", "id"]) || "unknown"],
          referenceType: "escalation",
          status,
          label: "Escalation readiness reference",
          description: "Escalation readiness metadata is available for incident readiness review.",
          lineageReferences: [recordId(record, ["escalationReadinessId", "escalationId", "id"])].filter(Boolean),
          destination: "/admin/alerts",
          blockedReason: status === "blocked" ? "Escalation readiness is blocked." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["escalation", "baseline"],
          referenceType: "escalation",
          status: "verified",
          label: "Escalation readiness reference",
          description: "Manual escalation review remains the baseline; no alert sending or automated escalation is enabled.",
          destination: "/admin/alerts",
        }),
      ];

  const postIncidentReviewReferences = postIncidentReviews.length
    ? postIncidentReviews.map((record) => {
        const status = statusFromReadiness(record, ["verified", "ready_for_review", "complete", "completed"]);
        return observabilityIncidentReference({
          idParts: ["post_incident_review", recordId(record, ["postIncidentReviewId", "reviewId", "id"]) || "unknown"],
          referenceType: "post_incident_review",
          status,
          label: "Post-incident review reference",
          description: "Post-incident review metadata is available for manual readiness review.",
          lineageReferences: [recordId(record, ["postIncidentReviewId", "reviewId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: status === "blocked" ? "Post-incident review is blocked." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["post_incident_review", "baseline"],
          referenceType: "post_incident_review",
          status: "verified",
          label: "Post-incident review reference",
          description: "Post-incident review remains manual and review-controlled.",
          destination: "/review-timeline",
        }),
      ];

  const slaReferences = slaEvaluations.length
    ? slaEvaluations.slice(0, 20).map((record) => {
        const stage = asString(record?.stage || record?.sla?.stage, 80).toLowerCase();
        const status = stage === "escalated" || stage === "overdue" ? "partially_verified" : "verified";
        return observabilityIncidentReference({
          idParts: ["sla", recordId(record, ["slaId", "id", "resourceId"]) || "unknown"],
          referenceType: "sla",
          status,
          label: "SLA readiness reference",
          description: "SLA metadata is available for escalation readiness review.",
          lineageReferences: [recordId(record, ["slaId", "id", "resourceId"])].filter(Boolean),
          destination: "/admin/sla",
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["sla", "missing"],
          referenceType: "sla",
          status: "unavailable",
          label: "SLA readiness reference",
          description: "SLA readiness metadata is unavailable for incident readiness review.",
          destination: "/admin/sla",
        }),
      ];

  const alertReferences = adminAlerts.length
    ? adminAlerts.slice(0, 20).map((record) => {
        const severity = asString(record.severity, 80).toLowerCase();
        const status = severity === "critical" ? "blocked" : severity === "high" ? "partially_verified" : "verified";
        return observabilityIncidentReference({
          idParts: ["alert", recordId(record, ["alertId", "id"]) || "unknown"],
          referenceType: "alert",
          status,
          label: "Alert visibility reference",
          description: "Admin alert metadata is available for incident readiness review without sending alerts.",
          lineageReferences: [recordId(record, ["alertId", "id"])].filter(Boolean),
          destination: "/admin/alerts",
          blockedReason: status === "blocked" ? "Critical admin alert requires manual incident readiness review." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["alert", "baseline"],
          referenceType: "alert",
          status: "verified",
          label: "Alert visibility reference",
          description: "No active admin alert metadata requires incident readiness escalation in this snapshot.",
          destination: "/admin/alerts",
        }),
      ];

  const releaseReferences = releaseGovernanceProfiles.length
    ? releaseGovernanceProfiles.map((record) => {
        const status = releaseStatus(record);
        return observabilityIncidentReference({
          idParts: ["release", recordId(record, ["releaseGovernanceId", "releaseVersion", "id"]) || "unknown"],
          referenceType: "release",
          status,
          label: "Release governance reference",
          description: "Release governance metadata is available for incident readiness review.",
          lineageReferences: [recordId(record, ["releaseGovernanceId", "releaseVersion", "id"])].filter(Boolean),
          destination: "/admin/release-governance",
          blockedReason: status === "blocked" ? "Release governance readiness is blocked." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["release", "missing"],
          referenceType: "release",
          status: "unavailable",
          label: "Release governance reference",
          description: "Release governance metadata is unavailable for incident readiness review.",
          destination: "/admin/release-governance",
        }),
      ];

  const publicExposureReferences = publicExposureHardeningProfiles.length
    ? publicExposureHardeningProfiles.map((record) => {
        const status = publicExposureStatus(record);
        return observabilityIncidentReference({
          idParts: ["public_exposure", recordId(record, ["publicExposureHardeningId", "id"]) || "unknown"],
          referenceType: "public_exposure",
          status,
          label: "Public exposure hardening reference",
          description: "Public exposure hardening metadata is available for incident readiness review.",
          lineageReferences: [recordId(record, ["publicExposureHardeningId", "id"])].filter(Boolean),
          destination: "/admin/public-exposure-hardening",
          blockedReason: status === "blocked" ? "Public exposure hardening readiness is blocked." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["public_exposure", "missing"],
          referenceType: "public_exposure",
          status: "unavailable",
          label: "Public exposure hardening reference",
          description: "Public exposure hardening metadata is unavailable for incident readiness review.",
          destination: "/admin/public-exposure-hardening",
        }),
      ];

  const evidenceReferences = evidencePacks.length
    ? evidencePacks.map((record) => {
        const status = statusFromReadiness(record, ["ready_for_review"]);
        return observabilityIncidentReference({
          idParts: ["evidence", recordId(record, ["evidencePackId", "id"]) || "unknown"],
          referenceType: "evidence",
          status,
          label: "Evidence lineage reference",
          description: "Evidence lineage is available for incident readiness review.",
          lineageReferences: [recordId(record, ["evidencePackId", "id"])].filter(Boolean),
          destination: "/evidence-packs",
          blockedReason: status === "blocked" ? "Evidence lineage is blocked." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["evidence", "missing"],
          referenceType: "evidence",
          status: "unavailable",
          label: "Evidence lineage reference",
          description: "Evidence lineage is unavailable for incident readiness review.",
          destination: "/evidence-packs",
        }),
      ];

  const reviewReferences = reviews.length
    ? reviews.map((record) => {
        const status = record.status === "completed" ? "verified" : record.status === "blocked" ? "blocked" : "partially_verified";
        return observabilityIncidentReference({
          idParts: ["review", recordId(record, ["reviewSessionId", "id"]) || "unknown"],
          referenceType: "review",
          status,
          label: "Review lineage reference",
          description: "Operator review lineage is available for incident readiness review.",
          lineageReferences: [recordId(record, ["reviewSessionId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: status === "blocked" ? "Operator review lineage is blocked." : null,
        });
      })
    : [
        observabilityIncidentReference({
          idParts: ["review", "missing"],
          referenceType: "review",
          status: "unavailable",
          label: "Review lineage reference",
          description: "Operator review lineage is unavailable for incident readiness review.",
          destination: "/review-timeline",
        }),
      ];

  const auditReferences = auditEvents.length
    ? auditEvents.slice(0, 20).map((record) =>
        observabilityIncidentReference({
          idParts: ["audit", recordId(record, ["eventId", "id"]) || "unknown"],
          referenceType: "audit",
          status: record.redacted ? "partially_verified" : "verified",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is available for incident readiness review.",
          lineageReferences: [recordId(record, ["eventId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          redacted: Boolean(record.redacted),
          redactionReason: record.redacted ? "Audit payload is redacted for incident readiness safety." : null,
        })
      )
    : [
        observabilityIncidentReference({
          idParts: ["audit", "missing"],
          referenceType: "audit",
          status: "unavailable",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is unavailable for incident readiness review.",
          destination: "/review-timeline",
        }),
      ];

  const allReferences = [
    ...observabilityReferences,
    ...incidentReferences,
    ...outageReferences,
    ...recoveryReferences,
    ...escalationReferences,
    ...postIncidentReviewReferences,
    ...slaReferences,
    ...alertReferences,
    ...releaseReferences,
    ...publicExposureReferences,
    ...evidenceReferences,
    ...reviewReferences,
    ...auditReferences,
  ];

  const observabilityIncidentRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      observabilityIncidentRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for observability and incident readiness.`,
        blockedReason: reference.blockedReason,
      })
    );

  const hasContext = Boolean(
    observabilityEvents.length ||
      statusIncidents.length ||
      recoveryReadiness.length ||
      escalationReadiness.length ||
      postIncidentReviews.length ||
      slaEvaluations.length ||
      adminAlerts.length ||
      releaseGovernanceProfiles.length ||
      publicExposureHardeningProfiles.length ||
      evidencePacks.length ||
      reviews.length ||
      auditEvents.length
  );
  const status = readinessStatus(hasContext, allReferences);
  const blockedReasons = [
    ...allReferences.map((reference) => reference.blockedReason),
    ...observabilityIncidentRestrictions.map((restriction) => restriction.blockedReason),
  ].filter(Boolean) as string[];

  const canonicalEvents: ObservabilityIncidentCanonicalEvent[] = [
    event({
      eventType: "observability_incident_readiness_profile_derived",
      status,
      observabilityIncidentReadinessId,
      summary:
        "Observability and incident readiness profile derived from observability, incident, outage, recovery, escalation, SLA, alert, release, public exposure, evidence, review, and audit metadata.",
    }),
    event({
      eventType: "observability_incident_redaction_applied",
      status,
      observabilityIncidentReadinessId,
      summary:
        "Sensitive telemetry, stack traces, request bodies, credentials, tenant/payment/screening payloads, external monitoring integration, alert sending, remediation, recovery execution, and production mutation payloads were excluded.",
    }),
  ];
  if (observabilityIncidentRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "observability_incident_restriction_detected",
        status,
        observabilityIncidentReadinessId,
        summary: "Observability and incident readiness restrictions are visible for manual review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "observability_incident_review_required",
        status,
        observabilityIncidentReadinessId,
        summary: "Manual observability and incident readiness review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "observability_incident_blocked",
        status,
        observabilityIncidentReadinessId,
        summary: "Observability and incident readiness is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    observabilityIncidentReadinessId,
    status,
    manualReviewRequired: true,
    externalMonitoringIntegrationEnabled: false,
    autonomousRemediationEnabled: false,
    alertSendingEnabled: false,
    productionMutationEnabled: false,
    sensitiveTelemetryExposed: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: observabilityIncidentRestrictions.length,
    },
    observabilityReferences,
    incidentReferences,
    outageReferences,
    recoveryReferences,
    escalationReferences,
    postIncidentReviewReferences,
    slaReferences,
    alertReferences,
    releaseReferences,
    publicExposureReferences,
    evidenceReferences,
    reviewReferences,
    auditReferences,
    observabilityIncidentRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
