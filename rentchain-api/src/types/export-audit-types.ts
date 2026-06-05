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
  "ExportPackageSignatureRequested",
  "ExportPackageSignatureGenerated",
  "ExportPackageSignatureVerified",
  "ExportPackageAttestationLinked",
  "ExportPackageAttestationRevoked",
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

export type ExportAuditEventSafeReference = {
  auditEventId: string;
  eventType: ExportAuditEventType;
  timestamp: string;
  actor: {
    actorRef: string;
    actorRole: ExportAuditActorRole;
    rawIdsIncluded: false;
  };
  target: {
    targetRef: string;
    targetType: ExportAuditTargetType;
    rawIdsIncluded: false;
  };
  landlordRef: string;
  statusSummary: string;
  reason: string | null;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type ExportAuditEventPayload = {
  eventId: string;
  eventType: ExportAuditEventType;
  timestamp: string;
  actor: {
    role: ExportAuditActorRole;
    operatorRef: string;
    rawIdsIncluded: false;
  };
  authority: {
    role: ExportAuditActorRole;
    landlordRef: string;
    supportAllowed: boolean;
    rawIdsIncluded: false;
  };
  sourceReferenceId: string;
  targetType: ExportAuditTargetType;
  targetReferenceId: string;
  landlordReferenceId: string;
  metadata: {
    eventSummary: string;
    statusSummary: string;
    reason: string | null;
    details: Record<string, string | number | boolean | null>;
    metadataOnly: true;
    rawIdsIncluded: false;
    payloadIncluded: false;
  };
  sourceCollection: "canonicalEvents";
  visibility: "admin_support_internal" | "landlord_operator_internal";
  metadataOnly: true;
  appendOnly: true;
  immutable: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
  redactionSummary: string;
};

export type ExportAttestationAuditDetails = {
  attestationRef: string;
  signatureRef: string | null;
  certificateRef: string | null;
  signatureAlgorithm: "RSA-SHA256" | "ECDSA-SHA256" | null;
  contentHash: string | null;
  lifecycleState:
    | "SignatureRequested"
    | "SignatureGenerated"
    | "SignatureVerified"
    | "AttestationLinked"
    | "AttestationRevoked";
  linkedEvidenceRef: string | null;
  metadataOnly: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type ExportAuditTrailResponse = {
  auditEventId: string;
  eventType: ExportAuditEventType;
  timestamp: string;
  actor: ExportAuditEventSafeReference["actor"];
  targetType: ExportAuditTargetType;
  targetId: string;
  reason: string | null;
  eventSummary: string;
  auditTimestamp: string;
  rawIdsIncluded: false;
  payloadIncluded: false;
};
