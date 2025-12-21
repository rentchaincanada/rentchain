export type AuditEventType =
  | "application_converted"
  | "screening_triggered"
  | "screening_blocked_no_credits";

export interface AuditEvent {
  id: string;
  landlordId: string;
  actorUserId?: string;
  type: AuditEventType;
  applicationId?: string;
  tenantId?: string;
  propertyId?: string;
  screeningId?: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}
