export type InstitutionalExportFormat = "pdf" | "csv" | "json";

export type InstitutionalExportReason =
  | "tribunal"
  | "court"
  | "insurance"
  | "lender"
  | "internal_review"
  | "other";

export type InstitutionalExportScope =
  | "lease_evidence_package"
  | "payments"
  | "maintenance"
  | "messages"
  | "notices"
  | "audit_trail";

export type InstitutionalExportResourceType = "lease";

export type InstitutionalExportRequest = {
  exportFormat: InstitutionalExportFormat;
  exportReason: InstitutionalExportReason;
  exportScope: InstitutionalExportScope;
  resourceType: InstitutionalExportResourceType;
  leaseId: string;
};

export type InstitutionalExportGovernanceMetadata = {
  exportId: string;
  exportType: "institutional_export";
  exportFormat: "pdf";
  exportReason: InstitutionalExportReason;
  exportScope: "lease_evidence_package";
  generatedBy: string;
  generatedAt: string;
  resourceType: "lease";
  resourceId: string;
  leaseId: string;
  sensitivity: "confidential";
  retentionCategory: "export_metadata";
  exportVersion: "institutional-export-framework-v1";
  evidencePackageId: string;
  manifestHash: string;
  manifestVersion: string;
  packageVersion: string;
};

export type InstitutionalLeaseEvidencePdfExport = {
  pdf: Buffer;
  filenamePrefix: string;
  metadata: InstitutionalExportGovernanceMetadata;
};
