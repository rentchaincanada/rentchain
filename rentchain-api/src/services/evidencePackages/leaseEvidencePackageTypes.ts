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
  verification?: LeaseEvidencePackageVerificationMetadata;
};

export type LeaseEvidencePackage = {
  title: string;
  subtitle: string;
  governance: LeaseEvidencePackageGovernance;
  sections: LeaseEvidencePackageSection[];
};

export type LeaseEvidencePackageSectionSourceCount = {
  sectionKey: LeaseEvidencePackageSectionKey;
  itemCount: number;
  sourceCollections: string[];
};

export type LeaseEvidencePackageSourceManifest = {
  totalSourceReferences: number;
  sourceCollections: string[];
  sourceCountsByCollection: Record<string, number>;
  sectionSourceCounts: LeaseEvidencePackageSectionSourceCount[];
};

export type LeaseEvidencePackageManifest = {
  manifestVersion: "lease_evidence_manifest_v1";
  packageVersion: "lease-evidence-package-pdf-v1";
  evidencePackageId: string;
  leaseId: string;
  landlordId: string;
  packageType: "lease_evidence_pdf";
  generatedAt: string;
  generatedBy: {
    actorType: "landlord";
    actorId: string;
  };
  sectionsIncluded: LeaseEvidencePackageSectionKey[];
  sourceManifest: LeaseEvidencePackageSourceManifest;
};

export type LeaseEvidencePackageVerificationMetadata = {
  manifestVersion: LeaseEvidencePackageManifest["manifestVersion"];
  hashAlgorithm: "sha256";
  manifestHash: string;
  packageVersion: LeaseEvidencePackageManifest["packageVersion"];
  evidencePackageId: string;
  generatedAt: string;
  sourceReferenceCount: number;
  sourceCollections: string[];
  sectionSourceCounts: LeaseEvidencePackageSectionSourceCount[];
};
