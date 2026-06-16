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

export type LeaseDocumentProjection = Omit<LeaseDocumentMetadata, "storageRef"> & {
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
  renderPrimaryLeasePdf(input: PrimaryLeaseDocumentInput): Promise<Buffer>;
};
