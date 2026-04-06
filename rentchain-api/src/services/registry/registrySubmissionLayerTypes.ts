import type { RegistryJurisdiction, RegistrySubmissionDraftV2, RegistrySubmissionValidation } from "./schemas/registrySchemaTypes";

export type RegistryFilingChannel = "manual_portal" | "assisted_filing" | "api_upload";

export type RegistrySubmissionLifecycleStatus =
  | "in_review"
  | "ready_to_file"
  | "filed_pending_confirmation"
  | "filed_confirmed"
  | "rejected"
  | "failed"
  | "cancelled";

export type RegistrySubmissionAuditEventV3 = {
  at: string;
  actorId: string | null;
  type: string;
  status: RegistrySubmissionLifecycleStatus | null;
  note: string | null;
};

export type RegistrySubmissionReferenceNumberV3 = {
  type: "submission_id" | "receipt" | "registry_number" | "external_reference";
  value: string;
  label: string | null;
  recordedAt: string;
  recordedBy: string | null;
};

export type RegistrySubmissionEvidenceV3 = {
  id: string;
  type: "pdf" | "html_snapshot" | "email" | "screenshot" | "other";
  label: string;
  url: string | null;
  note: string | null;
  recordedAt: string;
  recordedBy: string | null;
};

export type RegistrySubmissionNormalizedFieldV3 = {
  id: string;
  label: string;
  value: string | number | boolean | null;
  required: boolean;
};

export type RegistrySubmissionNormalizedSectionV3 = {
  id: string;
  label: string;
  fields: RegistrySubmissionNormalizedFieldV3[];
};

export type RegistrySubmissionReadyV3 = {
  schemaVersion: 3;
  readyId: string;
  sourceDraftId: string;
  sourceDraftVersion: RegistrySubmissionDraftV2["schemaVersion"];
  propertyId: string;
  sourceKey: string;
  schemaKey: string;
  schemaLabel: string;
  assistantType: RegistrySubmissionDraftV2["assistantType"];
  filingChannel: RegistryFilingChannel;
  status: Extract<RegistrySubmissionLifecycleStatus, "in_review" | "ready_to_file">;
  createdAt: string;
  updatedAt: string;
  actor: {
    landlordId: string | null;
    updatedBy: string | null;
  };
  jurisdiction: RegistryJurisdiction;
  validation: RegistrySubmissionValidation;
  consentLock: RegistrySubmissionDraftV2["submission"]["consent"];
  declarationsLock: RegistrySubmissionDraftV2["declarations"];
  normalizedSubmission: {
    sections: RegistrySubmissionNormalizedSectionV3[];
    attachments: RegistrySubmissionDraftV2["attachments"];
    disclaimer: string | null;
  };
  audit: {
    sourceDraftUpdatedAt: string;
    events: RegistrySubmissionAuditEventV3[];
  };
};

export type RegistrySubmissionAttemptV3 = {
  schemaVersion: 3;
  attemptId: string;
  propertyId: string;
  sourceDraftId: string;
  readyId: string;
  requestId: string;
  resultId: string | null;
  attemptNumber: number;
  filingChannel: RegistryFilingChannel;
  adapterKey: string;
  status: RegistrySubmissionLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  referenceNumbers: RegistrySubmissionReferenceNumberV3[];
  operatorNotes: string | null;
  evidence: RegistrySubmissionEvidenceV3[];
  audit: {
    events: RegistrySubmissionAuditEventV3[];
  };
};

export type RegistrySubmissionRequestV3 = {
  schemaVersion: 3;
  requestId: string;
  attemptId: string;
  readyId: string;
  sourceDraftId: string;
  propertyId: string;
  sourceKey: string;
  schemaKey: string;
  schemaLabel: string;
  filingChannel: RegistryFilingChannel;
  adapterKey: string;
  status: RegistrySubmissionLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  actor: {
    requestedBy: string | null;
    updatedBy: string | null;
  };
  checklist: {
    portalUrl: string | null;
    steps: string[];
    notes: string[];
  };
  payload: {
    sections: RegistrySubmissionNormalizedSectionV3[];
    disclaimer: string | null;
  };
  referenceNumbers: RegistrySubmissionReferenceNumberV3[];
  operatorNotes: string | null;
  evidence: RegistrySubmissionEvidenceV3[];
  audit: {
    events: RegistrySubmissionAuditEventV3[];
  };
};

export type RegistrySubmissionResultV3 = {
  schemaVersion: 3;
  resultId: string;
  attemptId: string;
  requestId: string;
  readyId: string;
  sourceDraftId: string;
  propertyId: string;
  sourceKey: string;
  schemaKey: string;
  filingChannel: RegistryFilingChannel;
  adapterKey: string;
  status: Extract<
    RegistrySubmissionLifecycleStatus,
    "filed_pending_confirmation" | "filed_confirmed" | "rejected" | "failed" | "cancelled"
  >;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  actor: {
    updatedBy: string | null;
  };
  referenceNumbers: RegistrySubmissionReferenceNumberV3[];
  operatorNotes: string | null;
  evidence: RegistrySubmissionEvidenceV3[];
  outcome: {
    message: string | null;
  };
  audit: {
    events: RegistrySubmissionAuditEventV3[];
  };
};

export type RegistrySubmissionFilingSummaryV3 = {
  ready: RegistrySubmissionReadyV3 | null;
  latestAttempt: RegistrySubmissionAttemptV3 | null;
  attempts: RegistrySubmissionAttemptV3[];
  request: RegistrySubmissionRequestV3 | null;
  result: RegistrySubmissionResultV3 | null;
  currentStatus: RegistrySubmissionLifecycleStatus | null;
};

export interface RegistryFilingAdapter {
  adapterKey: string;
  schemaKey: string;
  filingChannel: RegistryFilingChannel;
  supportsAttachments: boolean;
  normalize(draft: RegistrySubmissionDraftV2): RegistrySubmissionReadyV3;
  buildRequest(ready: RegistrySubmissionReadyV3): RegistrySubmissionRequestV3;
  buildOperatorChecklist?(ready: RegistrySubmissionReadyV3): RegistrySubmissionRequestV3["checklist"];
  mapResult?(input: {
    request: RegistrySubmissionRequestV3;
    status: Extract<
      RegistrySubmissionLifecycleStatus,
      "filed_pending_confirmation" | "filed_confirmed" | "rejected" | "failed" | "cancelled"
    >;
    actorId: string | null;
    note?: string | null;
    referenceNumbers?: RegistrySubmissionReferenceNumberV3[];
    evidence?: RegistrySubmissionEvidenceV3[];
  }): RegistrySubmissionResultV3;
}
