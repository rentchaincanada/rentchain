import { buildEvent } from "./buildEvent";
import type { CanonicalEventV1, CanonicalEventVisibility } from "./eventTypes";

function toIso(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return undefined;
}

function legacyVisibility(value: unknown): CanonicalEventVisibility {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "tenant" || normalized === "landlord" || normalized === "admin" || normalized === "system") {
    return normalized as CanonicalEventVisibility;
  }
  return "internal";
}

export function mapLegacyScreeningEventToCanonical(input: {
  id?: string;
  applicationId?: string | null;
  orderId?: string | null;
  landlordId?: string | null;
  type?: string | null;
  at?: number | string | null;
  actor?: string | null;
  meta?: Record<string, unknown> | null;
}): CanonicalEventV1 {
  const action = String(input.type || "legacy_event").trim().toLowerCase();
  const resourceId = String(input.applicationId || input.orderId || "").trim() || "unknown";
  return buildEvent({
    id: input.id,
    domain: "screening",
    action,
    actor: {
      type: input.actor === "admin" ? "admin" : input.actor === "landlord" ? "landlord" : "system",
      id: input.landlordId || null,
      role: input.actor || null,
    },
    resource: {
      type: input.applicationId ? "rental_application" : "screening_order",
      id: resourceId,
      parentType: input.applicationId && input.orderId ? "screening_order" : null,
      parentId: input.applicationId && input.orderId ? String(input.orderId) : null,
    },
    occurredAt: input.at || undefined,
    visibility: "internal",
    summary: `Legacy screening event: ${action.replace(/_/g, " ")}`,
    metadata: {
      legacyType: input.type || null,
      legacyMeta: input.meta || null,
      orderId: input.orderId || null,
      applicationId: input.applicationId || null,
    },
  });
}

export function mapLegacyAuditEventToCanonical(input: {
  id?: string;
  kind?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  timestamp?: string | null;
  summary?: string | null;
  detail?: string | null;
  meta?: Record<string, unknown> | null;
}): CanonicalEventV1 {
  const kind = String(input.kind || "system.info").trim().toLowerCase();
  const [domainCandidate, actionCandidate] = kind.includes(".")
    ? kind.split(".", 2)
    : ["system", "info"];
  const domain = domainCandidate === "application" || domainCandidate === "billing" || domainCandidate === "system"
    ? domainCandidate
    : "system";
  return buildEvent({
    id: input.id,
    domain,
    action: actionCandidate || "info",
    resource: {
      type: String(input.entityType || "entity").trim() || "entity",
      id: String(input.entityId || "unknown").trim() || "unknown",
    },
    occurredAt: input.timestamp || undefined,
    visibility: "internal",
    summary: String(input.summary || "Legacy audit event").trim() || "Legacy audit event",
    metadata: {
      detail: input.detail || null,
      legacyKind: input.kind || null,
      legacyMeta: input.meta || null,
    },
  });
}

export function mapLegacyActivityEventToCanonical(input: {
  id?: string;
  type?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  createdAt?: string | number | null;
  summary?: string | null;
  visibility?: string | null;
  metadata?: Record<string, unknown> | null;
}): CanonicalEventV1 {
  const action = String(input.type || "activity").trim().toLowerCase().replace(/\./g, "_");
  return buildEvent({
    id: input.id,
    domain: "system",
    action,
    actor: {
      type: input.actorType === "admin" ? "admin" : input.actorType === "tenant" ? "tenant" : "user",
      id: input.actorId || null,
      role: input.actorType || null,
    },
    resource: {
      type: input.unitId ? "unit" : "property",
      id: String(input.unitId || input.propertyId || "unknown").trim() || "unknown",
      parentType: input.unitId ? "property" : null,
      parentId: input.unitId ? String(input.propertyId || "").trim() || null : null,
    },
    occurredAt: input.createdAt || undefined,
    visibility: legacyVisibility(input.visibility),
    summary: String(input.summary || "Legacy activity event").trim() || "Legacy activity event",
    metadata: {
      propertyId: input.propertyId || null,
      unitId: input.unitId || null,
      legacyMetadata: input.metadata || null,
      legacyType: input.type || null,
    },
  });
}
