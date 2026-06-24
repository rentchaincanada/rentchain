import crypto from "crypto";
import {
  PROPERTY_MANAGER_COMPANY_AUDIT_EVENT_TYPES,
  PROPERTY_MANAGER_COMPANY_AUDIT_TARGET_RESOURCE_TYPES,
  type PropertyManagerCompanyAuditEvent,
  type PropertyManagerCompanyAuditEventType,
  type PropertyManagerCompanyAuditOutcome,
  type PropertyManagerCompanyAuditTargetResourceType,
  type PropertyManagerCompanyRelationshipScope,
  type PropertyManagerCompanyRole,
} from "./propertyManagerCompanyTypes";

type AuditInput = {
  eventId?: string;
  eventType: string;
  actorUserId: string;
  actorCompanyId?: string | null;
  actingForLandlordId?: string | null;
  relationshipId?: string | null;
  role?: PropertyManagerCompanyRole | null;
  scope?: PropertyManagerCompanyRelationshipScope | null;
  targetResourceType: PropertyManagerCompanyAuditTargetResourceType;
  targetResourceId?: string | null;
  outcome: PropertyManagerCompanyAuditOutcome;
  timestamp?: string;
  reason?: string | null;
};

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requireString(value: unknown, code: string, max = 500): string {
  const text = cleanString(value, max);
  if (!text) throw new Error(code);
  return text;
}

function normalizeTimestamp(value: unknown): string {
  const raw = cleanString(value, 120);
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function assertAuditEventType(value: string): PropertyManagerCompanyAuditEventType {
  if (!PROPERTY_MANAGER_COMPANY_AUDIT_EVENT_TYPES.includes(value as PropertyManagerCompanyAuditEventType)) {
    throw new Error("invalid_property_manager_company_audit_event_type");
  }
  return value as PropertyManagerCompanyAuditEventType;
}

function assertTargetResourceType(value: PropertyManagerCompanyAuditTargetResourceType): PropertyManagerCompanyAuditTargetResourceType {
  if (!PROPERTY_MANAGER_COMPANY_AUDIT_TARGET_RESOURCE_TYPES.includes(value)) {
    throw new Error("invalid_property_manager_company_audit_target_type");
  }
  return value;
}

function stableEventId(input: Omit<AuditInput, "eventId"> & { timestamp: string }): string {
  const digest = crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        input.eventType,
        input.actorUserId,
        input.actorCompanyId,
        input.actingForLandlordId,
        input.relationshipId,
        input.role,
        input.targetResourceType,
        input.targetResourceId,
        input.outcome,
        input.timestamp,
      ])
    )
    .digest("hex")
    .slice(0, 32);
  return `pm_company_audit_${digest}`;
}

export function buildPropertyManagerCompanyAuditEvent(input: AuditInput): PropertyManagerCompanyAuditEvent {
  const timestamp = normalizeTimestamp(input.timestamp);
  const normalizedInput = { ...input, timestamp };
  return {
    eventId: input.eventId || stableEventId(normalizedInput),
    eventType: assertAuditEventType(input.eventType),
    actorUserId: requireString(input.actorUserId, "missing_actor_user_id"),
    actorCompanyId: input.actorCompanyId ? cleanString(input.actorCompanyId, 200) : null,
    actingForLandlordId: input.actingForLandlordId ? cleanString(input.actingForLandlordId, 200) : null,
    relationshipId: input.relationshipId ? cleanString(input.relationshipId, 200) : null,
    role: input.role || null,
    scope: input.scope || null,
    targetResourceType: assertTargetResourceType(input.targetResourceType),
    targetResourceId: input.targetResourceId ? cleanString(input.targetResourceId, 300) : null,
    outcome: input.outcome,
    timestamp,
    reason: input.reason ? cleanString(input.reason, 500) : null,
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
  };
}
