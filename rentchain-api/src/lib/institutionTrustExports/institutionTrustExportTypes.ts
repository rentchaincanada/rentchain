import type {
  AttestationPolicyDecision,
  PortableAttestation,
  PortableAttestationAudience,
  PortableAttestationExportSummary,
  PortableAttestationPurpose,
} from "../portableAttestations/portableAttestationTypes";

export type InstitutionalTrustExportAudience =
  | "insurer"
  | "lender"
  | "institutional_landlord"
  | "subsidy_program"
  | "government_review"
  | "tenant_portability"
  | "auditor"
  | "internal_review";

export type InstitutionalTrustExportPurpose =
  | "insurance_review"
  | "lender_review"
  | "government_program_review"
  | "institutional_landlord_review"
  | "tenant_controlled_portability"
  | "auditor_review"
  | "internal_review";

export type InstitutionalTrustExportStatus = "export_ready" | "blocked" | "unavailable";

export type InstitutionalTrustExportLifecycle = "policy_evaluated" | "blocked" | "empty";

export type InstitutionalTrustExportRedaction = {
  fieldCategory: string;
  reason: string;
};

export type InstitutionalTrustExportProvenance = {
  source: "portable_attestations";
  sourceSchemaVersion: "portable_attestation.v1";
  sourceCount: number;
  policyGate: "attestation_policy_gate.v1";
};

export type InstitutionalTrustExportAuditMetadata = {
  exportId: string;
  generatedAt: string;
  audience: InstitutionalTrustExportAudience;
  purpose: InstitutionalTrustExportPurpose;
  consentScoped: true;
  policyGated: true;
  manualOnly: true;
  publicAccessEnabled: false;
  externalSubmissionEnabled: false;
  portableAttestationCount: number;
  exportableAttestationCount: number;
  blockedAttestationCount: number;
  policyDecisionCount: number;
};

export type InstitutionalTrustExportPackage = {
  exportId: string;
  schemaVersion: "institutional_trust_export.v1";
  audience: InstitutionalTrustExportAudience;
  purpose: InstitutionalTrustExportPurpose;
  status: InstitutionalTrustExportStatus;
  lifecycle: InstitutionalTrustExportLifecycle;
  generatedAt: string;
  metadataOnly: true;
  consentScoped: true;
  policyGated: true;
  manualOnly: true;
  publicAccessEnabled: false;
  externalSubmissionEnabled: false;
  exportSummaries: PortableAttestationExportSummary[];
  policyDecisions: AttestationPolicyDecision[];
  blockedReasons: string[];
  redactions: InstitutionalTrustExportRedaction[];
  provenance: InstitutionalTrustExportProvenance;
  auditMetadata: InstitutionalTrustExportAuditMetadata;
};

export type InstitutionalTrustExportAudienceMapping = {
  audience: InstitutionalTrustExportAudience;
  purpose: InstitutionalTrustExportPurpose;
  portableAudience: PortableAttestationAudience | null;
  portablePurpose: PortableAttestationPurpose | null;
};

export type DeriveInstitutionalTrustExportPackageInput = {
  exportId?: unknown;
  audience: InstitutionalTrustExportAudience;
  purpose: InstitutionalTrustExportPurpose;
  generatedAt?: unknown;
  attestations?: PortableAttestation[] | null;
};
