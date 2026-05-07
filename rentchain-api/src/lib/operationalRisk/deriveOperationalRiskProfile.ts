import type {
  DeriveOperationalRiskProfileInput,
  OperationalRiskCanonicalEvent,
  OperationalRiskProfile,
  OperationalRiskReference,
  OperationalRiskScope,
  OperationalRiskSeverity,
  OperationalRiskStatus,
} from "./operationalRiskTypes";
import { operationalRiskIdPart, riskReference } from "./riskRestrictionModels";

const RISK_SCOPES = new Set<OperationalRiskScope>(["property", "lease", "participant", "institution", "workflow", "onboarding", "settlement", "regulatory"]);

const REDACTIONS = [
  "Sensitive tenant identity, screening, credit, payment account, and private document payloads are excluded.",
  "Operational risk references are deterministic metadata, not underwriting, credit, legal, or financial adjudication.",
  "Public risk exposure and autonomous enforcement are not enabled.",
  "Admin-only records and unrestricted audit histories are not included in landlord operational risk views.",
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

function normalizeRiskScope(value: unknown): OperationalRiskScope {
  const raw = asString(value, 80) as OperationalRiskScope;
  return RISK_SCOPES.has(raw) ? raw : "institution";
}

function recordId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function severityRank(severity: OperationalRiskSeverity): number {
  if (severity === "critical") return 4;
  if (severity === "elevated") return 3;
  if (severity === "moderate") return 2;
  return 1;
}

function statusFromReferences(hasContext: boolean, references: OperationalRiskReference[]): OperationalRiskStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked" && reference.severity === "critical")) return "blocked";
  const elevatedCount = references.filter((reference) => reference.status !== "verified" && severityRank(reference.severity) >= 3).length;
  const moderateCount = references.filter((reference) => reference.status !== "verified" && severityRank(reference.severity) >= 2).length;
  if (elevatedCount >= 2 || references.some((reference) => reference.status === "blocked")) return "elevated";
  if (moderateCount > 0 || references.some((reference) => reference.status === "unavailable" || reference.status === "partially_verified")) return "attention_required";
  return "stable";
}

function event(input: {
  eventType: OperationalRiskCanonicalEvent["eventType"];
  status: OperationalRiskStatus;
  operationalRiskId: string;
  summary: string;
}): OperationalRiskCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^operational_risk_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "operational_risk",
    resourceId: input.operationalRiskId,
    summary: input.summary,
  };
}

function readyBlockedStatus(record: Record<string, any>, readyStatuses: string[]): OperationalRiskReference["status"] {
  const status = asString(record?.status, 80);
  if (status === "blocked") return "blocked";
  if (readyStatuses.includes(status)) return "verified";
  if (status === "unknown") return "unavailable";
  return "partially_verified";
}

function severityForStatus(status: OperationalRiskReference["status"], fallback: OperationalRiskSeverity): OperationalRiskSeverity {
  if (status === "blocked") return "critical";
  if (status === "unavailable") return fallback === "critical" ? "elevated" : fallback;
  return fallback;
}

export function deriveOperationalRiskProfile(input: DeriveOperationalRiskProfileInput): OperationalRiskProfile {
  const landlordId = asString(input.landlordId, 240);
  const riskScope = normalizeRiskScope(input.riskScope);
  const operationalRiskId =
    operationalRiskIdPart(["operational_risk", landlordId || "unknown", riskScope].join(":")) || "operational_risk:unknown";

  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const regulatoryProfiles = asArray(input.regulatoryProfiles);
  const onboardingReadiness = asArray(input.institutionOnboardingReadiness);
  const trustRelationships = asArray(input.trustRelationships);
  const automatedWorkflows = asArray(input.automatedWorkflows);
  const delinquencySignals = asArray(input.delinquencySignals);
  const auditEvents = asArray(input.auditEvents);
  const settlementReadiness = input.settlementReadiness || null;

  const evidenceReferences = evidencePacks.length
    ? evidencePacks.map((pack) => {
        const status = readyBlockedStatus(pack, ["ready_for_review"]);
        return riskReference({
          idParts: ["evidence", recordId(pack, ["evidencePackId", "id"]) || "unknown"],
          riskType: "evidence_gap",
          status,
          severity: severityForStatus(status, "moderate"),
          label: "Evidence gap visibility",
          description: "Evidence pack lineage is available for operational risk review.",
          lineageReferences: [recordId(pack, ["evidencePackId", "id"])].filter(Boolean),
          destination: "/evidence-packs",
          blockedReason: status === "blocked" ? "Evidence lineage is blocked." : null,
        });
      })
    : [
        riskReference({
          idParts: ["evidence", "missing"],
          riskType: "evidence_gap",
          status: "unavailable",
          severity: "moderate",
          label: "Evidence gap visibility",
          description: "Evidence pack lineage is unavailable for operational risk review.",
          destination: "/evidence-packs",
        }),
      ];

  const reviewReferences = reviews.length
    ? reviews.map((review) => {
        const status = review.status === "completed" ? "verified" : review.status === "blocked" ? "blocked" : "partially_verified";
        return riskReference({
          idParts: ["review", recordId(review, ["reviewSessionId", "id"]) || "unknown"],
          riskType: "review_gap",
          status,
          severity: severityForStatus(status, "moderate"),
          label: "Review gap visibility",
          description: "Operator review lineage is available for operational risk review.",
          lineageReferences: [recordId(review, ["reviewSessionId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: status === "blocked" ? "Operator review lineage is blocked." : null,
        });
      })
    : [
        riskReference({
          idParts: ["review", "missing"],
          riskType: "review_gap",
          status: "unavailable",
          severity: "moderate",
          label: "Review gap visibility",
          description: "Operator review lineage is unavailable for operational risk review.",
          destination: "/review-timeline",
        }),
      ];

  const settlementReferences = settlementReadiness
    ? [
        riskReference({
          idParts: ["settlement", recordId(settlementReadiness, ["settlementReadinessId", "id"]) || "unknown"],
          riskType: "settlement_inconsistency",
          status: readyBlockedStatus(settlementReadiness, ["ready_for_review"]),
          severity: severityForStatus(readyBlockedStatus(settlementReadiness, ["ready_for_review"]), "elevated"),
          label: "Settlement inconsistency visibility",
          description: "Settlement readiness lineage is available for operational risk review.",
          lineageReferences: [recordId(settlementReadiness, ["settlementReadinessId", "id"])].filter(Boolean),
          destination: "/settlement-readiness",
          blockedReason: settlementReadiness.status === "blocked" ? "Settlement readiness is blocked." : null,
        }),
      ]
    : [
        riskReference({
          idParts: ["settlement", "missing"],
          riskType: "settlement_inconsistency",
          status: "unavailable",
          severity: "elevated",
          label: "Settlement inconsistency visibility",
          description: "Settlement readiness lineage is unavailable for operational risk review.",
          destination: "/settlement-readiness",
        }),
      ];

  const regulatoryReferences = regulatoryProfiles.length
    ? regulatoryProfiles.map((profile) => {
        const status = readyBlockedStatus(profile, ["ready_for_review"]);
        return riskReference({
          idParts: ["regulatory", recordId(profile, ["regulatoryProfileId", "id"]) || "unknown"],
          riskType: "regulatory_restriction",
          status,
          severity: severityForStatus(status, "elevated"),
          label: "Regulatory restriction visibility",
          description: "Regulatory readiness lineage is available for operational risk review.",
          lineageReferences: [recordId(profile, ["regulatoryProfileId", "id"])].filter(Boolean),
          destination: "/regulatory-profiles",
          blockedReason: status === "blocked" ? "Regulatory readiness is blocked." : null,
        });
      })
    : [
        riskReference({
          idParts: ["regulatory", "missing"],
          riskType: "regulatory_restriction",
          status: "unavailable",
          severity: "elevated",
          label: "Regulatory restriction visibility",
          description: "Regulatory readiness lineage is unavailable for operational risk review.",
          destination: "/regulatory-profiles",
        }),
      ];

  const onboardingReferences = onboardingReadiness.length
    ? onboardingReadiness.map((readiness) => {
        const status = readiness.status === "ready_for_review" ? "verified" : readiness.status === "blocked" ? "blocked" : "partially_verified";
        return riskReference({
          idParts: ["onboarding", recordId(readiness, ["onboardingReadinessId", "id"]) || "unknown"],
          riskType: "onboarding_blocker",
          status,
          severity: severityForStatus(status, "elevated"),
          label: "Onboarding blocker visibility",
          description: "Institution onboarding readiness is available for operational risk review.",
          lineageReferences: [recordId(readiness, ["onboardingReadinessId", "id"])].filter(Boolean),
          destination: "/institution-onboarding-readiness",
          blockedReason: status === "blocked" ? "Institution onboarding readiness is blocked." : null,
        });
      })
    : [
        riskReference({
          idParts: ["onboarding", "missing"],
          riskType: "onboarding_blocker",
          status: "unavailable",
          severity: "elevated",
          label: "Onboarding blocker visibility",
          description: "Institution onboarding readiness is unavailable for operational risk review.",
          destination: "/institution-onboarding-readiness",
        }),
      ];

  const trustReferences = trustRelationships.length
    ? trustRelationships.map((trust) => {
        const status = trust.status === "verified" ? "verified" : trust.status === "blocked" ? "blocked" : "partially_verified";
        return riskReference({
          idParts: ["trust", recordId(trust, ["trustRelationshipId", "id"]) || "unknown"],
          riskType: "trust_restriction",
          status,
          severity: severityForStatus(status, "elevated"),
          label: "Trust restriction visibility",
          description: "Cross-organization trust lineage is available for operational risk review.",
          lineageReferences: [recordId(trust, ["trustRelationshipId", "id"])].filter(Boolean),
          destination: "/cross-organization-trust",
          blockedReason: status === "blocked" ? "Cross-organization trust is blocked." : null,
        });
      })
    : [
        riskReference({
          idParts: ["trust", "missing"],
          riskType: "trust_restriction",
          status: "unavailable",
          severity: "elevated",
          label: "Trust restriction visibility",
          description: "Cross-organization trust lineage is unavailable for operational risk review.",
          destination: "/cross-organization-trust",
        }),
      ];

  const workflowReferences = automatedWorkflows.length
    ? automatedWorkflows.map((workflow) => {
        const status = workflow.status === "completed" || workflow.status === "derived" ? "verified" : workflow.status === "blocked" ? "blocked" : "partially_verified";
        return riskReference({
          idParts: ["workflow", recordId(workflow, ["automationId", "decisionId", "id"]) || "unknown"],
          riskType: "workflow_instability",
          status,
          severity: status === "blocked" ? "critical" : workflow.escalationLevel === "critical" ? "elevated" : "moderate",
          label: "Workflow instability visibility",
          description: "Workflow orchestration preview metadata is available for operational risk review.",
          lineageReferences: [recordId(workflow, ["automationId", "decisionId", "id"])].filter(Boolean),
          destination: "/decision-inbox",
          blockedReason: status === "blocked" ? asArray(workflow.blockedReasons).join("; ") || "Workflow preview is blocked." : null,
        });
      })
    : [
        riskReference({
          idParts: ["workflow", "missing"],
          riskType: "workflow_instability",
          status: "unavailable",
          severity: "moderate",
          label: "Workflow instability visibility",
          description: "Workflow orchestration preview metadata is unavailable for operational risk review.",
          destination: "/decision-inbox",
        }),
      ];

  const delinquencyReferences = delinquencySignals.length
    ? delinquencySignals.slice(0, 12).map((signal) =>
        riskReference({
          idParts: ["delinquency", recordId(signal, ["signalId", "id"]) || "unknown"],
          riskType: "delinquency_exposure",
          status: "partially_verified",
          severity: signal.severity === "critical" ? "elevated" : signal.severity === "warning" ? "moderate" : "low",
          label: "Delinquency exposure visibility",
          description: "Delinquency signal metadata is available for operational risk review without enforcement behavior.",
          lineageReferences: [recordId(signal, ["signalId", "leaseId", "id"])].filter(Boolean),
          destination: "/decision-inbox?queue=delinquency_review",
          blockedReason: null,
        })
      )
    : [];

  const auditReferences = auditEvents.length
    ? auditEvents.slice(0, 12).map((record) =>
        riskReference({
          idParts: ["audit", recordId(record, ["eventId", "id"]) || "unknown"],
          riskType: "audit_gap",
          status: record.redacted ? "partially_verified" : "verified",
          severity: record.redacted ? "low" : "low",
          label: "Audit gap visibility",
          description: "Canonical audit event metadata is available for operational risk review.",
          lineageReferences: [recordId(record, ["eventId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          redacted: Boolean(record.redacted),
          redactionReason: record.redacted ? "Audit payload is redacted for operational risk safety." : null,
        })
      )
    : [
        riskReference({
          idParts: ["audit", "missing"],
          riskType: "audit_gap",
          status: "unavailable",
          severity: "moderate",
          label: "Audit gap visibility",
          description: "Canonical audit event lineage is unavailable for operational risk review.",
          destination: "/review-timeline",
        }),
      ];

  const allReferences = [
    ...evidenceReferences,
    ...reviewReferences,
    ...settlementReferences,
    ...regulatoryReferences,
    ...onboardingReferences,
    ...trustReferences,
    ...workflowReferences,
    ...delinquencyReferences,
    ...auditReferences,
  ];
  const hasContext = Boolean(
    landlordId &&
      (evidencePacks.length ||
        reviews.length ||
        settlementReadiness ||
        regulatoryProfiles.length ||
        onboardingReadiness.length ||
        trustRelationships.length ||
        automatedWorkflows.length ||
        delinquencySignals.length ||
        auditEvents.length)
  );
  const status = statusFromReferences(hasContext, allReferences);
  const blockedReasons = allReferences.map((reference) => reference.blockedReason).filter(Boolean) as string[];

  const canonicalEvents: OperationalRiskCanonicalEvent[] = [
    event({
      eventType: "operational_risk_profile_derived",
      status,
      operationalRiskId,
      summary: "Operational risk profile derived from review, evidence, settlement, regulatory, onboarding, trust, workflow, delinquency, and audit metadata.",
    }),
    event({
      eventType: "operational_risk_redaction_applied",
      status,
      operationalRiskId,
      summary: "Sensitive identity, screening, credit, payment, private document, admin-only, and unrestricted audit payloads were excluded.",
    }),
  ];
  if (allReferences.some((reference) => reference.status !== "verified")) {
    canonicalEvents.push(
      event({
        eventType: "operational_risk_restriction_detected",
        status,
        operationalRiskId,
        summary: "Operational risk restrictions are visible for manual review.",
      })
    );
  }
  if (status === "attention_required" || status === "elevated") {
    canonicalEvents.push(
      event({
        eventType: "operational_risk_review_required",
        status,
        operationalRiskId,
        summary: "Manual operational risk review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "operational_risk_blocked",
        status,
        operationalRiskId,
        summary: "Operational risk visibility is blocked by critical readiness or lineage restrictions.",
      })
    );
  }

  return {
    operationalRiskId,
    riskScope,
    status,
    manualReviewRequired: true,
    autonomousRiskActionsEnabled: false,
    publicRiskExposureEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      lowSeverityReferences: allReferences.filter((reference) => reference.severity === "low").length,
      moderateSeverityReferences: allReferences.filter((reference) => reference.severity === "moderate").length,
      elevatedSeverityReferences: allReferences.filter((reference) => reference.severity === "elevated").length,
      criticalSeverityReferences: allReferences.filter((reference) => reference.severity === "critical").length,
    },
    riskReferences: allReferences,
    evidenceReferences,
    reviewReferences,
    settlementReferences,
    regulatoryReferences,
    onboardingReferences,
    trustReferences,
    workflowReferences,
    delinquencyReferences,
    auditReferences,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
