import type {
  IdentityDocumentStatus,
  IdentityDocumentType,
  IdentityVerificationStatus,
} from "./identityDocumentTypes";

export const TENANT_GOVERNMENT_ID_UPLOAD_REQUIRED = true as const;

export const TENANT_IDENTITY_REQUIREMENT_STATUSES = [
  "pending",
  "satisfied",
  "exception_pending",
  "exception_approved",
  "not_applicable",
] as const;
export type TenantIdentityRequirementStatus = (typeof TENANT_IDENTITY_REQUIREMENT_STATUSES)[number];

export const TENANT_IDENTITY_EXCEPTION_STATUSES = ["none", "requested", "approved", "rejected"] as const;
export type TenantIdentityExceptionStatus = (typeof TENANT_IDENTITY_EXCEPTION_STATUSES)[number];

export const TENANT_IDENTITY_ENFORCEMENT_GATES = [
  "tenant_portal_onboarding",
  "application_completion",
  "lease_execution_readiness",
  "move_in_readiness",
] as const;
export type TenantIdentityEnforcementGate = (typeof TENANT_IDENTITY_ENFORCEMENT_GATES)[number];

export type TenantGovernmentIdRequirementPolicy = {
  policyId: string;
  policyVersion: string;
  requirement: "required";
  requiredDocumentTypes: readonly IdentityDocumentType[];
  minimumDocuments: number;
  enforcementGates: Readonly<Record<TenantIdentityEnforcementGate, "future_not_enforced">>;
  exceptionAuthority: "separately_governed";
};

export const DEFAULT_TENANT_GOVERNMENT_ID_REQUIREMENT_POLICY: TenantGovernmentIdRequirementPolicy = {
  policyId: "tenant_government_photo_id_required",
  policyVersion: "v1",
  requirement: "required",
  requiredDocumentTypes: [
    "drivers_license",
    "passport",
    "provincial_id",
    "other_government_photo_id",
  ],
  minimumDocuments: 1,
  enforcementGates: {
    tenant_portal_onboarding: "future_not_enforced",
    application_completion: "future_not_enforced",
    lease_execution_readiness: "future_not_enforced",
    move_in_readiness: "future_not_enforced",
  },
  exceptionAuthority: "separately_governed",
};

export type TenantIdentityRequirement = {
  requirementId: string;
  organizationId: string;
  subjectId: string;
  subjectUserId?: string | null;
  applicantParticipantId?: string | null;
  applicationId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  requirement: "required";
  status: TenantIdentityRequirementStatus;
  requiredDocumentTypes: readonly IdentityDocumentType[];
  minimumDocuments: number;
  policyId: string;
  policyVersion: string;
  requiredAt: string;
  satisfiedAt?: string | null;
  satisfyingDocumentIds: string[];
  exceptionStatus: TenantIdentityExceptionStatus;
  exceptionReasonCode?: string | null;
  exceptionAuditEventIds: string[];
  consentEventId?: string | null;
};

export type TenantIdentityRequirementDocument = {
  documentId: string;
  subjectId: string;
  documentType: IdentityDocumentType;
  status: IdentityDocumentStatus;
};

export type TenantIdentityRequirementEvaluation = {
  required: true;
  satisfied: boolean;
  satisfactionSource: "accepted_government_photo_id" | "governed_exception" | null;
  status: TenantIdentityRequirementStatus;
  actionRequired: boolean;
  blockingReason:
    | "government_id_required"
    | "exception_review_pending"
    | "exception_rejected"
    | "requirement_policy_missing"
    | null;
  exceptionStatus: TenantIdentityExceptionStatus;
  satisfyingDocumentIds: string[];
  auditRequired: boolean;
};

export function evaluateTenantIdentityRequirement(input: {
  subjectId: string;
  policy?: TenantGovernmentIdRequirementPolicy | null;
  documents: readonly TenantIdentityRequirementDocument[];
  exceptionStatus?: TenantIdentityExceptionStatus;
}): TenantIdentityRequirementEvaluation {
  const exceptionStatus = input.exceptionStatus ?? "none";
  if (!input.policy) {
    return {
      required: true,
      satisfied: false,
      satisfactionSource: null,
      status: "pending",
      actionRequired: true,
      blockingReason: "requirement_policy_missing",
      exceptionStatus,
      satisfyingDocumentIds: [],
      auditRequired: true,
    };
  }

  if (exceptionStatus === "approved") {
    return {
      required: true,
      satisfied: true,
      satisfactionSource: "governed_exception",
      status: "exception_approved",
      actionRequired: false,
      blockingReason: null,
      exceptionStatus,
      satisfyingDocumentIds: [],
      auditRequired: true,
    };
  }

  const satisfyingDocumentIds = input.documents
    .filter(
      (document) =>
        document.subjectId === input.subjectId &&
        document.status === "ready" &&
        input.policy?.requiredDocumentTypes.includes(document.documentType)
    )
    .map((document) => document.documentId);
  const satisfied = satisfyingDocumentIds.length >= input.policy.minimumDocuments;
  if (satisfied) {
    return {
      required: true,
      satisfied: true,
      satisfactionSource: "accepted_government_photo_id",
      status: "satisfied",
      actionRequired: false,
      blockingReason: null,
      exceptionStatus,
      satisfyingDocumentIds,
      auditRequired: false,
    };
  }

  if (exceptionStatus === "requested") {
    return {
      required: true,
      satisfied: false,
      satisfactionSource: null,
      status: "exception_pending",
      actionRequired: true,
      blockingReason: "exception_review_pending",
      exceptionStatus,
      satisfyingDocumentIds: [],
      auditRequired: true,
    };
  }

  return {
    required: true,
    satisfied: false,
    satisfactionSource: null,
    status: "pending",
    actionRequired: true,
    blockingReason: exceptionStatus === "rejected" ? "exception_rejected" : "government_id_required",
    exceptionStatus,
    satisfyingDocumentIds: [],
    auditRequired: exceptionStatus === "rejected",
  };
}

export type IdentityRequirementContinuityReference = {
  requirementId: string;
  subjectId: string;
  sourceApplicationId?: string | null;
  applicantParticipantId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  status: TenantIdentityRequirementStatus;
  verificationId?: string | null;
  verificationStatus: IdentityVerificationStatus;
};

export type TenantIdentityEnforcementDecision = {
  gate: TenantIdentityEnforcementGate;
  policyConfigured: boolean;
  governmentIdRequirementSatisfied: boolean;
  verificationStatus: IdentityVerificationStatus;
  biometricAuthorizationRequired: false;
  runtimeEnforced: false;
  readiness: "ready_for_future_gate" | "action_required" | "policy_configuration_required";
};

export function evaluateTenantIdentityEnforcementGate(input: {
  gate: TenantIdentityEnforcementGate;
  requirement: TenantIdentityRequirementEvaluation;
  verificationStatus: IdentityVerificationStatus;
}): TenantIdentityEnforcementDecision {
  const policyConfigured = input.requirement.blockingReason !== "requirement_policy_missing";
  return {
    gate: input.gate,
    policyConfigured,
    governmentIdRequirementSatisfied: input.requirement.satisfied,
    verificationStatus: input.verificationStatus,
    biometricAuthorizationRequired: false,
    runtimeEnforced: false,
    readiness: !policyConfigured
      ? "policy_configuration_required"
      : input.requirement.satisfied
        ? "ready_for_future_gate"
        : "action_required",
  };
}
