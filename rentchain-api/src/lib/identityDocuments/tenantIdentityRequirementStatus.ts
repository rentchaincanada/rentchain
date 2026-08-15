import type {
  CanonicalIdentitySubjectContext,
  IdentityDocumentRuntimePolicy,
} from "./identityDocumentApplicationService";
import { IDENTITY_DOCUMENT_MIME_TYPES, MAX_IDENTITY_DOCUMENT_FILE_BYTES } from "./identityDocumentTypes";

type IdentityDocumentSummary = {
  status: "pending_upload" | "processing" | "ready" | "rejected" | "replaced" | "deletion_scheduled" | "deleted";
  verificationStatus: "not_started" | "pending" | "verified" | "review_required" | "failed" | "expired" | "cancelled";
};

export function buildTenantIdentityRequirementStatus(input: {
  context: CanonicalIdentitySubjectContext;
  policy: IdentityDocumentRuntimePolicy;
  documents: readonly IdentityDocumentSummary[];
}) {
  const activeDocuments = input.documents.filter(
    (document) => document.status !== "replaced" && document.status !== "deletion_scheduled",
  );
  const receivedDocument = activeDocuments.find((document) => document.status === "ready");

  return {
    required: true as const,
    requirementStatus: receivedDocument ? ("satisfied" as const) : ("action_required" as const),
    collectionStatus: receivedDocument ? ("received" as const) : ("not_uploaded" as const),
    verificationStatus: receivedDocument?.verificationStatus ?? ("not_started" as const),
    activeDocumentCount: activeDocuments.length,
    consent: {
      purpose: "identity_document_collection" as const,
      requirementPolicyId: input.policy.requirementPolicyId,
      requirementPolicyVersion: input.policy.requirementPolicyVersion,
      policyTextVersion: input.policy.policyTextVersion,
      privacyNoticeVersion: input.policy.privacyNoticeVersion,
      retentionPolicyVersion: input.policy.retentionPolicyVersion,
    },
    acceptedMimeTypes: IDENTITY_DOCUMENT_MIME_TYPES,
    maxFileBytes: MAX_IDENTITY_DOCUMENT_FILE_BYTES,
    applicationContinuity: Boolean(input.context.applicationIds.length || input.context.applicantParticipantId),
    tenantContinuity: Boolean(input.context.tenantId),
    biometricProcessing: false as const,
    pdfSupported: false as const,
  };
}
