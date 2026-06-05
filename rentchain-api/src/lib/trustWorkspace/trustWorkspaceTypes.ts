import type {
  AttestationLifecycleState,
  CertificateSafeReference,
  SafeEvidenceReference,
  SignatureAlgorithm,
} from "../../types/attestation-types";
import type {
  EvidenceClass,
  EvidenceRecordStatus,
  EvidenceResourceType,
} from "../../types/evidence-record-types";
import type {
  InstitutionalTrustExportAudience,
  InstitutionalTrustExportPurpose,
  InstitutionalTrustExportStatus,
} from "../institutionTrustExports/institutionTrustExportTypes";
import type {
  CrossOrganizationTrustRelationshipType,
  CrossOrganizationTrustStatus,
} from "../crossOrganizationTrust/crossOrganizationTrustTypes";

export const TRUST_WORKSPACE_ROLES = ["tenant", "landlord", "admin", "support"] as const;

export type TrustWorkspaceRole = (typeof TRUST_WORKSPACE_ROLES)[number];

export type TrustWorkspaceAccessContext = {
  role: TrustWorkspaceRole;
  requesterRef: string;
  landlordRef: string | null;
  tenantRef: string | null;
  allowedEvidenceRefs: SafeEvidenceReference[];
  supportPurpose: string | null;
  rawIdsIncluded: false;
};

export type TrustWorkspaceLandlordContext = TrustWorkspaceAccessContext & {
  derivedAt: string;
  workspaceRef: string;
  metadataOnly: true;
  immutable: true;
  nonPublic: true;
  nonShareable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type TrustWorkspaceEvidenceChainSummary = {
  evidenceRef: SafeEvidenceReference;
  evidenceClass: EvidenceClass;
  evidenceType: string;
  resourceType: EvidenceResourceType;
  status: EvidenceRecordStatus;
  contentHash: string | null;
  provenanceChain: SafeEvidenceReference[];
  authority: {
    authorityRole: string;
    landlordRef: string | null;
    tenantRef: string | null;
    supportAllowed: boolean;
    rawIdsIncluded: false;
  };
  attestationStatus: AttestationLifecycleState | "Unlinked" | "Invalid";
  policyEvaluationState: "export_ready" | "blocked" | "unavailable";
  metadataOnly: true;
  immutable: true;
  nonPublic: true;
  nonShareable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type TrustWorkspaceAttestationContext = {
  attestationRef: string;
  evidenceRef: SafeEvidenceReference | null;
  lifecycleState: AttestationLifecycleState | null;
  signatureRef: string | null;
  certificateRef: CertificateSafeReference | null;
  signatureAlgorithm: SignatureAlgorithm | null;
  hashValue: string | null;
  hashVerificationStatus: "verified" | "unverified" | "invalid" | "unavailable";
  linkedEvidence: SafeEvidenceReference[];
  metadataOnly: true;
  immutable: true;
  nonPublic: true;
  nonShareable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type TrustWorkspaceExportReadinessSummary = {
  exportPackageRef: string;
  audience: InstitutionalTrustExportAudience;
  purpose: InstitutionalTrustExportPurpose;
  status: InstitutionalTrustExportStatus;
  policyGateStatus: "ready" | "blocked" | "unavailable";
  blockedReasonCount: number;
  exportableAttestationCount: number;
  blockedAttestationCount: number;
  manualOnly: true;
  publicAccessEnabled: false;
  externalSubmissionEnabled: false;
  metadataOnly: true;
  immutable: true;
  nonPublic: true;
  nonShareable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type TrustWorkspaceCrossOrgContext = {
  trustRelationshipRef: string;
  relationshipType: CrossOrganizationTrustRelationshipType;
  status: CrossOrganizationTrustStatus;
  evidenceTrustState: CrossOrganizationTrustStatus;
  reviewTrustState: CrossOrganizationTrustStatus;
  settlementTrustState: CrossOrganizationTrustStatus;
  restrictionCount: number;
  blockedReasonCount: number;
  manualReviewRequired: true;
  publicTrustExposureEnabled: false;
  autonomousTrustApprovalEnabled: false;
  metadataOnly: true;
  immutable: true;
  nonPublic: true;
  nonShareable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type TrustWorkspaceSummary = {
  workspaceRef: string;
  derivedAt: string;
  role: TrustWorkspaceRole;
  landlordRef: string | null;
  tenantRef: string | null;
  evidenceSummaries: TrustWorkspaceEvidenceChainSummary[];
  attestationContexts: TrustWorkspaceAttestationContext[];
  exportReadinessStates: TrustWorkspaceExportReadinessSummary[];
  crossOrgContexts: TrustWorkspaceCrossOrgContext[];
  errorFlags: string[];
  metadataOnly: true;
  immutable: true;
  nonPublic: true;
  nonShareable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type TrustWorkspaceErrorResponse = {
  ok: false;
  code:
    | "TRUST_WORKSPACE_INVALID_ROLE"
    | "TRUST_WORKSPACE_MISSING_SCOPE"
    | "TRUST_WORKSPACE_FORBIDDEN"
    | "TRUST_WORKSPACE_DERIVATION_FAILED";
  error: string;
  metadataOnly: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type TrustWorkspaceServiceResult =
  | { ok: true; workspace: TrustWorkspaceSummary }
  | TrustWorkspaceErrorResponse;
