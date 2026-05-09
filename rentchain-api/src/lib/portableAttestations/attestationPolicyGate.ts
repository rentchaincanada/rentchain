import type {
  AttestationPolicyContext,
  AttestationPolicyDecision,
  AttestationPolicyReason,
  PolicySafeExportSummaryResult,
  PortableAttestation,
  PortableAttestationExportSummary,
  PortableAttestationLifecycleState,
  PortableAttestationPolicySensitivity,
  PortableAttestationPurpose,
  PortableAttestationStatus,
} from "./portableAttestationTypes";

const DEFAULT_ALLOWED_RETENTION = new Set(["portable_metadata", "export_metadata"]);

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

function lifecycleFromStatus(status: PortableAttestationStatus): PortableAttestationLifecycleState {
  if (status === "blocked") return "blocked";
  if (status === "pending_consent") return "consent_required";
  if (status === "revoked") return "revoked";
  if (status === "superseded") return "superseded";
  if (status === "expired") return "expired";
  if (status === "reverification_required") return "reverification_required";
  return "export_ready";
}

function derivedStatus(attestation: PortableAttestation, generatedAt: string): PortableAttestationStatus {
  if (
    attestation.metadataOnly !== true ||
    attestation.rawSensitivePayloadStored !== false ||
    attestation.rawProviderPayloadIncluded !== false ||
    attestation.supportMetadataIncluded !== false ||
    attestation.evidenceSummary.rawEvidenceIncluded !== false ||
    attestation.publicAccessEnabled !== false ||
    attestation.externalSubmissionEnabled !== false ||
    attestation.unsupportedClaim !== false
  ) {
    return "blocked";
  }
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
  if (timestampAtOrBefore(attestation.nextReverificationAt, generatedAt)) return "reverification_required";
  if (!attestation.consentScope.consentId || !attestation.consentScope.grantedAt) return "pending_consent";
  return attestation.status;
}

function isSensitivityAllowed(sensitivity: PortableAttestationPolicySensitivity | null | undefined) {
  return sensitivity === "confidential" || !sensitivity;
}

function addReason(reasons: AttestationPolicyReason[], reason: AttestationPolicyReason) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function allowedRetentionClasses(context: AttestationPolicyContext) {
  return new Set(context.allowedRetentionClasses?.length ? context.allowedRetentionClasses : Array.from(DEFAULT_ALLOWED_RETENTION));
}

export function evaluateAttestationPolicy(
  attestation: PortableAttestation,
  context: AttestationPolicyContext
): AttestationPolicyDecision {
  const generatedAt = nowIso(context.generatedAt);
  const requestedAudience = context.requestedAudience || null;
  const requestedPurpose = context.requestedPurpose || null;
  const status = derivedStatus(attestation, generatedAt);
  const lifecycleState = lifecycleFromStatus(status);
  const reasons: AttestationPolicyReason[] = ["deny_by_default"];

  if (!requestedAudience) addReason(reasons, "audience_missing");
  if (requestedAudience && requestedAudience !== attestation.audience) addReason(reasons, "audience_mismatch");
  if (requestedAudience && requestedAudience !== attestation.consentScope.audience) addReason(reasons, "audience_mismatch");

  if (!requestedPurpose) addReason(reasons, "purpose_missing");
  if (requestedPurpose && requestedPurpose !== attestation.consentScope.purpose) addReason(reasons, "purpose_mismatch");

  if (!attestation.consentScope.consentId || !attestation.consentScope.grantedAt) addReason(reasons, "consent_missing");
  if (attestation.consentScope.revokedAt) addReason(reasons, "consent_revoked");
  if (timestampAtOrBefore(attestation.consentScope.expiresAt, generatedAt)) addReason(reasons, "consent_expired");
  if (!attestation.consentScope.claimCategories.includes(attestation.claimCategory)) {
    addReason(reasons, "consent_scope_insufficient");
  }

  if (status === "expired") addReason(reasons, "expired");
  if (status === "revoked") addReason(reasons, "revoked");
  if (status === "superseded") addReason(reasons, "superseded");
  if (status === "blocked" || lifecycleState === "blocked") addReason(reasons, "blocked");
  if (status === "reverification_required" || lifecycleState === "reverification_required") {
    addReason(reasons, "reverification_required");
  }

  if (!allowedRetentionClasses(context).has(attestation.retentionClass)) addReason(reasons, "retention_not_portable");
  if (!isSensitivityAllowed(context.sensitivity || "confidential")) addReason(reasons, "sensitivity_blocked");

  if (attestation.unsupportedClaim !== false) addReason(reasons, "unsupported_claim");
  if (attestation.metadataOnly !== true || attestation.rawSensitivePayloadStored !== false || attestation.rawProviderPayloadIncluded !== false) {
    addReason(reasons, "raw_payload_blocked");
  }
  if (attestation.supportMetadataIncluded !== false) addReason(reasons, "support_metadata_blocked");
  if (attestation.publicAccessEnabled !== false || context.publicRequest === true) addReason(reasons, "public_exposure_blocked");
  if (attestation.externalSubmissionEnabled !== false) addReason(reasons, "external_submission_blocked");
  if (attestation.evidenceSummary.rawEvidenceIncluded !== false) addReason(reasons, "unsafe_evidence_summary");
  if (attestation.evidenceSummary.sourceSystem !== attestation.sourceReference.sourceSystem) addReason(reasons, "source_mismatch");

  const allowed = reasons.length === 1 && reasons[0] === "deny_by_default" && status === "active" && lifecycleState === "export_ready";

  return {
    allowed,
    shareable: allowed && context.operation === "share",
    exportable: allowed && context.operation === "export",
    operation: context.operation,
    attestationId: attestation.attestationId,
    requestedAudience,
    requestedPurpose,
    status,
    lifecycleState,
    reasons: allowed ? [context.operation === "share" ? "share_allowed" : "export_allowed"] : reasons,
    generatedAt,
    metadataOnly: true,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
  };
}

function toExportSummary(
  attestation: PortableAttestation,
  decision: AttestationPolicyDecision,
  purpose: PortableAttestationPurpose
): PortableAttestationExportSummary {
  return {
    attestationId: attestation.attestationId,
    schemaVersion: "portable_attestation.v1",
    attestationType: attestation.attestationType,
    subjectType: attestation.subjectType,
    subjectId: attestation.subjectId,
    claimCategory: attestation.claimCategory,
    claimLabel: attestation.claimLabel,
    claimDescription: attestation.claimDescription,
    status: decision.status,
    lifecycleState: decision.lifecycleState,
    issuerCategory: attestation.issuerCategory,
    audience: attestation.audience,
    permittedPurpose: purpose,
    consentReferenceId: attestation.consentScope.consentId as string,
    consentGrantedAt: attestation.consentScope.grantedAt as string,
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

export function buildPolicySafeExportSummary(
  attestation: PortableAttestation,
  context: AttestationPolicyContext
): PolicySafeExportSummaryResult {
  const decision = evaluateAttestationPolicy(attestation, { ...context, operation: "export" });
  return {
    decision,
    exportSummary:
      decision.exportable && context.requestedPurpose
        ? toExportSummary(attestation, decision, context.requestedPurpose)
        : null,
  };
}

export function assertPortableAttestationShareable(
  attestation: PortableAttestation,
  context: AttestationPolicyContext
): AttestationPolicyDecision {
  return evaluateAttestationPolicy(attestation, { ...context, operation: "share" });
}
