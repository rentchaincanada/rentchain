import type { EvidenceClass } from "./evidence-record-types";
import type { ExportPurpose, ExportRecipientType } from "./export-recipient-types";
import type { ExportDataMinimizationLevel } from "./export-profile-types";

export const EXPORT_PACKAGE_STATUSES = ["Assembled", "Signed", "Delivered", "Archived", "Revoked"] as const;

export type ExportPackageStatus = (typeof EXPORT_PACKAGE_STATUSES)[number];

export const EXPORT_DELIVERY_METHODS = ["Email", "SecurePortal", "DirectAPI", "SecureDropbox"] as const;

export type ExportDeliveryMethod = (typeof EXPORT_DELIVERY_METHODS)[number];

export type ExportPackageMetadata = {
  assembledAt: string;
  assembledBy: string;
  assemblyVersion: string;
  includedEvidenceCount: number;
  totalPackageSize: number;
  checksumAlgorithm: "sha256";
  checksumValue?: string | null;
};

export type ExportEvidenceManifest = {
  evidenceClasses: EvidenceClass[];
  dateRangeApplied: {
    start: string | null;
    end: string | null;
  };
  unitsScopeApplied: string[];
  redactionPolicyApplied: ExportDataMinimizationLevel;
  excludedEvidence?: Array<{
    evidenceId: string;
    reason: string;
  }>;
};

export type ExportSignatureMetadata = {
  isSigned: boolean;
  signatureAlgorithm?: string | null;
  signedAt?: string | null;
  signatureReference?: string | null;
};

export type ExportDeliveryMetadata = {
  deliveryMethod?: ExportDeliveryMethod | null;
  deliveryAddress?: string | null;
  deliveredAt?: string | null;
};

export type ExportPackage = {
  exportPackageId: string;
  exportRequestId: string;
  landlordId: string;
  recipientType: ExportRecipientType;
  purpose: ExportPurpose;
  packageMetadata: ExportPackageMetadata;
  evidenceManifest: ExportEvidenceManifest;
  signatureMetadata?: ExportSignatureMetadata | null;
  deliveryMetadata?: ExportDeliveryMetadata | null;
  status: ExportPackageStatus;
  auditTrailReference: string;
  metadata: Record<string, string | number | boolean | null>;
  rawIdsIncluded: false;
  payloadIncluded: false;
};
