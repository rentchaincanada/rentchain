import type { PortableAttestationType } from "../lib/portableAttestations/portableAttestationTypes";
import type { ExportAuditEventPayload } from "./export-audit-types";

export const SIGNATURE_ALGORITHMS = ["RSA-SHA256", "ECDSA-SHA256"] as const;

export type SignatureAlgorithm = (typeof SIGNATURE_ALGORITHMS)[number];

export const ATTESTATION_LIFECYCLE_STATES = [
  "SignatureRequested",
  "SignatureGenerated",
  "SignatureVerified",
  "AttestationLinked",
  "AttestationRevoked",
] as const;

export type AttestationLifecycleState = (typeof ATTESTATION_LIFECYCLE_STATES)[number];

export type AttestationSafeReference = `attestation:${string}`;
export type CertificateSafeReference = `certificate:${string}`;
export type SafeEvidenceReference = `evidence:${string}` | `exp_pkg_v1_${string}` | `${string}:${string}`;

export type CertificateReference = {
  certificateRef: CertificateSafeReference;
  issuerRef: string;
  algorithm: SignatureAlgorithm;
  validFrom: string;
  validTo: string;
  registeredAt: string;
  metadataOnly: true;
  rawCertificateIncluded: false;
  keyMaterialIncluded: false;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type CertificateProjection = Pick<
  CertificateReference,
  | "certificateRef"
  | "issuerRef"
  | "algorithm"
  | "validFrom"
  | "validTo"
  | "metadataOnly"
  | "rawCertificateIncluded"
  | "keyMaterialIncluded"
  | "rawIdsIncluded"
  | "payloadIncluded"
>;

export type SignatureMetadata = {
  signatureRef: string;
  signatureAlgorithm: SignatureAlgorithm;
  certificateRef: CertificateSafeReference;
  signedAt: string | null;
  verifiedAt: string | null;
  signerRef: string;
  metadataOnly: true;
  rawSignatureIncluded: false;
  rawCertificateIncluded: false;
  keyMaterialIncluded: false;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type AttestationAuditMetadata = {
  attestationRef: AttestationSafeReference;
  signatureRef: string | null;
  certificateRef: CertificateSafeReference | null;
  signatureAlgorithm: SignatureAlgorithm | null;
  portableAttestationType: PortableAttestationType | null;
  lifecycleState: AttestationLifecycleState;
  linkedEvidenceRef: SafeEvidenceReference | null;
  metadataOnly: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type AttestationLink = {
  attestationRef: AttestationSafeReference;
  evidenceRef: SafeEvidenceReference;
  exportPackageRef: string;
  landlordRef: string;
  linkStatus: "linked" | "revoked";
  linkedAt: string;
  revokedAt: string | null;
  metadataOnly: true;
  immutable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type AttestationChainEvent = {
  eventId: string;
  eventType: ExportAuditEventPayload["eventType"];
  lifecycleState: AttestationLifecycleState;
  timestamp: string;
  attestationRef: AttestationSafeReference;
  signatureRef: string | null;
  certificateRef: CertificateSafeReference | null;
  signatureAlgorithm: SignatureAlgorithm | null;
  evidenceRef: SafeEvidenceReference | null;
  eventSummary: string;
  metadataOnly: true;
  immutable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type AttestationChain = {
  attestationRef: AttestationSafeReference;
  landlordRef: string;
  exportPackageRef: string;
  events: AttestationChainEvent[];
  currentState: AttestationLifecycleState | null;
  metadataOnly: true;
  appendOnly: true;
  immutable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type AttestationProjection = {
  attestationRef: AttestationSafeReference;
  exportPackageRef: string;
  currentState: AttestationLifecycleState | null;
  events: Array<{
    eventType: ExportAuditEventPayload["eventType"];
    lifecycleState: AttestationLifecycleState;
    timestamp: string;
    signatureAlgorithm: SignatureAlgorithm | null;
    certificateRef: CertificateSafeReference | null;
    evidenceRef: SafeEvidenceReference | null;
  }>;
  metadataOnly: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};
