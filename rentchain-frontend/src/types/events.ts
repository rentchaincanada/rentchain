export type AuditEntityType =
  | "tenant"
  | "property"
  | "application"
  | "payment"
  | "system";

export type AuditEventKind =
  | "application.status_changed"
  | "application.converted_to_tenant"
  | "tenant.payment_edited"
  | "tenant.payment_deleted"
  | "ledger.adjustment"
  | "system.info";

export type AuditEvent = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;

  tenantId?: string | null;
  propertyId?: string | null;
  applicationId?: string | null;
  paymentId?: string | null;

  kind: AuditEventKind;
  timestamp: string;
  summary: string;
  detail?: string | null;
  meta?: Record<string, any> | null;
};
