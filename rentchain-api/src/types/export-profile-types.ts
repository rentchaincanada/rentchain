import type { EvidenceClass, EvidenceRetentionPolicyVersion } from "./evidence-record-types";
import type { ExportPurpose, ExportRecipientType } from "./export-recipient-types";

export const EXPORT_DATA_MINIMIZATION_LEVELS = ["Full", "Redacted", "RedactedSensitive"] as const;

export type ExportDataMinimizationLevel = (typeof EXPORT_DATA_MINIMIZATION_LEVELS)[number];

export type ExportProfileMetadata = Record<string, string | number | boolean | null>;

export type ExportCreatedBy = {
  actorRef: string;
  actorRole: "LandlordAdmin" | "PropertyManager" | "AdminSupport" | "SystemService";
  rawIdsIncluded: false;
};

export type ExportProfile = {
  exportProfileId: string;
  landlordId: string;
  recipientType: ExportRecipientType;
  recipientName: string;
  recipientSafeReference: string;
  purpose: ExportPurpose;
  description: string;
  approvedEvidenceClasses: EvidenceClass[];
  excludedUnitIds: string[];
  dataMinimizationLevel: ExportDataMinimizationLevel;
  retentionPolicyVersion: EvidenceRetentionPolicyVersion;
  createdAt: string;
  createdBy: ExportCreatedBy;
  createdReason: string;
  isActive: boolean;
  auditTrailReference: string;
  metadata: ExportProfileMetadata;
  rawIdsIncluded: false;
  payloadIncluded: false;
};
