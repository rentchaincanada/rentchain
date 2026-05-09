import { redactIdentifier } from "../governance/platformGovernance";
import { buildPolicySafeExportSummary } from "./attestationPolicyGate";
import type {
  AttestationPolicyDecision,
  DerivePortableAttestationSummaryInput,
  PortableAttestation,
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

function policyBlockedReasons(decision: AttestationPolicyDecision) {
  return decision.allowed
    ? []
    : decision.reasons.map((reason) => `${decision.attestationId}: ${reason}`);
}

export function derivePortableAttestationSummary(
  input: DerivePortableAttestationSummaryInput = {}
): PortableAttestationSummary {
  const generatedAt = nowIso(input.generatedAt);
  const attestations = Array.isArray(input.attestations) ? input.attestations : [];
  const policyDecisions: AttestationPolicyDecision[] = [];
  const exportSummaries: PortableAttestationSummary["exportSummaries"] = [];
  const supportSummaries: PortableAttestationSupportSummary[] = [];
  const blockedReasons: string[] = [];

  for (const attestation of attestations) {
    const status = baseStatus(attestation, generatedAt);
    const reason = blockedReason(attestation, status, generatedAt);
    if (reason) blockedReasons.push(reason);

    const { decision, exportSummary } = buildPolicySafeExportSummary(attestation, {
      operation: "export",
      requestedAudience: input.requestedAudience || null,
      requestedPurpose: input.requestedPurpose || null,
      generatedAt,
      sensitivity: input.sensitivity || "confidential",
      publicRequest: input.publicRequest === true,
    });
    policyDecisions.push(decision);
    blockedReasons.push(...policyBlockedReasons(decision));
    if (exportSummary) exportSummaries.push(exportSummary);

    const supportSummary = toSupportSummary(attestation, decision.status);
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
    blockedReasons: Array.from(new Set(blockedReasons)),
    policyDecisions,
    exportSummaries,
    supportSummaries,
    redactions: REDACTIONS,
  };
}
