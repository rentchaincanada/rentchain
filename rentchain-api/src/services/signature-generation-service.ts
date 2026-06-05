import crypto from "crypto";
import type { ExportAuthorizationContext } from "../types/export-authorization-types";
import type { CertificateSafeReference, SignatureAlgorithm, SignatureMetadata } from "../types/attestation-types";
import { SIGNATURE_ALGORITHMS } from "../types/attestation-types";
import { isSha256Hash } from "../lib/evidence-hash-service";

function stableHash(value: unknown, length = 32): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length);
}

function safeRef(prefix: string, value: unknown): string {
  return `${prefix}:${stableHash([prefix, value])}`;
}

function toUtcIso(value: unknown): string {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

export function validateSignatureAlgorithm(value: unknown): value is SignatureAlgorithm {
  return SIGNATURE_ALGORITHMS.includes(value as SignatureAlgorithm);
}

export function generateSignatureReference(hash: string, algorithm: SignatureAlgorithm): string {
  if (!isSha256Hash(hash)) throw new Error("signature_hash_invalid");
  if (!validateSignatureAlgorithm(algorithm)) throw new Error("signature_algorithm_unsupported");
  return safeRef("signature", [hash, algorithm]);
}

function validateSignatureContext(context: ExportAuthorizationContext): void {
  if (!context || context.rawIdsIncluded !== false) throw new Error("signature_context_invalid");
  if (!context.requestingActorId) throw new Error("signature_actor_required");
  if (!context.requestingActorScope) throw new Error("signature_landlord_scope_required");
  if (!context.requestingPurpose) throw new Error("signature_purpose_required");
}

export function generateSignature(
  hash: string,
  algorithm: SignatureAlgorithm,
  context: ExportAuthorizationContext,
  options: { certificateRef?: string | null; signedAt?: string | null } = {}
): SignatureMetadata {
  validateSignatureContext(context);
  if (!isSha256Hash(hash)) throw new Error("signature_hash_invalid");
  if (!validateSignatureAlgorithm(algorithm)) throw new Error("signature_algorithm_unsupported");
  const certificateRef = (options.certificateRef && String(options.certificateRef).startsWith("certificate:")
    ? options.certificateRef
    : safeRef("certificate", [context.requestingActorScope, algorithm])) as CertificateSafeReference;
  return {
    signatureRef: generateSignatureReference(hash, algorithm),
    signatureAlgorithm: algorithm,
    certificateRef,
    contentHash: hash,
    signedAt: toUtcIso(options.signedAt || context.timestamp),
    verifiedAt: null,
    signerRef: safeRef("signer", [context.requestingActorId, context.requestingActorRole]),
    metadataOnly: true,
    rawSignatureIncluded: false,
    rawCertificateIncluded: false,
    keyMaterialIncluded: false,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}
