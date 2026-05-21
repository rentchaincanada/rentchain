export const EXPORT_INTEGRITY_GOVERNANCE_VERSION = "export_integrity_governance_v1";

export type ExportIntegrityScope =
  | "evidence_pack"
  | "institutional_export"
  | "tenant_trust_export"
  | "review_artifact"
  | "document_export";

export type ExportSignatureStatus = "not_signed" | "signature_ready" | "signed" | "verification_unavailable";

export type ExportVerificationStatus = "metadata_only" | "ready_for_review" | "verified" | "failed" | "unavailable";

export type ExportIntegritySensitivityClass = "sensitive" | "restricted" | "critical";

export type ExportIntegritySourceRef = {
  sourceCollection: string;
  sourceId: string;
  internalReference: true;
};

export type ExportIntegrityMetadata = {
  exportIntegrityVersion: typeof EXPORT_INTEGRITY_GOVERNANCE_VERSION;
  exportProfile: string;
  exportVersion: string;
  exportGeneratedAt: string;
  exportGeneratedBy: string | null;
  integrityScope: ExportIntegrityScope;
  sensitivityClass: ExportIntegritySensitivityClass;
  sourceCollections: string[];
  sourceRefs: ExportIntegritySourceRef[];
  lineageSummary: {
    sourceReferenceCount: number;
    sourceCollections: string[];
    lineagePolicy: string;
  };
  projectionProfile: string | null;
  exportHashPlaceholder: {
    status: "not_computed";
    algorithm: "sha256";
    value: null;
    reason: string;
  };
  signatureStatus: ExportSignatureStatus;
  verificationStatus: ExportVerificationStatus;
  reproducibilityExpectation: "deterministic_projection_inputs_required";
  authorityScoped: true;
  publicVerificationEnabled: false;
  cryptographicSigningEnabled: false;
  blockchainAnchoringEnabled: false;
  tenantVisibleInternalMetadata: false;
  redactionSummary: string;
};

const VALID_SCOPES = new Set<ExportIntegrityScope>([
  "evidence_pack",
  "institutional_export",
  "tenant_trust_export",
  "review_artifact",
  "document_export",
]);

const VALID_SIGNATURE_STATUSES = new Set<ExportSignatureStatus>([
  "not_signed",
  "signature_ready",
  "signed",
  "verification_unavailable",
]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 120).toLowerCase().replace(/[\s.-]+/g, "_");
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const parsed = Date.parse(asString(value, 120));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function normalizeExportIntegrityScope(value: unknown): ExportIntegrityScope {
  const normalized = normalizeKey(value);
  return VALID_SCOPES.has(normalized as ExportIntegrityScope) ? (normalized as ExportIntegrityScope) : "review_artifact";
}

export function normalizeExportLineage(raw: unknown): ExportIntegritySourceRef[] {
  if (!Array.isArray(raw)) return [];
  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const sourceCollection = asString(data.sourceCollection, 120);
      const sourceId = asString(data.sourceId, 240);
      if (!sourceCollection || !sourceId) return null;
      return { sourceCollection, sourceId, internalReference: true };
    })
    .filter(Boolean) as ExportIntegritySourceRef[];
  const byKey = new Map<string, ExportIntegritySourceRef>();
  for (const ref of refs) byKey.set(`${ref.sourceCollection}:${ref.sourceId}`, ref);
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.sourceCollection}:${a.sourceId}`.localeCompare(`${b.sourceCollection}:${b.sourceId}`)
  );
}

export function classifyVerificationReadiness(input: {
  sourceRefs?: ExportIntegritySourceRef[] | null;
  signatureStatus?: ExportSignatureStatus | string | null;
  projectionProfile?: string | null;
}): ExportVerificationStatus {
  const signatureStatus = normalizeKey(input.signatureStatus);
  if (signatureStatus && !VALID_SIGNATURE_STATUSES.has(signatureStatus as ExportSignatureStatus)) return "unavailable";
  if ((input.sourceRefs || []).length > 0 && asString(input.projectionProfile, 120)) return "ready_for_review";
  return "metadata_only";
}

export function buildExportIntegrityMetadata(input: {
  exportProfile: string;
  exportVersion: string;
  exportGeneratedAt?: string | Date | null;
  exportGeneratedBy?: string | null;
  integrityScope: ExportIntegrityScope | string;
  sensitivityClass?: ExportIntegritySensitivityClass | null;
  sourceRefs?: Array<Record<string, unknown>> | null;
  projectionProfile?: string | null;
  signatureStatus?: ExportSignatureStatus | string | null;
}): ExportIntegrityMetadata {
  const sourceRefs = normalizeExportLineage(input.sourceRefs);
  const sourceCollections = uniqueSorted(sourceRefs.map((ref) => ref.sourceCollection));
  const signatureStatus = normalizeKey(input.signatureStatus) as ExportSignatureStatus;
  const normalizedSignatureStatus = VALID_SIGNATURE_STATUSES.has(signatureStatus) ? signatureStatus : "not_signed";
  const projectionProfile = asString(input.projectionProfile, 120) || null;
  const sensitivityClass = input.sensitivityClass || "restricted";

  return {
    exportIntegrityVersion: EXPORT_INTEGRITY_GOVERNANCE_VERSION,
    exportProfile: asString(input.exportProfile, 120) || "export_profile_unknown",
    exportVersion: asString(input.exportVersion, 120) || "export_version_unknown",
    exportGeneratedAt: toIsoDate(input.exportGeneratedAt),
    exportGeneratedBy: asString(input.exportGeneratedBy, 240) || null,
    integrityScope: normalizeExportIntegrityScope(input.integrityScope),
    sensitivityClass,
    sourceCollections,
    sourceRefs,
    lineageSummary: {
      sourceReferenceCount: sourceRefs.length,
      sourceCollections,
      lineagePolicy: "Integrity metadata records deterministic source references without copying raw source payloads.",
    },
    projectionProfile,
    exportHashPlaceholder: {
      status: "not_computed",
      algorithm: "sha256",
      value: null,
      reason: "Hash computation is intentionally deferred until signed/exported artifact workflows are approved.",
    },
    signatureStatus: normalizedSignatureStatus,
    verificationStatus: classifyVerificationReadiness({
      sourceRefs,
      signatureStatus: normalizedSignatureStatus,
      projectionProfile,
    }),
    reproducibilityExpectation: "deterministic_projection_inputs_required",
    authorityScoped: true,
    publicVerificationEnabled: false,
    cryptographicSigningEnabled: false,
    blockchainAnchoringEnabled: false,
    tenantVisibleInternalMetadata: false,
    redactionSummary:
      "Integrity metadata excludes raw provider payloads, raw CSV values, credentials, private message bodies, document contents, and debug payloads.",
  };
}
