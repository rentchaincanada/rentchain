import crypto from "crypto";
import { db } from "../firebase";
import type {
  EvidenceClass,
  EvidenceRecord,
  EvidenceRecordStatus,
  EvidenceSensitivityClass,
} from "../types/evidence-record-types";
import { EVIDENCE_RECORD_COLLECTION } from "../types/evidence-record-types";
import type { ExportAuthorizationActorRole } from "../types/export-authorization-types";
import {
  validateExportAuthorizationContext,
  validateExportRequestAuthorization,
} from "../types/export-authorization-types";
import type { ExportPackage } from "../types/export-package-types";
import type {
  ExportDataMinimizationLevel,
  ExportProfile,
} from "../types/export-profile-types";
import type {
  ExportRequest,
  ExportScopeParameters,
} from "../types/export-request-types";
import type { ExportAuditTrailFirestoreLike } from "./export-audit-trail-service";
import { appendAuditEventSafely } from "./export-audit-trail-service";
import {
  createExportPackageEntity,
  validateExportPackage,
  validateExportProfile,
  validateExportRequest,
} from "./export-service";

const DEFAULT_ALLOWED_STATUSES: EvidenceRecordStatus[] = ["active"];
const AUDIT_ALLOWED_STATUSES: EvidenceRecordStatus[] = ["active", "superseded", "archived"];
const BATCH_SIZE = 100;

const SENSITIVE_FIELD_GROUP_PATTERN =
  /applicant|identity|document|provider|payload|report|payment|amount|bank|card|account|message|contact|debug|credential|token|secret|internal/i;

type QuerySnapshotLike<T> = {
  docs?: Array<{
    data: () => T;
  }>;
};

type EvidenceRecordQueryLike<T> = {
  where?: (fieldPath: string, opStr: string, value: unknown) => EvidenceRecordQueryLike<T>;
  orderBy?: (fieldPath: string, directionStr?: "asc" | "desc") => EvidenceRecordQueryLike<T>;
  limit?: (limit: number) => EvidenceRecordQueryLike<T>;
  get: () => Promise<QuerySnapshotLike<T>>;
};

export type EvidenceRecordFirestoreLike = {
  collection: <T = Record<string, unknown>>(name: string) => EvidenceRecordQueryLike<T>;
};

export type ExportAssemblyContext = {
  timestamp: string;
  actorId: string;
  actorRole: ExportAuthorizationActorRole;
  landlordId: string;
  purpose: string;
  allowAuditStatusInclusion?: boolean;
  firestore?: EvidenceRecordFirestoreLike;
  auditTrailFirestore?: ExportAuditTrailFirestoreLike;
  rawIdsIncluded: false;
};

export type ProjectedEvidenceRecord = {
  evidenceSafeReference: string;
  evidenceClass: EvidenceClass;
  evidenceType: string;
  resourceType: EvidenceRecord["resourceType"];
  label: string;
  status: EvidenceRecordStatus;
  createdAt: string;
  sourceObservedAt: string | null;
  sensitivityClass: EvidenceSensitivityClass;
  allowedFieldGroups: string[];
  redactedFieldGroups: string[];
  redactionLevel: ExportDataMinimizationLevel;
  redactionReason: string;
  retentionStatus: {
    legalHoldStatus: EvidenceRecord["retentionMetadata"]["legalHoldStatus"];
    evaluatedAt: string | null;
    rawIdsIncluded: false;
  };
  provenance: {
    sourceCollection: EvidenceRecord["provenanceMetadata"]["source"]["sourceCollection"];
    sourceReferenceKey: string;
    sourceVersion: string | null;
    rawIdsIncluded: false;
    payloadIncluded: false;
  };
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type EvidencePackageManifest = {
  includedCount: number;
  excludedCount: number;
  excludedReasons: Array<{
    evidenceId: string;
    reason: string;
  }>;
  appliedFilters: {
    evidenceClasses: EvidenceClass[];
    dateRangeStart: string | null;
    dateRangeEnd: string | null;
    unitsScopeApplied: string[];
    allowedStatuses: EvidenceRecordStatus[];
    redactionPolicyApplied: ExportDataMinimizationLevel;
    rawIdsIncluded: false;
  };
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type EvidencePackageValidationResult = {
  ok: boolean;
  errors: string[];
};

function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isScopeSubset(request: ExportRequest, profile: ExportProfile): boolean {
  const approved = new Set(profile.approvedEvidenceClasses);
  const requested = request.scopeParameters.evidenceClassFilters || profile.approvedEvidenceClasses;
  if (requested.some((item) => !approved.has(item))) return false;
  const excluded = new Set(profile.excludedUnitIds);
  return !(request.scopeParameters.unitScopeOverride || []).some((item) => excluded.has(item));
}

function redactionLevelFor(request: ExportRequest, profile: ExportProfile): ExportDataMinimizationLevel {
  return request.redactionPolicyOverride?.dataMinimizationLevel || profile.dataMinimizationLevel;
}

function allowedStatusesFor(context: ExportAssemblyContext): EvidenceRecordStatus[] {
  return context.allowAuditStatusInclusion ? AUDIT_ALLOWED_STATUSES : DEFAULT_ALLOWED_STATUSES;
}

function validateAssemblyInputs(
  request: ExportRequest,
  profile: ExportProfile,
  context: ExportAssemblyContext
): void {
  const profileValidation = validateExportProfile(profile);
  if (!profileValidation.ok) throw new Error(profileValidation.errors[0] || "export_profile_invalid");

  const requestValidation = validateExportRequest(request, profile);
  if (!requestValidation.ok) throw new Error(requestValidation.errors[0] || "export_request_invalid");

  const contextValidation = validateExportAuthorizationContext({
    requestingActorId: context.actorId,
    requestingActorRole: context.actorRole,
    requestingActorScope: context.landlordId,
    requestingPurpose: context.purpose,
    timestamp: context.timestamp,
    rawIdsIncluded: false,
  });
  if (!contextValidation.ok) throw new Error(contextValidation.errors[0] || "export_authorization_context_invalid");

  const authorization = validateExportRequestAuthorization(request, profile, {
    requestingActorId: context.actorId,
    requestingActorRole: context.actorRole,
    requestingActorScope: context.landlordId,
    requestingPurpose: context.purpose,
    timestamp: context.timestamp,
    rawIdsIncluded: false,
  });
  if (!authorization.isApproved) throw new Error(authorization.denialReason || "export_request_authorization_denied");

  if (context.landlordId !== profile.landlordId || request.landlordId !== context.landlordId) {
    throw new Error("export_assembly_landlord_scope_mismatch");
  }
  if (!isScopeSubset(request, profile)) throw new Error("export_assembly_scope_must_not_widen_profile");
  if (context.rawIdsIncluded !== false) throw new Error("export_assembly_raw_ids_must_be_false");
}

function recordUnitCandidates(record: EvidenceRecord): string[] {
  return [
    record.safeReference.safeReferenceKey,
    record.provenanceMetadata.source.sourceReferenceKey,
    ...record.sensitivityMetadata.allowedFieldGroups,
  ].filter(Boolean);
}

function matchesUnitScope(record: EvidenceRecord, scope: ExportScopeParameters, profile: ExportProfile): boolean {
  const candidates = recordUnitCandidates(record);
  if (profile.excludedUnitIds.some((unitRef) => candidates.includes(unitRef))) return false;
  const override = scope.unitScopeOverride || [];
  if (!override.length) return true;
  return override.some((unitRef) => candidates.includes(unitRef));
}

function exclusionReason(record: EvidenceRecord, scope: ExportScopeParameters, profile: ExportProfile): string | null {
  const requestedClasses = scope.evidenceClassFilters || profile.approvedEvidenceClasses;
  if (!profile.approvedEvidenceClasses.includes(record.evidenceClass)) return "evidence_class_not_approved";
  if (!requestedClasses.includes(record.evidenceClass)) return "evidence_class_not_requested";
  const start = parseTime(scope.dateRangeStart);
  const end = parseTime(scope.dateRangeEnd);
  const createdAt = parseTime(record.createdAt);
  if (createdAt === null) return "evidence_created_at_invalid";
  if (start !== null && createdAt < start) return "evidence_before_requested_date_range";
  if (end !== null && createdAt > end) return "evidence_after_requested_date_range";
  if (!matchesUnitScope(record, scope, profile)) return "evidence_unit_scope_excluded";
  if (record.retentionMetadata.legalHoldStatus !== "active" && deletionEligible(record)) return "evidence_deletion_eligible";
  return null;
}

function deletionEligible(record: EvidenceRecord): boolean {
  const deletionAt = record.retentionMetadata.eligibleForDeletionAt || record.retentionMetadata.deleteAfter;
  if (!deletionAt) return false;
  const parsed = Date.parse(deletionAt);
  return Number.isFinite(parsed) && parsed <= Date.parse(record.createdAt);
}

function safeEvidenceId(record: EvidenceRecord): string {
  return `evidence:${stableHash([
    record.evidenceId,
    record.safeReference.safeReferenceKey,
    record.evidenceClass,
  ]).slice(0, 20)}`;
}

function redactedFieldsFor(record: EvidenceRecord, level: ExportDataMinimizationLevel): string[] {
  const excluded = record.sensitivityMetadata.excludedFieldGroups;
  if (level === "Full") return uniqueSorted(excluded);
  if (level === "Redacted") {
    return uniqueSorted([
      ...excluded,
      ...record.sensitivityMetadata.allowedFieldGroups.filter((field) => SENSITIVE_FIELD_GROUP_PATTERN.test(field)),
    ]);
  }
  return uniqueSorted([
    ...excluded,
    ...record.sensitivityMetadata.allowedFieldGroups,
    "sensitivity_metadata_details",
    "source_lineage_detail",
  ]);
}

function allowedFieldsFor(record: EvidenceRecord, level: ExportDataMinimizationLevel): string[] {
  if (level === "Full") return uniqueSorted(record.sensitivityMetadata.allowedFieldGroups);
  if (level === "Redacted") {
    return uniqueSorted(record.sensitivityMetadata.allowedFieldGroups.filter((field) => !SENSITIVE_FIELD_GROUP_PATTERN.test(field)));
  }
  return ["status", "timestamp", "safeReference", "redactionCategories"];
}

function exportDb(firestore?: EvidenceRecordFirestoreLike): EvidenceRecordFirestoreLike {
  return firestore || (db as unknown as EvidenceRecordFirestoreLike);
}

function docsToRecords(snapshot: QuerySnapshotLike<EvidenceRecord>): EvidenceRecord[] {
  return (snapshot.docs || []).map((doc) => doc.data()).filter(Boolean);
}

export function filterEvidenceByRetentionStatus(
  records: EvidenceRecord[],
  allowedStatuses: EvidenceRecordStatus[]
): EvidenceRecord[] {
  const allowed = new Set(allowedStatuses);
  return records.filter((record) => allowed.has(record.status));
}

export function filterEvidenceByScope(
  records: EvidenceRecord[],
  scopeParameters: ExportScopeParameters,
  profile: ExportProfile
): EvidenceRecord[] {
  return records.filter((record) => exclusionReason(record, scopeParameters, profile) === null);
}

export function projectEvidenceForExport(
  record: EvidenceRecord,
  redactionLevel: ExportDataMinimizationLevel
): ProjectedEvidenceRecord {
  return {
    evidenceSafeReference: safeEvidenceId(record),
    evidenceClass: record.evidenceClass,
    evidenceType: record.evidenceType,
    resourceType: record.resourceType,
    label: record.safeReference.label,
    status: record.status,
    createdAt: record.createdAt,
    sourceObservedAt: record.provenanceMetadata.source.sourceObservedAt,
    sensitivityClass: record.sensitivityMetadata.sensitivityClass,
    allowedFieldGroups: allowedFieldsFor(record, redactionLevel),
    redactedFieldGroups: redactedFieldsFor(record, redactionLevel),
    redactionLevel,
    redactionReason:
      redactionLevel === "Full"
        ? "Metadata-only export projection excludes raw and payload field groups."
        : `Export projection applies ${redactionLevel} minimization for institutional recipient scope.`,
    retentionStatus: {
      legalHoldStatus: record.retentionMetadata.legalHoldStatus,
      evaluatedAt: record.retentionMetadata.evaluatedAt,
      rawIdsIncluded: false,
    },
    provenance: {
      sourceCollection: record.provenanceMetadata.source.sourceCollection,
      sourceReferenceKey: record.provenanceMetadata.source.sourceReferenceKey,
      sourceVersion: record.provenanceMetadata.source.sourceVersion,
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function generatePackageChecksum(
  records: EvidenceRecord[],
  metadata: Record<string, unknown>
): string {
  return stableHash({
    records: records
      .map((record) => ({
        evidenceId: record.evidenceId,
        evidenceClass: record.evidenceClass,
        status: record.status,
        createdAt: record.createdAt,
        safeReferenceKey: record.safeReference.safeReferenceKey,
      }))
      .sort((a, b) => `${a.evidenceClass}:${a.createdAt}:${a.evidenceId}`.localeCompare(`${b.evidenceClass}:${b.createdAt}:${b.evidenceId}`)),
    metadata,
  });
}

export function validatePackageManifest(
  pkg: ExportPackage,
  collectedRecords: EvidenceRecord[]
): EvidencePackageValidationResult {
  const errors: string[] = [];
  const pkgValidation = validateExportPackage(pkg);
  errors.push(...pkgValidation.errors);
  if (pkg.packageMetadata.includedEvidenceCount !== collectedRecords.length) {
    errors.push("package_manifest_included_count_mismatch");
  }
  const recordClasses = uniqueSorted(collectedRecords.map((record) => record.evidenceClass));
  const manifestClasses = uniqueSorted(pkg.evidenceManifest.evidenceClasses);
  if (collectedRecords.length > 0 && JSON.stringify(recordClasses) !== JSON.stringify(manifestClasses)) {
    errors.push("package_manifest_evidence_classes_mismatch");
  }
  if (pkg.rawIdsIncluded !== false || pkg.payloadIncluded !== false) errors.push("package_manifest_raw_or_payload_included");
  if (!pkg.packageMetadata.checksumValue) errors.push("package_manifest_checksum_missing");
  return { ok: errors.length === 0, errors };
}

export function assembleEvidencePackage(
  request: ExportRequest,
  profile: ExportProfile,
  evidenceRecords: EvidenceRecord[],
  context: ExportAssemblyContext
): ExportPackage {
  validateAssemblyInputs(request, profile, context);
  const allowedStatuses = allowedStatusesFor(context);
  const scoped = filterEvidenceByScope(
    filterEvidenceByRetentionStatus(evidenceRecords, allowedStatuses),
    request.scopeParameters,
    profile
  );
  const projected = scoped.map((record) => projectEvidenceForExport(record, redactionLevelFor(request, profile)));
  const evidenceClasses = uniqueSorted(scoped.map((record) => record.evidenceClass));
  const excludedEvidence = evidenceRecords
    .map((record) => {
      if (!allowedStatuses.includes(record.status)) return { evidenceId: safeEvidenceId(record), reason: "evidence_status_not_allowed" };
      const reason = exclusionReason(record, request.scopeParameters, profile);
      return reason ? { evidenceId: safeEvidenceId(record), reason } : null;
    })
    .filter((item): item is { evidenceId: string; reason: string } => item !== null);
  const manifest: EvidencePackageManifest = {
    includedCount: scoped.length,
    excludedCount: excludedEvidence.length,
    excludedReasons: excludedEvidence,
    appliedFilters: {
      evidenceClasses,
      dateRangeStart: request.scopeParameters.dateRangeStart || null,
      dateRangeEnd: request.scopeParameters.dateRangeEnd || null,
      unitsScopeApplied: request.scopeParameters.unitScopeOverride || [],
      allowedStatuses,
      redactionPolicyApplied: redactionLevelFor(request, profile),
      rawIdsIncluded: false,
    },
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
  const checksum = generatePackageChecksum(scoped, manifest);
  const pkg = createExportPackageEntity({
    request,
    recipientType: profile.recipientType,
    purpose: profile.purpose,
    assembledAt: context.timestamp,
    assembledBy: context.actorId,
    evidenceClasses: evidenceClasses.length ? evidenceClasses : profile.approvedEvidenceClasses.slice(0, 1),
    unitsScopeApplied: request.scopeParameters.unitScopeOverride || [],
    redactionPolicyApplied: redactionLevelFor(request, profile),
    includedEvidenceCount: projected.length,
    totalPackageSize: JSON.stringify(projected).length,
    metadata: {
      builderVersion: "evidence_package_builder_v1",
      manifestIncludedCount: manifest.includedCount,
      manifestExcludedCount: manifest.excludedCount,
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
  });
  const finalized: ExportPackage = {
    ...pkg,
    packageMetadata: {
      ...pkg.packageMetadata,
      checksumValue: checksum,
    },
    evidenceManifest: {
      ...pkg.evidenceManifest,
      evidenceClasses: evidenceClasses.length ? evidenceClasses : profile.approvedEvidenceClasses,
      excludedEvidence,
    },
  };
  const result = validatePackageManifest(finalized, scoped);
  if (!result.ok) throw new Error(result.errors[0] || "evidence_package_manifest_invalid");
  return finalized;
}

export async function materializeEvidenceRecords(
  landlordId: string,
  request: ExportRequest,
  profile: ExportProfile,
  firestore: EvidenceRecordFirestoreLike
): Promise<EvidenceRecord[]> {
  if (landlordId !== request.landlordId || landlordId !== profile.landlordId) {
    throw new Error("evidence_materialization_landlord_scope_mismatch");
  }
  if (!isScopeSubset(request, profile)) throw new Error("evidence_materialization_scope_must_not_widen_profile");
  const requestedClasses = request.scopeParameters.evidenceClassFilters || profile.approvedEvidenceClasses;
  const byId = new Map<string, EvidenceRecord>();
  for (const evidenceClass of requestedClasses) {
    const collection = firestore.collection<EvidenceRecord>(EVIDENCE_RECORD_COLLECTION);
    let query = collection.where?.("landlordId", "==", landlordId);
    query = query?.where?.("evidenceClass", "==", evidenceClass);
    if (request.scopeParameters.dateRangeStart) {
      query = query?.where?.("createdAt", ">=", request.scopeParameters.dateRangeStart);
    }
    if (request.scopeParameters.dateRangeEnd) {
      query = query?.where?.("createdAt", "<=", request.scopeParameters.dateRangeEnd);
    }
    query = query?.orderBy?.("createdAt", "desc");
    query = query?.limit?.(BATCH_SIZE);
    if (!query?.get) throw new Error("evidence_materialization_query_unavailable");
    const records = docsToRecords(await query.get());
    for (const record of records) {
      if (record.landlordId !== landlordId) throw new Error("evidence_materialization_record_landlord_mismatch");
      byId.set(record.evidenceId, record);
    }
  }
  return filterEvidenceByScope(Array.from(byId.values()), request.scopeParameters, profile);
}

export async function buildEvidencePackage(
  request: ExportRequest,
  profile: ExportProfile,
  context: ExportAssemblyContext
): Promise<ExportPackage> {
  validateAssemblyInputs(request, profile, context);
  const records = await materializeEvidenceRecords(context.landlordId, request, profile, exportDb(context.firestore));
  const pkg = assembleEvidencePackage(request, profile, records, context);
  if (context.auditTrailFirestore) {
    await appendAuditEventSafely(
      {
        eventType: "ExportPackageAssembled",
        targetType: "ExportPackage",
        targetId: pkg.exportPackageId,
        landlordId: context.landlordId,
        context: {
          requestingActorId: context.actorId,
          requestingActorRole: context.actorRole,
          requestingActorScope: context.landlordId,
          requestingPurpose: context.purpose,
          timestamp: context.timestamp,
          rawIdsIncluded: false,
        },
        eventSummary: "Export package assembled.",
        statusSummary: "assembled",
        reason: context.purpose,
        details: {
          exportRequestRef: request.exportRequestId,
          evidenceCount: pkg.packageMetadata.includedEvidenceCount,
          checksumReference: pkg.packageMetadata.checksumValue ? `checksum:${pkg.packageMetadata.checksumValue.slice(0, 20)}` : null,
          redactionPolicyApplied: pkg.evidenceManifest.redactionPolicyApplied,
          metadataOnly: true,
        },
        timestamp: pkg.packageMetadata.assembledAt,
      },
      { firestore: context.auditTrailFirestore }
    );
  }
  return pkg;
}
