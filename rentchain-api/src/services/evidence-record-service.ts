import crypto from "crypto";
import { db } from "../firebase";
import type {
  CreateEvidenceRecordInput,
  EvidenceActorRole,
  EvidenceAuthorityRole,
  EvidenceCreationAuthorityContext,
  EvidenceProvenanceMetadata,
  EvidenceReference,
  EvidenceRecord,
  EvidenceRecordProjection,
  EvidenceRecordQuery,
  EvidenceProjectionAudience,
  EvidenceRetentionMetadata,
  EvidenceSensitivityMetadata,
} from "../types/evidence-record-types";
import {
  EVIDENCE_CLASSES,
  EVIDENCE_RECORD_COLLECTION,
  EVIDENCE_RECORD_SCHEMA_VERSION,
  EVIDENCE_RECORD_STATUSES,
} from "../types/evidence-record-types";
import {
  generateEvidenceId,
  type EvidenceIdentifierMetadata,
} from "../utils/evidence-identifier";

type SnapshotLike = {
  exists?: boolean;
  id?: string;
  data: () => Record<string, unknown> | undefined;
};

type DocumentRefLike<T> = {
  get?: () => Promise<SnapshotLike>;
  create?: (data: T) => Promise<unknown>;
  set?: (data: T, options?: { merge?: boolean }) => Promise<unknown>;
};

type CollectionLike<T> = {
  doc: (id: string) => DocumentRefLike<T>;
};

export type EvidenceRecordFirestoreLike = {
  collection: <T = Record<string, unknown>>(name: string) => CollectionLike<T>;
};

type EvidenceRecordServiceOptions = {
  firestore?: EvidenceRecordFirestoreLike;
};

type EvidenceValidationResult = {
  valid: boolean;
  reason?: string;
};

const SAFE_REFERENCE_HASH_LENGTH = 20;

const RESTRICTED_CONTENT_PATTERN =
  /token|secret|credential|authorization|cookie|password|bearer|provider payload|raw report|request body|response body|stacktrace|stack trace|gs:\/\/|storage\.googleapis\.com|bank account|card number/i;

const RAW_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

function stableHash(parts: readonly unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, SAFE_REFERENCE_HASH_LENGTH);
}

function cleanPrefix(prefix: string): string {
  return String(prefix || "evidence")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .slice(0, 80) || "evidence";
}

function safeReference(prefix: string, value: unknown): string {
  const normalizedPrefix = cleanPrefix(prefix);
  return `${normalizedPrefix}:${stableHash([normalizedPrefix, String(value ?? "unknown")])}`;
}

function safeLabel(value: unknown, fallback: string): string {
  const label = String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (!label || RESTRICTED_CONTENT_PATTERN.test(label) || RAW_IDENTIFIER_PATTERN.test(label)) return fallback;
  return label;
}

function toUtcIso(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function hasRestrictedContent(value: unknown): boolean {
  return RESTRICTED_CONTENT_PATTERN.test(JSON.stringify(value ?? {}));
}

function isEvidenceActorRole(value: unknown): value is EvidenceActorRole {
  return value === "tenant" || value === "landlord" || value === "admin" || value === "support" || value === "system";
}

function isEvidenceAuthorityRole(value: unknown): value is EvidenceAuthorityRole {
  return isEvidenceActorRole(value);
}

function defaultRetentionMetadata(): EvidenceRetentionMetadata {
  return {
    retentionPolicy: "deferred_phase_4",
    retentionReviewRequired: true,
    archiveAfter: null,
    deleteAfter: null,
  };
}

function evidenceDb(firestore?: EvidenceRecordFirestoreLike): EvidenceRecordFirestoreLike {
  return firestore || (db as unknown as EvidenceRecordFirestoreLike);
}

export function safeEvidenceScopeReference(prefix: "actor" | "landlord" | "tenant" | "source", value: unknown): string {
  return safeReference(prefix, value);
}

export function buildEvidenceSourceReferenceKey(input: {
  sourceCollection: string;
  resourceType: string;
  resourceId: string;
}): string {
  return safeReference(`${input.sourceCollection}:${input.resourceType}`, input.resourceId);
}

export function resolveEvidenceCreationAuthority(input: EvidenceCreationAuthorityContext): {
  actorRole: EvidenceActorRole;
  actorRef: string | null;
  authorityRole: EvidenceAuthorityRole;
  landlordRef: string | null;
  tenantRef: string | null;
  supportAllowed: boolean;
  purpose: string | null;
} {
  if (!isEvidenceActorRole(input.actorRole)) throw new Error("evidence_authority_actor_role_invalid");
  const actorRef = input.actorId ? safeEvidenceScopeReference("actor", `${input.actorRole}:${input.actorId}`) : null;
  return {
    actorRole: input.actorRole,
    actorRef,
    authorityRole: input.actorRole,
    landlordRef: input.landlordId ? safeEvidenceScopeReference("landlord", input.landlordId) : null,
    tenantRef: input.tenantId ? safeEvidenceScopeReference("tenant", input.tenantId) : null,
    supportAllowed: input.supportAllowed === true,
    purpose: input.purpose ? safeLabel(input.purpose, "Evidence creation purpose") : null,
  };
}

export function buildEvidenceProvenanceMetadata(input: {
  authority: EvidenceCreationAuthorityContext;
  sourceCollection: EvidenceProvenanceMetadata["source"]["sourceCollection"];
  resourceType: string;
  resourceId: string;
  reason: string;
  createdAt?: string;
  sourceObservedAt?: string | null;
  sourceVersion?: string | null;
  provenanceChain?: EvidenceReference[];
}): EvidenceProvenanceMetadata {
  const authority = resolveEvidenceCreationAuthority(input.authority);
  return {
    createdAt: toUtcIso(input.createdAt),
    createdBy: {
      actorRole: authority.actorRole,
      actorRef: authority.actorRef,
      rawActorIdsIncluded: false,
    },
    authority: {
      authorityRole: authority.authorityRole,
      landlordRef: authority.landlordRef,
      tenantRef: authority.tenantRef,
      supportAllowed: authority.supportAllowed,
      rawIdsIncluded: false,
    },
    source: {
      sourceCollection: input.sourceCollection,
      sourceReferenceKey: buildEvidenceSourceReferenceKey({
        sourceCollection: input.sourceCollection,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      }),
      sourceObservedAt: input.sourceObservedAt ? toUtcIso(input.sourceObservedAt) : null,
      sourceVersion: input.sourceVersion || null,
      rawSourceIdsIncluded: false,
      rawPayloadIncluded: false,
    },
    reason: safeLabel(input.reason, "Evidence record creation"),
    provenanceChain: input.provenanceChain || [],
    metadataOnly: true,
  };
}

function validateUtcIso(value: string): boolean {
  return Boolean(value && value.endsWith("Z") && Number.isFinite(Date.parse(value)));
}

function validateSensitivityMetadata(metadata: EvidenceSensitivityMetadata): EvidenceValidationResult {
  if (!metadata?.sensitivityClass) return { valid: false, reason: "evidence_sensitivity_class_missing" };
  if (!Array.isArray(metadata.projectionCategories) || metadata.projectionCategories.length === 0) {
    return { valid: false, reason: "evidence_projection_categories_missing" };
  }
  if (metadata.rawIdsIncluded !== false || metadata.payloadIncluded !== false) {
    return { valid: false, reason: "evidence_sensitivity_raw_ids_or_payload_included" };
  }
  if (
    metadata.containsRestrictedProviderData !== false ||
    metadata.containsRawPaymentData !== false ||
    metadata.containsMessageBody !== false ||
    metadata.containsIdentityDocument !== false
  ) {
    return { valid: false, reason: "evidence_sensitive_payload_flag_enabled" };
  }
  if (!Array.isArray(metadata.allowedFieldGroups) || !Array.isArray(metadata.excludedFieldGroups)) {
    return { valid: false, reason: "evidence_field_group_metadata_invalid" };
  }
  if (hasRestrictedContent(metadata.allowedFieldGroups)) {
    return { valid: false, reason: "evidence_allowed_field_groups_restricted_content" };
  }
  return { valid: true };
}

function validateProvenanceMetadata(
  input: CreateEvidenceRecordInput,
  metadata: EvidenceProvenanceMetadata
): EvidenceValidationResult {
  if (!validateUtcIso(metadata.createdAt)) return { valid: false, reason: "evidence_created_at_invalid" };
  if (!isEvidenceActorRole(metadata.createdBy?.actorRole)) return { valid: false, reason: "evidence_actor_role_invalid" };
  if (metadata.createdBy.rawActorIdsIncluded !== false) return { valid: false, reason: "evidence_actor_raw_ids_included" };
  if (!isEvidenceAuthorityRole(metadata.authority?.authorityRole)) return { valid: false, reason: "evidence_authority_role_invalid" };
  if (metadata.authority.rawIdsIncluded !== false) return { valid: false, reason: "evidence_authority_raw_ids_included" };
  if (!metadata.source?.sourceCollection || !metadata.source.sourceReferenceKey) {
    return { valid: false, reason: "evidence_source_reference_missing" };
  }
  if (metadata.source.rawSourceIdsIncluded !== false || metadata.source.rawPayloadIncluded !== false) {
    return { valid: false, reason: "evidence_source_raw_ids_or_payload_included" };
  }
  if (metadata.source.sourceReferenceKey !== buildEvidenceSourceReferenceKey({
    sourceCollection: metadata.source.sourceCollection,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
  })) {
    return { valid: false, reason: "evidence_source_reference_not_deterministic" };
  }
  if (metadata.source.sourceObservedAt && !validateUtcIso(metadata.source.sourceObservedAt)) {
    return { valid: false, reason: "evidence_source_observed_at_invalid" };
  }
  if (!metadata.reason || hasRestrictedContent(metadata.reason)) {
    return { valid: false, reason: "evidence_reason_invalid" };
  }
  if (!Array.isArray(metadata.provenanceChain)) return { valid: false, reason: "evidence_provenance_chain_invalid" };
  if (metadata.provenanceChain.some((ref) => ref.rawIdsIncluded !== false || ref.payloadIncluded !== false)) {
    return { valid: false, reason: "evidence_provenance_chain_raw_ids_or_payload_included" };
  }
  if (metadata.metadataOnly !== true) return { valid: false, reason: "evidence_provenance_not_metadata_only" };
  if (hasRestrictedContent(metadata)) return { valid: false, reason: "evidence_provenance_restricted_content" };
  return { valid: true };
}

function validateAuthorityBoundary(input: CreateEvidenceRecordInput): EvidenceValidationResult {
  const provenance = input.provenanceMetadata;
  const role = provenance.authority.authorityRole;
  const expectedLandlordRef = safeEvidenceScopeReference("landlord", input.landlordId);
  const creationAuthority = input.creationAuthority;

  if (role === "landlord") {
    if (provenance.authority.landlordRef !== expectedLandlordRef) {
      return { valid: false, reason: "evidence_landlord_scope_mismatch" };
    }
  }

  if (role === "tenant") {
    if (!provenance.authority.tenantRef) return { valid: false, reason: "evidence_tenant_scope_missing" };
    if (creationAuthority?.tenantId) {
      const expectedTenantRef = safeEvidenceScopeReference("tenant", creationAuthority.tenantId);
      if (provenance.authority.tenantRef !== expectedTenantRef) {
        return { valid: false, reason: "evidence_tenant_scope_mismatch" };
      }
    }
    if (creationAuthority?.landlordId && creationAuthority.landlordId !== input.landlordId) {
      return { valid: false, reason: "evidence_tenant_landlord_scope_mismatch" };
    }
  }

  if (role === "support") {
    if (provenance.authority.supportAllowed !== true) {
      return { valid: false, reason: "evidence_support_not_allowed" };
    }
    if (!creationAuthority?.purpose) return { valid: false, reason: "evidence_support_purpose_missing" };
  }

  if (role === "admin") {
    if (!creationAuthority?.purpose) return { valid: false, reason: "evidence_admin_purpose_missing" };
  }

  if (creationAuthority) {
    if (creationAuthority.actorRole !== role) return { valid: false, reason: "evidence_authority_context_role_mismatch" };
    if (creationAuthority.landlordId && provenance.authority.landlordRef !== expectedLandlordRef) {
      return { valid: false, reason: "evidence_authority_context_landlord_mismatch" };
    }
  }

  return { valid: true };
}

function validateEvidenceRecordInput(input: CreateEvidenceRecordInput): EvidenceValidationResult {
  if (!EVIDENCE_CLASSES.includes(input.evidenceClass)) return { valid: false, reason: "evidence_class_invalid" };
  if (!input.evidenceType.trim()) return { valid: false, reason: "evidence_type_missing" };
  if (!input.landlordId.trim()) return { valid: false, reason: "evidence_landlord_id_missing" };
  if (!input.resourceId.trim()) return { valid: false, reason: "evidence_resource_id_missing" };
  if (hasRestrictedContent(input.evidenceType) || hasRestrictedContent(input.resourceType)) {
    return { valid: false, reason: "evidence_type_restricted_content" };
  }
  const provenance = validateProvenanceMetadata(input, input.provenanceMetadata);
  if (!provenance.valid) return provenance;
  const sensitivity = validateSensitivityMetadata(input.sensitivityMetadata);
  if (!sensitivity.valid) return sensitivity;
  const authority = validateAuthorityBoundary(input);
  if (!authority.valid) return authority;
  return { valid: true };
}

export class EvidenceRecordService {
  private readonly firestore?: EvidenceRecordFirestoreLike;

  constructor(options: EvidenceRecordServiceOptions = {}) {
    this.firestore = options.firestore;
  }

  /**
   * Future creation contract:
   * - use Firestore create() semantics only
   * - resolve landlord/resource authority server-side before writing
   * - emit metadata-only evidence records with safe identifiers
   * - preserve source records and audit trails without mutation
   */
  async createEvidenceRecord(input: CreateEvidenceRecordInput): Promise<EvidenceRecord> {
    const validation = validateEvidenceRecordInput(input);
    if (!validation.valid) throw new Error(validation.reason || "evidence_record_validation_failed");

    const createdAt = toUtcIso(input.createdAt || input.provenanceMetadata.createdAt);
    const identifierMetadata: EvidenceIdentifierMetadata = {
      evidenceClass: input.evidenceClass,
      landlordRef: safeEvidenceScopeReference("landlord", input.landlordId),
      resourceType: input.resourceType,
      schemaVersion: EVIDENCE_RECORD_SCHEMA_VERSION,
      sourceCollection: input.provenanceMetadata.source.sourceCollection,
      sourceReferenceKey: input.provenanceMetadata.source.sourceReferenceKey,
    };
    const evidenceId = generateEvidenceId(input.evidenceType, input.resourceId, identifierMetadata);
    const safeReference: EvidenceReference = {
      evidenceId,
      evidenceClass: input.evidenceClass,
      resourceType: input.resourceType,
      safeReferenceKey: input.provenanceMetadata.source.sourceReferenceKey,
      label: safeLabel(input.label, `${input.evidenceClass} record`),
      rawIdsIncluded: false,
      payloadIncluded: false,
    };
    const record: EvidenceRecord = {
      evidenceId,
      evidenceClass: input.evidenceClass,
      evidenceType: input.evidenceType,
      schemaVersion: EVIDENCE_RECORD_SCHEMA_VERSION,
      landlordId: input.landlordId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      safeReference,
      provenanceMetadata: input.provenanceMetadata,
      sensitivityMetadata: input.sensitivityMetadata,
      retentionMetadata: input.retentionMetadata || defaultRetentionMetadata(),
      status: "active",
      createdAt,
      supersedesEvidenceId: input.supersedesEvidenceId || null,
      supersededByEvidenceId: null,
      immutable: true,
      appendOnly: true,
      metadataOnly: true,
      rawIdsIncluded: false,
      redactionSummary:
        "Evidence record is metadata-only. Raw actor, tenant, landlord, resource, storage, provider, credential, payment-account, and payload values are excluded from external-facing fields.",
    };

    if (!EVIDENCE_RECORD_STATUSES.includes(record.status)) throw new Error("evidence_record_status_invalid");
    const ref = evidenceDb(this.firestore).collection<EvidenceRecord>(EVIDENCE_RECORD_COLLECTION).doc(record.evidenceId);
    if (ref.create) {
      await ref.create(record);
      return record;
    }
    const existing = ref.get ? await ref.get() : null;
    if (existing?.exists) throw new Error("evidence_record_already_exists");
    if (!ref.set) throw new Error("evidence_record_storage_unavailable");
    await ref.set(record, { merge: false });
    return record;
  }

  /**
   * Future retrieval contract:
   * - require landlord scope for every query
   * - apply explicit projection allowlists by audience
   * - never return raw source IDs, storage paths, provider payloads, or sensitive field dumps
   */
  async getEvidenceRecordById(_input: {
    landlordId: string;
    evidenceId: string;
    audience: EvidenceProjectionAudience;
  }): Promise<EvidenceRecordProjection | null> {
    throw new Error("evidence_record_retrieval_deferred_to_phase_4b");
  }

  /**
   * Future list contract:
   * - query through landlord-scoped indexes only
   * - support resource, status, and evidence-class filters without cross-landlord reads
   * - keep institutional export retrieval behind a future export profile
   */
  async listEvidenceRecords(_query: EvidenceRecordQuery & {
    audience: EvidenceProjectionAudience;
  }): Promise<EvidenceRecordProjection[]> {
    throw new Error("evidence_record_query_deferred_to_phase_4b");
  }

  /**
   * Future projection contract:
   * - tenant-safe, landlord, admin/support, audit-only, and export projections are separate allowlists
   * - no broad field stripping from canonical evidence records
   * - redaction metadata must remain visible with every projected record
   */
  async projectEvidenceRecord(_input: {
    record: EvidenceRecord;
    audience: EvidenceProjectionAudience;
  }): Promise<EvidenceRecordProjection> {
    throw new Error("evidence_record_projection_deferred_to_phase_4b");
  }
}
