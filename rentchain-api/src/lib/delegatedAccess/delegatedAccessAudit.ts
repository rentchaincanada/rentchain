import crypto from "crypto";
import {
  DELEGATED_ACCESS_AUDIT_EVENT_TYPES,
  type DelegatedAccessAuditEvent,
  type DelegatedAccessAuditEventType,
  type DelegatedAccessAuditOutcome,
  type DelegatedAccessPermissionScope,
  type DelegatedAccessRole,
  type DelegatedAccessTargetResourceType,
} from "./delegatedAccessTypes";

type AuditInput = {
  eventId?: string;
  eventType: string;
  actorUserId: string;
  actingForLandlordId: string;
  delegatedRole?: DelegatedAccessRole | "landlord_owner" | null;
  permissionScope?: DelegatedAccessPermissionScope | null;
  sessionId?: string | null;
  actionType: string;
  targetResourceType: DelegatedAccessTargetResourceType;
  targetResourceId?: string | null;
  timestamp?: string;
  ipAddress?: string | null;
  deviceMetadata?: Record<string, string> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  outcome: DelegatedAccessAuditOutcome;
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

function assertAuditEventType(value: string): DelegatedAccessAuditEventType {
  if (!DELEGATED_ACCESS_AUDIT_EVENT_TYPES.includes(value as DelegatedAccessAuditEventType)) {
    throw new Error("invalid_delegated_audit_event_type");
  }
  return value as DelegatedAccessAuditEventType;
}

function stableEventId(input: Omit<AuditInput, "eventId"> & { timestamp: string }): string {
  const digest = crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        input.eventType,
        input.actorUserId,
        input.actingForLandlordId,
        input.delegatedRole,
        input.actionType,
        input.targetResourceType,
        input.targetResourceId,
        input.timestamp,
        input.outcome,
      ])
    )
    .digest("hex")
    .slice(0, 32);
  return `delegated_audit_${digest}`;
}

function normalizeDeviceMetadata(value: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!value) return null;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [cleanString(key, 80), cleanString(entry, 300)] as const)
      .filter(([key, entry]) => key && entry)
  );
}

export function buildDelegatedAccessAuditEvent(input: AuditInput): DelegatedAccessAuditEvent {
  const timestamp = normalizeTimestamp(input.timestamp);
  const normalizedInput = { ...input, timestamp };
  return {
    eventId: input.eventId || stableEventId(normalizedInput),
    eventType: assertAuditEventType(input.eventType),
    actorUserId: requireString(input.actorUserId, "missing_actor_user_id"),
    actingForLandlordId: requireString(input.actingForLandlordId, "missing_acting_for_landlord_id"),
    delegatedRole: input.delegatedRole || null,
    permissionScope: input.permissionScope || null,
    sessionId: input.sessionId ? cleanString(input.sessionId, 200) : null,
    actionType: requireString(input.actionType, "missing_action_type", 160),
    targetResourceType: input.targetResourceType,
    targetResourceId: input.targetResourceId ? cleanString(input.targetResourceId, 300) : null,
    timestamp,
    ipAddress: input.ipAddress ? cleanString(input.ipAddress, 120) : null,
    deviceMetadata: normalizeDeviceMetadata(input.deviceMetadata),
    before: input.before || null,
    after: input.after || null,
    outcome: input.outcome,
    reason: input.reason ? cleanString(input.reason, 500) : null,
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
  };
}
