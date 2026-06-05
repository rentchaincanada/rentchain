import crypto from "crypto";
import type {
  CertificateProjection,
  CertificateReference,
  CertificateSafeReference,
  SignatureAlgorithm,
} from "../types/attestation-types";
import { SIGNATURE_ALGORITHMS } from "../types/attestation-types";

function stableHash(value: unknown, length = 32): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length);
}

function safeText(value: unknown, max = 240): string {
  return String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toUtcIso(value: unknown): string {
  const raw = safeText(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function isUtcIso(value: string): boolean {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}

export function validateCertificateAlgorithm(value: unknown): value is SignatureAlgorithm {
  return SIGNATURE_ALGORITHMS.includes(value as SignatureAlgorithm);
}

export function generateCertificateSafeReference(input: {
  issuer: string;
  algorithm: SignatureAlgorithm;
  validFrom: string;
  validTo: string;
}): CertificateSafeReference {
  return `certificate:${stableHash(["certificate", input.issuer, input.algorithm, input.validFrom, input.validTo])}`;
}

export function registerCertificateReference(input: {
  issuer: string;
  algorithm: SignatureAlgorithm;
  validFrom: string;
  validTo: string;
  registeredAt?: string;
}): CertificateReference {
  const issuerRef = safeText(input.issuer, 160);
  const validFrom = toUtcIso(input.validFrom);
  const validTo = toUtcIso(input.validTo);
  const registeredAt = toUtcIso(input.registeredAt);
  if (!issuerRef) throw new Error("certificate_issuer_required");
  if (!validateCertificateAlgorithm(input.algorithm)) throw new Error("certificate_algorithm_unsupported");
  if (!isUtcIso(validFrom) || !isUtcIso(validTo) || Date.parse(validFrom) >= Date.parse(validTo)) {
    throw new Error("certificate_validity_invalid");
  }
  return {
    certificateRef: generateCertificateSafeReference({
      issuer: issuerRef,
      algorithm: input.algorithm,
      validFrom,
      validTo,
    }),
    issuerRef: `issuer:${stableHash(["issuer", issuerRef], 20)}`,
    algorithm: input.algorithm,
    validFrom,
    validTo,
    registeredAt,
    metadataOnly: true,
    rawCertificateIncluded: false,
    keyMaterialIncluded: false,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function getCertificateReference(
  certificateHash: string,
  certificates: readonly CertificateReference[]
): CertificateReference | null {
  return certificates.find((record) => record.certificateRef === certificateHash) || null;
}

export function validateCertificateValidity(
  certificateHash: string,
  timestamp: string,
  certificates: readonly CertificateReference[]
): boolean {
  const record = getCertificateReference(certificateHash, certificates);
  if (!record) return false;
  const at = Date.parse(toUtcIso(timestamp));
  return Number.isFinite(at) && at >= Date.parse(record.validFrom) && at <= Date.parse(record.validTo);
}

export function projectCertificateMetadata(certificateRecord: CertificateReference): CertificateProjection {
  return {
    certificateRef: certificateRecord.certificateRef,
    issuerRef: certificateRecord.issuerRef,
    algorithm: certificateRecord.algorithm,
    validFrom: certificateRecord.validFrom,
    validTo: certificateRecord.validTo,
    metadataOnly: true,
    rawCertificateIncluded: false,
    keyMaterialIncluded: false,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}
