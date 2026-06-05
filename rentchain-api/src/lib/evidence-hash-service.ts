import { sha256Hex } from "./hash";
import type { EvidenceRecord } from "../types/evidence-record-types";
import type { ExportPackage } from "../types/export-package-types";

const SHA256_HEX = /^[a-f0-9]{64}$/;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function normalizeValue(value: unknown): JsonValue {
  if (value === undefined) return null;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      result[key] = normalizeValue((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return String(value);
}

export function normalizeForHashing(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

export function isSha256Hash(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

function hashNormalized(value: unknown): string {
  const hash = sha256Hex(Buffer.from(normalizeForHashing(value)));
  if (!isSha256Hash(hash)) throw new Error("evidence_hash_invalid_output");
  return hash;
}

export function computeEvidencePackageHash(pkg: ExportPackage): string {
  if (!pkg || typeof pkg !== "object") throw new Error("export_package_required");
  if (!pkg.exportPackageId) throw new Error("export_package_id_required");
  if (!pkg.landlordId) throw new Error("export_package_landlord_required");
  if (pkg.rawIdsIncluded !== false || pkg.payloadIncluded !== false) throw new Error("export_package_hash_flags_invalid");
  return hashNormalized({
    schemaVersion: "export_package_hash_v1",
    exportPackageId: pkg.exportPackageId,
    exportRequestId: pkg.exportRequestId,
    landlordId: pkg.landlordId,
    recipientType: pkg.recipientType,
    purpose: pkg.purpose,
    packageMetadata: {
      assemblyVersion: pkg.packageMetadata.assemblyVersion,
      includedEvidenceCount: pkg.packageMetadata.includedEvidenceCount,
      totalPackageSize: pkg.packageMetadata.totalPackageSize,
      checksumAlgorithm: pkg.packageMetadata.checksumAlgorithm,
      checksumValue: pkg.packageMetadata.checksumValue || null,
    },
    evidenceManifest: {
      evidenceClasses: [...pkg.evidenceManifest.evidenceClasses].sort(),
      dateRangeApplied: pkg.evidenceManifest.dateRangeApplied,
      unitsScopeApplied: [...pkg.evidenceManifest.unitsScopeApplied].sort(),
      redactionPolicyApplied: pkg.evidenceManifest.redactionPolicyApplied,
      excludedEvidence: (pkg.evidenceManifest.excludedEvidence || [])
        .map((item) => ({ evidenceId: item.evidenceId, reason: item.reason }))
        .sort((a, b) => `${a.evidenceId}:${a.reason}`.localeCompare(`${b.evidenceId}:${b.reason}`)),
    },
    status: pkg.status,
    rawIdsIncluded: false,
    payloadIncluded: false,
  });
}

export function computeEvidenceRecordHash(record: EvidenceRecord): string {
  if (!record || typeof record !== "object") throw new Error("evidence_record_required");
  if (!record.landlordId) throw new Error("evidence_record_landlord_required");
  if (record.rawIdsIncluded !== false || record.metadataOnly !== true || record.appendOnly !== true) {
    throw new Error("evidence_record_hash_flags_invalid");
  }
  return hashNormalized({
    schemaVersion: "evidence_record_hash_v1",
    evidenceClass: record.evidenceClass,
    evidenceType: record.evidenceType,
    recordSchemaVersion: record.schemaVersion,
    landlordId: record.landlordId,
    resourceType: record.resourceType,
    safeReference: {
      evidenceClass: record.safeReference.evidenceClass,
      resourceType: record.safeReference.resourceType,
      safeReferenceKey: record.safeReference.safeReferenceKey,
      label: record.safeReference.label,
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
    provenance: {
      authority: record.provenanceMetadata.authority,
      source: {
        sourceCollection: record.provenanceMetadata.source.sourceCollection,
        sourceReferenceKey: record.provenanceMetadata.source.sourceReferenceKey,
        sourceVersion: record.provenanceMetadata.source.sourceVersion,
        rawSourceIdsIncluded: false,
        rawPayloadIncluded: false,
      },
      reason: record.provenanceMetadata.reason,
      provenanceChain: record.provenanceMetadata.provenanceChain.map((item) => ({
        evidenceClass: item.evidenceClass,
        resourceType: item.resourceType,
        safeReferenceKey: item.safeReferenceKey,
        label: item.label,
        rawIdsIncluded: false,
        payloadIncluded: false,
      })),
      metadataOnly: true,
    },
    sensitivityMetadata: record.sensitivityMetadata,
    retention: {
      retentionPolicy: record.retentionMetadata.retentionPolicy,
      retentionReviewRequired: record.retentionMetadata.retentionReviewRequired,
      appliedRetentionPolicyRule: record.retentionMetadata.appliedRetentionPolicyRule,
      legalHoldStatus: record.retentionMetadata.legalHoldStatus,
    },
    status: record.status,
    supersedesEvidenceId: record.supersedesEvidenceId,
    supersededByEvidenceId: record.supersededByEvidenceId,
    immutable: true,
    appendOnly: true,
    metadataOnly: true,
    rawIdsIncluded: false,
  });
}
