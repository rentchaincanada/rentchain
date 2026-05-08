import { redactIdentifier } from "../governance/platformGovernance";
import type {
  DerivePortableAttestationSummaryInput,
  PortableAttestation,
  PortableAttestationExportSummary,
  PortableAttestationLifecycleState,
  PortableAttestationStatus,
  PortableAttestationSummary,
  PortableAttestationSupportSummary,
} from "./portableAttestationTypes";

const REDACTIONS = [
  "Raw identity, screening, payment, title, registry, and provider payloads are excluded.",
  "Internal governance notes and support-console metadata are excluded.",
  "Provider and evidence references are not portable by default.",
  "Portable summaries require claim-level consent and do not create public trust profiles.",
  "Property authority metadata is not a legal ownership conclusion.",
];

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function nowIso(value: unknown): string {
  const raw = asString(value, 80);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function timestampAtOrBefore(value: string | null, generatedAt: string) {
  if (!value) return false;
  const candidate = Date.parse(value);
  const now = Date.parse(generatedAt);
  return Number.isFinite(candidate) && Number.isFinite(now) && candidate <= now;
}

function hasActiveConsent(attestation: PortableAttestation, generatedAt: string) {
  const consent = attestation.consentScope;
  return Boolean(
    consent.consentId &&
      consent.grantedAt &&
      !consent.revokedAt &&
      !timestampAtOrBefore(consent.expiresAt, generatedAt) &&
      consent.audience === attestation.audience &&
      consent.claimCategories.includes(attestation.claimCategory)
  );
}

function hasUnsafePayload(attestation: PortableAttestation) {
  return (
    attestation.metadataOnly !== true ||
    attestation.rawSensitivePayloadStored !== false ||
    attestation.rawProviderPayloadIncluded !== false ||
    attestation.supportMetadataIncluded !== false ||
    attestation.evidenceSummary.rawEvidenceIncluded !== false ||
    attestation.publicAccessEnabled !== false ||
    attestation.externalSubmissionEnabled !== false ||
    attestation.unsupportedClaim !== false
  );
}

function baseStatus(attestation: PortableAttestation, generatedAt: string): PortableAttestationStatus {
  if (hasUnsafePayload(attestation)) return "blocked";
  if (attestation.status === "blocked") return "blocked";
  if (attestation.revokedAt || attestation.status === "revoked" || attestation.consentScope.revokedAt) return "revoked";
  if (attestation.status === "superseded" || attestation.supersededAt) return "superseded";
  if (
    attestation.status === "expired" ||
    timestampAtOrBefore(attestation.expiresAt, generatedAt) ||
    timestampAtOrBefore(attestation.consentScope.expiresAt, generatedAt)
  ) {
    return "expired";
  }
  if (!hasActiveConsent(attestation, generatedAt)) return "pending_consent";
  if (timestampAtOrBefore(attestation.nextReverificationAt, generatedAt)) return "reverification_required";
  return attestation.status === "active" ? "active" : attestation.status;
}

function lifecycleFromStatus(status: PortableAttestationStatus): PortableAttestationLifecycleState {
  if (status === "blocked") return "blocked";
  if (status === "pending_consent") return "consent_required";
  if (status === "revoked") return "revoked";
  if (status === "superseded") return "superseded";
  if (status === "expired") return "expired";
  if (status === "reverification_required") return "reverification_required";
  return "export_ready";
}

function isExportReady(status: PortableAttestationStatus) {
  return status === "active" || status === "reverification_required";
}

function toExportSummary(
  attestation: PortableAttestation,
  status: PortableAttestationStatus
): PortableAttestationExportSummary | null {
  if (!isExportReady(status)) return null;
  const consentId = attestation.consentScope.consentId;
  const grantedAt = attestation.consentScope.grantedAt;
  if (!consentId || !grantedAt) return null;

  return {
    attestationId: attestation.attestationId,
    schemaVersion: "portable_attestation.v1",
    attestationType: attestation.attestationType,
    subjectType: attestation.subjectType,
    subjectId: attestation.subjectId,
    claimCategory: attestation.claimCategory,
    claimLabel: attestation.claimLabel,
    claimDescription: attestation.claimDescription,
    status,
    lifecycleState: lifecycleFromStatus(status),
    issuerCategory: attestation.issuerCategory,
    audience: attestation.audience,
    permittedPurpose: attestation.consentScope.purpose,
    consentReferenceId: consentId,
    consentGrantedAt: grantedAt,
    consentExpiresAt: attestation.consentScope.expiresAt,
    retentionClass: attestation.retentionClass,
    evidenceCategory: attestation.evidenceSummary.evidenceCategory,
    sourceSystem: attestation.evidenceSummary.sourceSystem,
    sourceCategory: attestation.evidenceSummary.sourceCategory,
    confidence: attestation.confidence,
    issuedAt: attestation.issuedAt,
    effectiveAt: attestation.effectiveAt,
    expiresAt: attestation.expiresAt,
    revokedAt: attestation.revokedAt,
    supersededAt: attestation.supersededAt,
    nextReverificationAt: attestation.nextReverificationAt,
    jurisdiction: attestation.jurisdiction,
    redactionProfile: attestation.redactionProfile,
    metadataOnly: true,
    rawEvidenceIncluded: false,
    rawProviderPayloadIncluded: false,
    supportMetadataIncluded: false,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
    nonAuthorityDisclaimers: attestation.nonAuthorityDisclaimers,
  };
}

function toSupportSummary(
  attestation: PortableAttestation,
  status: PortableAttestationStatus
): PortableAttestationSupportSummary | null {
  if (!attestation.supportVisible) return null;
  return {
    attestationId: attestation.attestationId,
    attestationType: attestation.attestationType,
    claimCategory: attestation.claimCategory,
    status,
    lifecycleState: lifecycleFromStatus(status),
    audience: attestation.audience,
    consentIdRedacted: redactIdentifier(attestation.consentScope.consentId),
    internalReferenceRedacted: redactIdentifier(attestation.internalReferenceId),
    providerReferenceRedacted: redactIdentifier(attestation.providerReferenceId),
    sourceSystem: attestation.sourceReference.sourceSystem,
    sourceIdRedacted: redactIdentifier(attestation.sourceReference.sourceId),
    retentionClass: attestation.retentionClass,
    expiresAt: attestation.expiresAt,
    revokedAt: attestation.revokedAt,
    nextReverificationAt: attestation.nextReverificationAt,
    rawProviderPayloadVisible: false,
    rawEvidenceVisible: false,
    supportMetadataPortable: false,
  };
}

function blockedReason(attestation: PortableAttestation, status: PortableAttestationStatus, generatedAt: string) {
  if (hasUnsafePayload(attestation)) {
    return `${attestation.attestationId}: portable attestation blocked by metadata-only/privacy guardrails.`;
  }
  if (!hasActiveConsent(attestation, generatedAt)) {
    return `${attestation.attestationId}: active claim-level consent is required before portability.`;
  }
  if (status === "expired") return `${attestation.attestationId}: attestation is expired.`;
  if (status === "revoked") return `${attestation.attestationId}: attestation is revoked.`;
  if (status === "superseded") return `${attestation.attestationId}: attestation is superseded.`;
  if (status === "blocked") return `${attestation.attestationId}: attestation is blocked.`;
  return null;
}

export function derivePortableAttestationSummary(
  input: DerivePortableAttestationSummaryInput = {}
): PortableAttestationSummary {
  const generatedAt = nowIso(input.generatedAt);
  const attestations = Array.isArray(input.attestations) ? input.attestations : [];
  const exportSummaries: PortableAttestationExportSummary[] = [];
  const supportSummaries: PortableAttestationSupportSummary[] = [];
  const blockedReasons: string[] = [];

  for (const attestation of attestations) {
    const status = baseStatus(attestation, generatedAt);
    const reason = blockedReason(attestation, status, generatedAt);
    if (reason) blockedReasons.push(reason);

    const exportSummary = toExportSummary(attestation, status);
    if (exportSummary) exportSummaries.push(exportSummary);

    const supportSummary = toSupportSummary(attestation, status);
    if (supportSummary) supportSummaries.push(supportSummary);
  }

  return {
    generatedAt,
    schemaVersion: "portable_attestation.v1",
    exportReady: exportSummaries.length > 0,
    consentRequired: true,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    blockedReasons,
    exportSummaries,
    supportSummaries,
    redactions: REDACTIONS,
  };
}
