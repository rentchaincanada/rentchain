export const EXPORT_RECIPIENT_TYPES = [
  "ThirdPartyPropertyManager",
  "InsuranceAdjuster",
  "LegalRepresentative",
  "Regulator",
  "Arbitrator",
  "SelfArchive",
  "ReservedFutureInstitution",
] as const;

export type ExportRecipientType = (typeof EXPORT_RECIPIENT_TYPES)[number];

export const EXPORT_PURPOSES = [
  "LitigationDiscovery",
  "InsuranceClaim",
  "RegulatoryCompliance",
  "AuditReview",
  "ArbitrationEvidence",
  "SelfReview",
  "ReservedFuturePurpose",
] as const;

export type ExportPurpose = (typeof EXPORT_PURPOSES)[number];

export const EXPORT_PURPOSE_RECIPIENTS: Readonly<Record<ExportPurpose, readonly ExportRecipientType[]>> = {
  LitigationDiscovery: ["LegalRepresentative"],
  InsuranceClaim: ["InsuranceAdjuster"],
  RegulatoryCompliance: ["Regulator"],
  AuditReview: ["ThirdPartyPropertyManager", "Regulator"],
  ArbitrationEvidence: ["Arbitrator", "LegalRepresentative"],
  SelfReview: ["SelfArchive"],
  ReservedFuturePurpose: ["ReservedFutureInstitution"],
};

export function isExportRecipientType(value: unknown): value is ExportRecipientType {
  return EXPORT_RECIPIENT_TYPES.includes(value as ExportRecipientType);
}

export function isExportPurpose(value: unknown): value is ExportPurpose {
  return EXPORT_PURPOSES.includes(value as ExportPurpose);
}

export function isPurposeAllowedForRecipient(purpose: ExportPurpose, recipientType: ExportRecipientType): boolean {
  return EXPORT_PURPOSE_RECIPIENTS[purpose].includes(recipientType);
}
