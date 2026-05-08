import type {
  AccountTrustSubjectType,
  VerificationConfidence,
  VerificationEvidenceType,
  VerificationSignal,
  VerificationSignalStatus,
  VerificationSignalType,
  VerificationSource,
} from "./accountTrustTypes";

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

export function verificationSignal(params: {
  signalType: VerificationSignalType;
  subjectType: AccountTrustSubjectType;
  subjectId: unknown;
  status: VerificationSignalStatus;
  source: VerificationSource;
  evidenceType?: VerificationEvidenceType;
  confidence?: VerificationConfidence;
  providerKey?: unknown;
  evidenceRef?: unknown;
  issuedAt?: unknown;
  verifiedAt?: unknown;
  expiresAt?: unknown;
  revokedAt?: unknown;
  redacted?: boolean;
  reviewRequired?: boolean;
}): VerificationSignal {
  const subjectId = asString(params.subjectId, 400) || "unknown";
  const evidenceRef = asString(params.evidenceRef, 400) || null;
  const signalId = [params.subjectType, subjectId, params.signalType, params.source, evidenceRef || "metadata"]
    .join(":")
    .replace(/\s+/g, "_")
    .toLowerCase();

  return {
    signalId,
    signalType: params.signalType,
    subjectType: params.subjectType,
    subjectId,
    status: params.status,
    source: params.source,
    evidenceType: params.evidenceType || "metadata_only",
    confidence: params.confidence || "low",
    providerKey: asString(params.providerKey, 120) || null,
    evidenceRef,
    issuedAt: asString(params.issuedAt, 120) || null,
    verifiedAt: asString(params.verifiedAt, 120) || null,
    expiresAt: asString(params.expiresAt, 120) || null,
    revokedAt: asString(params.revokedAt, 120) || null,
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    redacted: Boolean(params.redacted),
    reviewRequired: Boolean(params.reviewRequired),
  };
}
