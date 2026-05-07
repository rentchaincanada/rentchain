export type ObservabilityIncidentReadinessStatus =
  | "ready_for_review"
  | "partially_ready"
  | "review_required"
  | "blocked"
  | "unknown";

export type ObservabilityIncidentReferenceType =
  | "observability"
  | "incident"
  | "outage"
  | "recovery"
  | "escalation"
  | "post_incident_review"
  | "sla"
  | "alert"
  | "release"
  | "public_exposure"
  | "evidence"
  | "review"
  | "audit";

export type ObservabilityIncidentReferenceStatus =
  | "verified"
  | "partially_verified"
  | "blocked"
  | "unavailable";

export type ObservabilityIncidentCanonicalEventType =
  | "observability_incident_readiness_profile_derived"
  | "observability_incident_review_required"
  | "observability_incident_blocked"
  | "observability_incident_restriction_detected"
  | "observability_incident_redaction_applied";

export type ObservabilityIncidentReference = {
  referenceId: string;
  referenceType: ObservabilityIncidentReferenceType;
  status: ObservabilityIncidentReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ObservabilityIncidentRestriction = {
  restrictionId: string;
  restrictionType: ObservabilityIncidentReferenceType | "external_monitoring" | "autonomous_remediation";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ObservabilityIncidentCanonicalEvent = {
  eventType: ObservabilityIncidentCanonicalEventType;
  action: string;
  status: ObservabilityIncidentReadinessStatus;
  resourceType: "observability_incident_readiness_profile";
  resourceId: string;
  summary: string;
};

export type ObservabilityIncidentReadinessProfile = {
  observabilityIncidentReadinessId: string;
  status: ObservabilityIncidentReadinessStatus;
  manualReviewRequired: true;
  externalMonitoringIntegrationEnabled: false;
  autonomousRemediationEnabled: false;
  alertExecutionEnabled: false;
  alertSendingEnabled: false;
  productionMutationEnabled: false;
  sensitiveTelemetryExposed: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  observabilityReferences: ObservabilityIncidentReference[];
  incidentReferences: ObservabilityIncidentReference[];
  outageReferences: ObservabilityIncidentReference[];
  recoveryReferences: ObservabilityIncidentReference[];
  escalationReferences: ObservabilityIncidentReference[];
  postIncidentReviewReferences: ObservabilityIncidentReference[];
  slaReferences: ObservabilityIncidentReference[];
  alertReferences: ObservabilityIncidentReference[];
  releaseReferences: ObservabilityIncidentReference[];
  publicExposureReferences: ObservabilityIncidentReference[];
  evidenceReferences: ObservabilityIncidentReference[];
  reviewReferences: ObservabilityIncidentReference[];
  auditReferences: ObservabilityIncidentReference[];
  observabilityIncidentRestrictions: ObservabilityIncidentRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: ObservabilityIncidentCanonicalEvent[];
};

export type DeriveObservabilityIncidentReadinessProfileInput = {
  readinessKey?: unknown;
  generatedAt?: unknown;
  observabilityEvents?: Array<Record<string, any>> | null;
  statusIncidents?: Array<Record<string, any>> | null;
  recoveryReadiness?: Array<Record<string, any>> | null;
  escalationReadiness?: Array<Record<string, any>> | null;
  postIncidentReviews?: Array<Record<string, any>> | null;
  slaEvaluations?: Array<Record<string, any>> | null;
  adminAlerts?: Array<Record<string, any>> | null;
  releaseGovernanceProfiles?: Array<Record<string, any>> | null;
  publicExposureHardeningProfiles?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
