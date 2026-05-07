export type ReleaseGovernanceStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";

export type ReleaseReferenceType = "release" | "deployment" | "rollback" | "qa" | "operational_risk" | "evidence" | "review" | "audit";

export type ReleaseReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ReleaseGovernanceCanonicalEventType =
  | "release_governance_profile_derived"
  | "release_governance_review_required"
  | "release_governance_blocked"
  | "release_governance_restriction_detected"
  | "release_governance_redaction_applied";

export type ReleaseReference = {
  referenceId: string;
  referenceType: ReleaseReferenceType;
  status: ReleaseReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ReleaseRestriction = {
  restrictionId: string;
  restrictionType: ReleaseReferenceType | "public_exposure" | "security";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ReleaseGovernanceCanonicalEvent = {
  eventType: ReleaseGovernanceCanonicalEventType;
  action: string;
  status: ReleaseGovernanceStatus;
  resourceType: "release_governance_profile";
  resourceId: string;
  summary: string;
};

export type ReleaseGovernanceProfile = {
  releaseGovernanceId: string;
  releaseVersion: string;
  status: ReleaseGovernanceStatus;
  manualApprovalRequired: true;
  autonomousDeploymentEnabled: false;
  autonomousRollbackEnabled: false;
  publicLaunchEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  releaseReferences: ReleaseReference[];
  deploymentReferences: ReleaseReference[];
  rollbackReferences: ReleaseReference[];
  qaReferences: ReleaseReference[];
  operationalRiskReferences: ReleaseReference[];
  reviewReferences: ReleaseReference[];
  evidenceReferences: ReleaseReference[];
  auditReferences: ReleaseReference[];
  releaseRestrictions: ReleaseRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: ReleaseGovernanceCanonicalEvent[];
};

export type DeriveReleaseGovernanceProfileInput = {
  releaseVersion?: unknown;
  generatedAt?: unknown;
  releaseArtifacts?: Array<Record<string, any>> | null;
  deploymentChecks?: Array<Record<string, any>> | null;
  rollbackArtifacts?: Array<Record<string, any>> | null;
  qaRecords?: Array<Record<string, any>> | null;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
