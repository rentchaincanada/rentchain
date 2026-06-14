export type LeaseEvidencePackageSectionKey =
  | "cover_summary"
  | "lease_information"
  | "parties"
  | "timeline"
  | "documents"
  | "messages"
  | "payments"
  | "maintenance_events"
  | "notices"
  | "signature_events"
  | "audit_trail";

export type LeaseEvidencePackageItem = {
  label: string;
  description: string;
  timestamp: string | null;
  sourceCollection: string;
  sourceReference: string;
};

export type LeaseEvidencePackageSection = {
  key: LeaseEvidencePackageSectionKey;
  title: string;
  items: LeaseEvidencePackageItem[];
  emptyState: string;
};

export type LeaseEvidencePackageGovernance = {
  evidencePackageId: string;
  generatedBy: string;
  generatedAt: string;
  leaseId: string;
  landlordId: string;
  packageType: "lease_evidence_pdf";
  sourceReferences: Array<{
    sourceCollection: string;
    sourceReference: string;
  }>;
  auditReferences: Array<{
    sourceCollection: string;
    sourceReference: string;
  }>;
  sectionsIncluded: LeaseEvidencePackageSectionKey[];
};

export type LeaseEvidencePackage = {
  title: string;
  subtitle: string;
  governance: LeaseEvidencePackageGovernance;
  sections: LeaseEvidencePackageSection[];
};

