import type {
  AttestationLifecycleState,
  CertificateSafeReference,
  SafeEvidenceReference,
  SignatureAlgorithm,
} from "./attestation-types";
import type { ExportAuditEventType } from "./export-audit-types";

export type AttestationAccessRole = "tenant" | "landlord" | "admin" | "support";

export type AttestationAccessContext = {
  role: AttestationAccessRole;
  subjectRef: string;
  landlordRef: string | null;
  allowedEvidenceRefs: SafeEvidenceReference[];
  supportPurpose: string | null;
  rawIdsIncluded: false;
};

export type AttestationHashRouteParams = {
  hashValue: string;
};

export type AttestationEvidenceRouteParams = {
  evidenceId: string;
};

export type AttestationApiEnvelope<T> =
  | {
      success: true;
      data: T;
      error: null;
      code: "OK";
    }
  | {
      success: false;
      data: null;
      error: string;
      code:
        | "ATTESTATION_BAD_REQUEST"
        | "ATTESTATION_UNAUTHORIZED"
        | "ATTESTATION_FORBIDDEN"
        | "ATTESTATION_NOT_FOUND"
        | "ATTESTATION_INTERNAL_ERROR";
    };

export type AttestationHashMetadataResponse = {
  hashValue: string;
  attestationRef: string;
  exportPackageRef: string;
  evidenceRef: SafeEvidenceReference | null;
  lifecycleState: AttestationLifecycleState | null;
  signature: {
    signatureRef: string | null;
    certificateRef: CertificateSafeReference | null;
    signatureAlgorithm: SignatureAlgorithm | null;
  };
  verificationStatus: "verified" | "unverified" | "invalid";
  observedAt: string | null;
  metadataOnly: true;
  immutable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type AttestationChainEventResponse = {
  eventType: ExportAuditEventType;
  lifecycleState: AttestationLifecycleState;
  timestamp: string;
  hashValue: string | null;
  signatureRef: string | null;
  certificateRef: CertificateSafeReference | null;
  signatureAlgorithm: SignatureAlgorithm | null;
  evidenceRef: SafeEvidenceReference | null;
  metadataOnly: true;
  immutable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type AttestationChainResponse = {
  attestationRef: string;
  exportPackageRef: string;
  currentState: AttestationLifecycleState | null;
  events: AttestationChainEventResponse[];
  pagination: {
    limit: number;
    returned: number;
    hasMore: boolean;
  };
  metadataOnly: true;
  appendOnly: true;
  immutable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type AttestationVerifyResponse = {
  evidenceRef: SafeEvidenceReference;
  verified: boolean;
  matchedHash: string | null;
  attestationRef: string | null;
  verificationErrors: string[];
  chain: AttestationChainResponse | null;
  metadataOnly: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};
