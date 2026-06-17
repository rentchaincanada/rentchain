export type LeaseDocumentStatus = "generated" | "locked" | "expired" | "superseded";

export type CounselReviewStatus = "draft" | "reviewed" | "approved" | "deprecated";

export type JurisdictionAdapterCode =
  | "CA_NS"
  | "CA_ON"
  | "CA_BC"
  | "CA_AB"
  | "CA_QC"
  | `US_${string}`;

export type LeaseDocumentStorageRef = {
  bucket: string;
  path: string;
};

export type LeaseDocumentSigningPlacementField = {
  apiId: string;
  type: "signature" | "date_signed";
  signerRole: "tenant" | "landlord";
  signerIndex: number;
  documentIndex: number;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  name?: string;
};

export type LeaseDocumentSigningFieldPlacement = {
  provider: "dropbox_sign";
  placementVersion: "dropbox_sign_form_fields_v1";
  fields: LeaseDocumentSigningPlacementField[];
  landlordPlacementPrepared: boolean;
};

export type FormPFieldStatus = "provided" | "not_applicable" | "pending" | "missing";

export type FormPSectionKey =
  | "parties"
  | "premises"
  | "term"
  | "rent_payments"
  | "security_deposit"
  | "service_notices"
  | "rules_addenda"
  | "attachments_condition_report"
  | "signatures_delivery";

export type FormPFieldEntry = {
  key: string;
  label: string;
  status: FormPFieldStatus;
  value?: string | number | boolean | string[] | null;
  note?: string | null;
};

export type FormPSectionReadiness = {
  key: FormPSectionKey;
  label: string;
  status: "complete" | "incomplete" | "not_applicable" | "pending";
  completionPercent: number;
  fields: FormPFieldEntry[];
};

export type FormPLeaseReadiness = {
  version: "ns_form_p_readiness_v1";
  jurisdictionCode: "CA_NS";
  overallStatus: "complete" | "incomplete" | "pending";
  completionPercent: number;
  missingFields: Array<{ sectionKey: FormPSectionKey; fieldKey: string; label: string }>;
  blockingItems: Array<{ sectionKey: FormPSectionKey; fieldKey: string; label: string }>;
  nonBlockingItems: Array<{
    sectionKey: FormPSectionKey;
    fieldKey: string;
    label: string;
    status: Extract<FormPFieldStatus, "pending" | "not_applicable">;
  }>;
  sectionStatuses: FormPSectionReadiness[];
};

export type FormPStructuredFields = Record<FormPSectionKey, Record<string, FormPFieldEntry>>;

export type LeaseDocumentMetadata = {
  id: string;
  leaseId: string;
  landlordId: string;
  tenantIds: string[];
  documentType: "primary_lease";
  jurisdictionCode: JurisdictionAdapterCode;
  templateVersion: string;
  templateEffectiveDate: string;
  counselReviewStatus: CounselReviewStatus;
  sourceReferences: string[];
  generatedAt: string;
  generatedBy: string | null;
  documentHash: string;
  manifestHash: string;
  storageRef: LeaseDocumentStorageRef;
  providerAccessUrlExpiresAt: string | null;
  status: LeaseDocumentStatus;
  lockedAt: string | null;
  lockedBy: string | null;
  signingRequestId: string | null;
  signingFieldPlacement?: LeaseDocumentSigningFieldPlacement | null;
  formPFields?: FormPStructuredFields | null;
  leaseReadiness?: FormPLeaseReadiness | null;
  supersededAt?: string | null;
  supersededByDocumentId?: string | null;
  sourceSummary: {
    adapterStatus: CounselReviewStatus;
    signingEnabled: boolean;
    productionApproved: boolean;
    templateEffectiveDate: string;
    sourceReferences: string[];
  };
};

export type LeaseDocumentProjection = Omit<LeaseDocumentMetadata, "storageRef" | "signingFieldPlacement"> & {
  storageRef: null;
  previewUrl?: string | null;
};

export type PrimaryLeaseDocumentInput = {
  leaseId: string;
  lease: Record<string, any>;
  landlord: Record<string, any> | null;
  property: Record<string, any> | null;
  unit: Record<string, any> | null;
  tenants: Array<Record<string, any>>;
  formPFields?: Record<string, any> | null;
  actorId?: string | null;
};

export type JurisdictionLeaseDocumentAdapter = {
  jurisdictionCode: JurisdictionAdapterCode;
  templateVersion: string;
  effectiveDate: string;
  counselReviewStatus: CounselReviewStatus;
  signingEnabled: boolean;
  productionApproved: boolean;
  requiredSections: string[];
  requiredDisclosures: string[];
  requiredNotices: string[];
  prohibitedClauseChecks: string[];
  languageRequirements: string[];
  statutoryReferences: string[];
  sourceReferences: string[];
  renderPrimaryLeasePdf(input: PrimaryLeaseDocumentInput): Promise<
    | Buffer
    | {
        pdfBuffer: Buffer;
        signingFieldPlacement?: LeaseDocumentSigningFieldPlacement | null;
      }
  >;
};
