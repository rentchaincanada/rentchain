export const EXPORT_AUDIT_EVENT_TYPES = [
  "ExportProfileCreated",
  "ExportProfileArchived",
  "ExportProfileModified",
  "ExportRequestInitiated",
  "ExportRequestAuthorized",
  "ExportRequestDenied",
  "ExportRequestCancelled",
  "ExportPackageAssembled",
  "ExportPackageSigned",
  "ExportPackageDelivered",
  "ExportPackageArchived",
  "ExportPackageRevoked",
] as const;

export type ExportAuditEventType = (typeof EXPORT_AUDIT_EVENT_TYPES)[number];

export const EXPORT_AUDIT_TARGET_TYPES = ["ExportProfile", "ExportRequest", "ExportPackage"] as const;

export type ExportAuditTargetType = (typeof EXPORT_AUDIT_TARGET_TYPES)[number];

export type ExportAuditActorRole = "LandlordAdmin" | "PropertyManager" | "AdminSupport" | "SystemService";

export type ExportAuditEvent = {
  auditEventId: string;
  eventType: ExportAuditEventType;
  timestamp: string;
  actor: string;
  actorRole: ExportAuditActorRole;
  targetType: ExportAuditTargetType;
  targetId: string;
  landlordId: string;
  eventDetails: Record<string, string | number | boolean | null>;
  rawIdsIncluded: false;
  payloadIncluded: false;
};
