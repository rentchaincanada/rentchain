import type { EvidenceClass } from "./evidence-record-types";
import type { ExportDataMinimizationLevel, ExportProfile } from "./export-profile-types";
import type { ExportRedactionPolicyOverride, ExportRequest } from "./export-request-types";
import {
  isExportPurpose,
  isExportRecipientType,
  isPurposeAllowedForRecipient,
} from "./export-recipient-types";

export const EXPORT_AUTHORIZATION_ACTOR_ROLES = [
  "LandlordAdmin",
  "PropertyManager",
  "AdminSupport",
  "SystemService",
] as const;

export type ExportAuthorizationActorRole = (typeof EXPORT_AUTHORIZATION_ACTOR_ROLES)[number];

export const EXPORT_AUTHORIZATION_DECISIONS = [
  "Approved",
  "DeniedInvalidRecipient",
  "DeniedInvalidPurpose",
  "DeniedOutOfScope",
  "DeniedRetentionBlock",
  "DeniedAdminReview",
  "SystemError",
] as const;

export type ExportAuthorizationDecisionCode = (typeof EXPORT_AUTHORIZATION_DECISIONS)[number];

export type ExportAuthorizationContext = {
  requestingActorId: string;
  requestingActorRole: ExportAuthorizationActorRole;
  requestingActorScope: string | null;
  requestingPurpose: string;
  timestamp: string;
  rawIdsIncluded: false;
};

export type ExportAuthorizationDecision = {
  isApproved: boolean;
  decision: ExportAuthorizationDecisionCode;
  denialReason?: string | null;
  decidedAt: string;
  decidedBy: string;
  policyRuleName: string;
  rawIdsIncluded: false;
};

export type ExportValidationResult = {
  ok: boolean;
  errors: string[];
};

const MINIMIZATION_RANK: Record<ExportDataMinimizationLevel, number> = {
  Full: 0,
  Redacted: 1,
  RedactedSensitive: 2,
};

function isSafeReference(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return /^[a-z][a-z0-9_.:-]*:[a-f0-9]{12,64}$/i.test(text) || /^exp_(profile|req|pkg)_v1_[a-f0-9_]+$/i.test(text);
}

function isIsoDate(value: unknown): boolean {
  return typeof value === "string" && value.endsWith("Z") && Number.isFinite(Date.parse(value));
}

function denied(
  decision: ExportAuthorizationDecisionCode,
  reason: string,
  context: ExportAuthorizationContext,
  policyRuleName: string
): ExportAuthorizationDecision {
  return {
    isApproved: false,
    decision,
    denialReason: reason,
    decidedAt: isIsoDate(context.timestamp) ? context.timestamp : new Date(0).toISOString(),
    decidedBy: context.requestingActorId || "actor:unknown",
    policyRuleName,
    rawIdsIncluded: false,
  };
}

export function validateExportAuthorizationContext(context: ExportAuthorizationContext): ExportValidationResult {
  const errors: string[] = [];
  if (!isSafeReference(context.requestingActorId)) errors.push("requesting_actor_id_must_be_safe_reference");
  if (!EXPORT_AUTHORIZATION_ACTOR_ROLES.includes(context.requestingActorRole)) errors.push("requesting_actor_role_invalid");
  if (context.requestingActorRole !== "SystemService" && !isSafeReference(context.requestingActorScope)) {
    errors.push("requesting_actor_scope_required");
  }
  if (!context.requestingPurpose.trim()) errors.push("requesting_purpose_required");
  if (!isIsoDate(context.timestamp)) errors.push("timestamp_must_be_utc_iso");
  if (context.rawIdsIncluded !== false) errors.push("raw_ids_must_be_false");
  return { ok: errors.length === 0, errors };
}

export function validateRedactionPolicyOverride(
  override: ExportRedactionPolicyOverride | null | undefined,
  profile: Pick<ExportProfile, "dataMinimizationLevel">
): ExportValidationResult {
  if (!override) return { ok: true, errors: [] };
  const errors: string[] = [];
  if (!(override.dataMinimizationLevel in MINIMIZATION_RANK)) errors.push("redaction_override_level_invalid");
  if (!override.reason.trim()) errors.push("redaction_override_reason_required");
  if (MINIMIZATION_RANK[override.dataMinimizationLevel] < MINIMIZATION_RANK[profile.dataMinimizationLevel]) {
    errors.push("redaction_override_cannot_loosen_profile");
  }
  return { ok: errors.length === 0, errors };
}

export function validateExportProfileAuthorization(
  profile: ExportProfile,
  context: ExportAuthorizationContext
): ExportAuthorizationDecision {
  const contextResult = validateExportAuthorizationContext(context);
  if (!contextResult.ok) return denied("DeniedAdminReview", contextResult.errors.join(","), context, "export_context_required");
  if (!profile.isActive) return denied("DeniedOutOfScope", "export_profile_inactive", context, "export_profile_active");
  if (!isExportRecipientType(profile.recipientType)) {
    return denied("DeniedInvalidRecipient", "recipient_type_invalid", context, "recipient_type_enum");
  }
  if (!isExportPurpose(profile.purpose)) return denied("DeniedInvalidPurpose", "purpose_invalid", context, "purpose_enum");
  if (!isPurposeAllowedForRecipient(profile.purpose, profile.recipientType)) {
    return denied("DeniedInvalidPurpose", "purpose_not_allowed_for_recipient", context, "purpose_recipient_mapping");
  }
  if (context.requestingActorRole !== "SystemService" && context.requestingActorScope !== profile.landlordId) {
    return denied("DeniedOutOfScope", "landlord_scope_mismatch", context, "landlord_scope_match");
  }
  if (!profile.approvedEvidenceClasses.length) {
    return denied("DeniedOutOfScope", "approved_evidence_classes_required", context, "evidence_class_scope");
  }
  return {
    isApproved: true,
    decision: "Approved",
    denialReason: null,
    decidedAt: context.timestamp,
    decidedBy: context.requestingActorId,
    policyRuleName: "export_profile_authorization_v1",
    rawIdsIncluded: false,
  };
}

export function validateExportRequestAuthorization(
  request: ExportRequest,
  profile: ExportProfile,
  context: ExportAuthorizationContext
): ExportAuthorizationDecision {
  const profileDecision = validateExportProfileAuthorization(profile, context);
  if (!profileDecision.isApproved) return profileDecision;
  if (request.landlordId !== profile.landlordId) {
    return denied("DeniedOutOfScope", "request_profile_landlord_mismatch", context, "request_profile_scope_match");
  }
  if (request.exportProfileId !== profile.exportProfileId) {
    return denied("DeniedOutOfScope", "request_profile_id_mismatch", context, "request_profile_id_match");
  }
  const redaction = validateRedactionPolicyOverride(request.redactionPolicyOverride, profile);
  if (!redaction.ok) return denied("DeniedOutOfScope", redaction.errors.join(","), context, "redaction_override_tightening");
  const requestedClasses = request.scopeParameters.evidenceClassFilters || profile.approvedEvidenceClasses;
  const approved = new Set<EvidenceClass>(profile.approvedEvidenceClasses);
  if (requestedClasses.some((item) => !approved.has(item))) {
    return denied("DeniedOutOfScope", "requested_evidence_class_not_approved", context, "requested_evidence_scope");
  }
  if (
    request.scopeParameters.dateRangeStart &&
    request.scopeParameters.dateRangeEnd &&
    Date.parse(request.scopeParameters.dateRangeStart) > Date.parse(request.scopeParameters.dateRangeEnd)
  ) {
    return denied("DeniedOutOfScope", "date_range_invalid", context, "request_date_scope");
  }
  return {
    isApproved: true,
    decision: "Approved",
    denialReason: null,
    decidedAt: context.timestamp,
    decidedBy: context.requestingActorId,
    policyRuleName: "export_request_authorization_v1",
    rawIdsIncluded: false,
  };
}
