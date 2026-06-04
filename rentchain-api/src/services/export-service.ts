import crypto from "crypto";
import type { EvidenceClass } from "../types/evidence-record-types";
import { EVIDENCE_CLASSES } from "../types/evidence-record-types";
import type { ExportAuthorizationContext, ExportValidationResult } from "../types/export-authorization-types";
import {
  validateExportAuthorizationContext,
  validateRedactionPolicyOverride,
} from "../types/export-authorization-types";
import type { ExportPackage } from "../types/export-package-types";
import type {
  ExportDataMinimizationLevel,
  ExportProfile,
  ExportProfileMetadata,
} from "../types/export-profile-types";
import { EXPORT_DATA_MINIMIZATION_LEVELS } from "../types/export-profile-types";
import type { ExportPurpose, ExportRecipientType } from "../types/export-recipient-types";
import {
  isExportPurpose,
  isExportRecipientType,
  isPurposeAllowedForRecipient,
} from "../types/export-recipient-types";
import type {
  ExportRedactionPolicyOverride,
  ExportRequest,
  ExportScopeParameters,
} from "../types/export-request-types";
import { EVIDENCE_RETENTION_POLICY_VERSION } from "./evidence-retention-policy-registry";

const RESTRICTED_EXPORT_CONTENT =
  /token|secret|credential|password|bearer|provider payload|raw report|request body|response body|gs:\/\/|storage\.googleapis\.com|bank account|card number/i;

function stableHash(parts: readonly unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 20);
}

function normalizeSafeLabel(value: unknown, max = 240): string {
  return String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeReference(prefix: string, value: unknown): string {
  return `${prefix}:${stableHash([prefix, value])}`;
}

function validation(errors: string[]): ExportValidationResult {
  return { ok: errors.length === 0, errors };
}

function isUtcIso(value: unknown): boolean {
  return typeof value === "string" && value.endsWith("Z") && Number.isFinite(Date.parse(value));
}

function hasRestrictedContent(value: unknown): boolean {
  return RESTRICTED_EXPORT_CONTENT.test(JSON.stringify(value ?? {}));
}

function isSafeRef(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return /^[a-z][a-z0-9_.:-]*:[a-f0-9]{12,64}$/i.test(text) || /^exp_(profile|req|pkg)_v1_[a-f0-9_]+$/i.test(text);
}

function evidenceClassesValid(values: EvidenceClass[]): boolean {
  return values.length > 0 && values.every((item) => EVIDENCE_CLASSES.includes(item));
}

function minimizationValid(value: unknown): value is ExportDataMinimizationLevel {
  return EXPORT_DATA_MINIMIZATION_LEVELS.includes(value as ExportDataMinimizationLevel);
}

export function generateExportProfileId(
  landlordId: string,
  recipientReference: string,
  purpose: ExportPurpose
): string {
  return `exp_profile_v1_${stableHash([landlordId])}_${stableHash([recipientReference])}_${stableHash([purpose])}`;
}

export function generateExportRequestId(profileId: string, timestamp: string, landlordId: string): string {
  return `exp_req_v1_${stableHash([profileId])}_${stableHash([timestamp])}_${stableHash([landlordId])}`;
}

export function generateExportPackageId(requestId: string, assemblyTimestamp: string): string {
  return `exp_pkg_v1_${stableHash([requestId])}_${stableHash([assemblyTimestamp])}`;
}

export type CreateExportProfileInput = {
  landlordId: string;
  recipientType: ExportRecipientType;
  recipientName: string;
  recipientReference: string;
  purpose: ExportPurpose;
  description: string;
  approvedEvidenceClasses: EvidenceClass[];
  excludedUnitIds?: string[];
  dataMinimizationLevel: ExportDataMinimizationLevel;
  createdReason: string;
  metadata?: ExportProfileMetadata;
};

export type CreateExportRequestInput = {
  profile: ExportProfile;
  requestedAt: string;
  requestedBy: string;
  requestReason: string;
  scopeParameters: ExportScopeParameters;
  redactionPolicyOverride?: ExportRedactionPolicyOverride | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type CreateExportPackageInput = {
  request: ExportRequest;
  recipientType: ExportRecipientType;
  purpose: ExportPurpose;
  assembledAt: string;
  assembledBy: string;
  evidenceClasses: EvidenceClass[];
  unitsScopeApplied?: string[];
  redactionPolicyApplied: ExportDataMinimizationLevel;
  includedEvidenceCount: number;
  totalPackageSize?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export function validateExportProfile(profile: ExportProfile): ExportValidationResult {
  const errors: string[] = [];
  if (!/^exp_profile_v1_[a-f0-9_]+$/.test(profile.exportProfileId)) errors.push("export_profile_id_invalid");
  if (!isSafeRef(profile.landlordId)) errors.push("landlord_id_must_be_safe_reference");
  if (!isExportRecipientType(profile.recipientType)) errors.push("recipient_type_invalid");
  if (!profile.recipientName || hasRestrictedContent(profile.recipientName)) errors.push("recipient_name_invalid");
  if (!isSafeRef(profile.recipientSafeReference)) errors.push("recipient_reference_invalid");
  if (!isExportPurpose(profile.purpose)) errors.push("purpose_invalid");
  if (isExportPurpose(profile.purpose) && isExportRecipientType(profile.recipientType) && !isPurposeAllowedForRecipient(profile.purpose, profile.recipientType)) {
    errors.push("purpose_not_allowed_for_recipient");
  }
  if (!profile.description || profile.description.length > 500 || hasRestrictedContent(profile.description)) errors.push("description_invalid");
  if (!evidenceClassesValid(profile.approvedEvidenceClasses)) errors.push("approved_evidence_classes_invalid");
  if (profile.excludedUnitIds.some((item) => !isSafeRef(item))) errors.push("excluded_unit_ids_must_be_safe_references");
  if (!minimizationValid(profile.dataMinimizationLevel)) errors.push("data_minimization_level_invalid");
  if (profile.retentionPolicyVersion !== EVIDENCE_RETENTION_POLICY_VERSION) errors.push("retention_policy_version_invalid");
  if (!isUtcIso(profile.createdAt)) errors.push("created_at_invalid");
  if (!isSafeRef(profile.createdBy.actorRef)) errors.push("created_by_actor_ref_invalid");
  if (!profile.createdReason || hasRestrictedContent(profile.createdReason)) errors.push("created_reason_invalid");
  if (!isSafeRef(profile.auditTrailReference)) errors.push("audit_trail_reference_invalid");
  if (profile.rawIdsIncluded !== false || profile.payloadIncluded !== false) errors.push("raw_or_payload_flags_invalid");
  return validation(errors);
}

export function validateExportRequest(request: ExportRequest, profile: ExportProfile): ExportValidationResult {
  const errors: string[] = [];
  if (!/^exp_req_v1_[a-f0-9_]+$/.test(request.exportRequestId)) errors.push("export_request_id_invalid");
  if (request.exportProfileId !== profile.exportProfileId) errors.push("export_profile_id_mismatch");
  if (request.landlordId !== profile.landlordId) errors.push("landlord_id_mismatch");
  if (!isUtcIso(request.requestedAt)) errors.push("requested_at_invalid");
  if (!isSafeRef(request.requestedBy)) errors.push("requested_by_invalid");
  if (!request.requestReason || hasRestrictedContent(request.requestReason)) errors.push("request_reason_invalid");
  if (
    request.scopeParameters.dateRangeStart &&
    request.scopeParameters.dateRangeEnd &&
    Date.parse(request.scopeParameters.dateRangeStart) > Date.parse(request.scopeParameters.dateRangeEnd)
  ) {
    errors.push("scope_date_range_invalid");
  }
  if (request.scopeParameters.evidenceClassFilters && !evidenceClassesValid(request.scopeParameters.evidenceClassFilters)) {
    errors.push("scope_evidence_class_filters_invalid");
  }
  if (request.scopeParameters.unitScopeOverride?.some((item) => !isSafeRef(item))) errors.push("unit_scope_override_invalid");
  const redaction = validateRedactionPolicyOverride(request.redactionPolicyOverride, profile);
  errors.push(...redaction.errors);
  if (!isSafeRef(request.auditTrailReference)) errors.push("audit_trail_reference_invalid");
  if (request.rawIdsIncluded !== false || request.payloadIncluded !== false) errors.push("raw_or_payload_flags_invalid");
  return validation(errors);
}

export function validateExportPackage(pkg: ExportPackage): ExportValidationResult {
  const errors: string[] = [];
  if (!/^exp_pkg_v1_[a-f0-9_]+$/.test(pkg.exportPackageId)) errors.push("export_package_id_invalid");
  if (!/^exp_req_v1_[a-f0-9_]+$/.test(pkg.exportRequestId)) errors.push("export_request_id_invalid");
  if (!isSafeRef(pkg.landlordId)) errors.push("landlord_id_must_be_safe_reference");
  if (!isExportRecipientType(pkg.recipientType)) errors.push("recipient_type_invalid");
  if (!isExportPurpose(pkg.purpose)) errors.push("purpose_invalid");
  if (!isUtcIso(pkg.packageMetadata.assembledAt)) errors.push("assembled_at_invalid");
  if (!isSafeRef(pkg.packageMetadata.assembledBy)) errors.push("assembled_by_invalid");
  if (pkg.packageMetadata.includedEvidenceCount < 0) errors.push("included_evidence_count_invalid");
  if (pkg.packageMetadata.totalPackageSize < 0) errors.push("total_package_size_invalid");
  if (pkg.packageMetadata.checksumAlgorithm !== "sha256") errors.push("checksum_algorithm_invalid");
  if (!evidenceClassesValid(pkg.evidenceManifest.evidenceClasses)) errors.push("manifest_evidence_classes_invalid");
  if (pkg.evidenceManifest.unitsScopeApplied.some((item) => !isSafeRef(item))) errors.push("units_scope_invalid");
  if (!minimizationValid(pkg.evidenceManifest.redactionPolicyApplied)) errors.push("redaction_policy_invalid");
  if (!isSafeRef(pkg.auditTrailReference)) errors.push("audit_trail_reference_invalid");
  if (pkg.rawIdsIncluded !== false || pkg.payloadIncluded !== false) errors.push("raw_or_payload_flags_invalid");
  return validation(errors);
}

export function createExportProfileEntity(input: CreateExportProfileInput, context: ExportAuthorizationContext): ExportProfile {
  const contextResult = validateExportAuthorizationContext(context);
  if (!contextResult.ok) throw new Error(contextResult.errors[0] || "export_authorization_context_invalid");
  const recipientName = normalizeSafeLabel(input.recipientName, 160);
  const description = normalizeSafeLabel(input.description, 500);
  const recipientSafeReference = safeReference("export_recipient", input.recipientReference);
  const profile: ExportProfile = {
    exportProfileId: generateExportProfileId(input.landlordId, recipientSafeReference, input.purpose),
    landlordId: input.landlordId,
    recipientType: input.recipientType,
    recipientName,
    recipientSafeReference,
    purpose: input.purpose,
    description,
    approvedEvidenceClasses: [...input.approvedEvidenceClasses],
    excludedUnitIds: input.excludedUnitIds || [],
    dataMinimizationLevel: input.dataMinimizationLevel,
    retentionPolicyVersion: EVIDENCE_RETENTION_POLICY_VERSION,
    createdAt: context.timestamp,
    createdBy: {
      actorRef: context.requestingActorId,
      actorRole: context.requestingActorRole,
      rawIdsIncluded: false,
    },
    createdReason: normalizeSafeLabel(input.createdReason, 240),
    isActive: true,
    auditTrailReference: safeReference("export_audit", [input.landlordId, recipientSafeReference, input.purpose, context.timestamp]),
    metadata: input.metadata || {},
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
  const result = validateExportProfile(profile);
  if (!result.ok) throw new Error(result.errors[0] || "export_profile_invalid");
  return profile;
}

export function createExportRequestEntity(input: CreateExportRequestInput, context: ExportAuthorizationContext): ExportRequest {
  const contextResult = validateExportAuthorizationContext(context);
  if (!contextResult.ok) throw new Error(contextResult.errors[0] || "export_authorization_context_invalid");
  const request: ExportRequest = {
    exportRequestId: generateExportRequestId(input.profile.exportProfileId, input.requestedAt, input.profile.landlordId),
    exportProfileId: input.profile.exportProfileId,
    landlordId: input.profile.landlordId,
    requestedAt: input.requestedAt,
    requestedBy: input.requestedBy,
    requestReason: normalizeSafeLabel(input.requestReason, 240),
    scopeParameters: input.scopeParameters,
    redactionPolicyOverride: input.redactionPolicyOverride || null,
    status: "Pending",
    authorizationStatus: {
      isAuthorized: false,
      rawIdsIncluded: false,
    },
    auditTrailReference: safeReference("export_audit", [input.profile.exportProfileId, input.requestedAt, input.requestedBy]),
    metadata: input.metadata || {},
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
  const result = validateExportRequest(request, input.profile);
  if (!result.ok) throw new Error(result.errors[0] || "export_request_invalid");
  return request;
}

export function createExportPackageEntity(input: CreateExportPackageInput): ExportPackage {
  const pkg: ExportPackage = {
    exportPackageId: generateExportPackageId(input.request.exportRequestId, input.assembledAt),
    exportRequestId: input.request.exportRequestId,
    landlordId: input.request.landlordId,
    recipientType: input.recipientType,
    purpose: input.purpose,
    packageMetadata: {
      assembledAt: input.assembledAt,
      assembledBy: input.assembledBy,
      assemblyVersion: "export_package_builder_schema_v1",
      includedEvidenceCount: Math.max(0, Math.floor(input.includedEvidenceCount)),
      totalPackageSize: Math.max(0, Math.floor(input.totalPackageSize || 0)),
      checksumAlgorithm: "sha256",
      checksumValue: null,
    },
    evidenceManifest: {
      evidenceClasses: [...input.evidenceClasses],
      dateRangeApplied: {
        start: input.request.scopeParameters.dateRangeStart || null,
        end: input.request.scopeParameters.dateRangeEnd || null,
      },
      unitsScopeApplied: input.unitsScopeApplied || [],
      redactionPolicyApplied: input.redactionPolicyApplied,
      excludedEvidence: [],
    },
    signatureMetadata: {
      isSigned: false,
    },
    deliveryMetadata: null,
    status: "Assembled",
    auditTrailReference: safeReference("export_audit", [input.request.exportRequestId, input.assembledAt]),
    metadata: input.metadata || {},
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
  const result = validateExportPackage(pkg);
  if (!result.ok) throw new Error(result.errors[0] || "export_package_invalid");
  return pkg;
}
