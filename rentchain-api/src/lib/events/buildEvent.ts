import crypto from "crypto";
import { db } from "../../config/firebase";
import { normalizeEventVisibility } from "./eventVisibility";
import type {
  CanonicalEventActorType,
  CanonicalEventDomain,
  CanonicalEventV1,
  CanonicalEventVisibility,
} from "./eventTypes";

export const CANONICAL_EVENTS_COLLECTION = "canonicalEvents";

const ALLOWED_DOMAINS = new Set<CanonicalEventDomain>([
  "application",
  "screening",
  "lease",
  "maintenance",
  "expense",
  "tenant",
  "billing",
  "payment",
  "policy",
  "system",
]);

type CanonicalEventInput = {
  id?: string;
  type?: string;
  domain: CanonicalEventDomain;
  action: string;
  status?: string | null;
  actor?: {
    type?: CanonicalEventActorType;
    id?: string | null;
    role?: string | null;
    displayName?: string | null;
  } | null;
  resource?: {
    type?: string | null;
    id?: string | null;
    parentType?: string | null;
    parentId?: string | null;
  } | null;
  occurredAt?: string | number | Date | null;
  visibility?: CanonicalEventVisibility | string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  metrics?: Record<string, number | null>;
  tags?: string[];
};

function toIsoTimestamp(value: string | number | Date | null | undefined, fallback: Date): string {
  if (value == null) return fallback.toISOString();
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? value.toISOString() : fallback.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  const raw = String(value).trim();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback.toISOString();
}

function normalizeActor(input: CanonicalEventInput["actor"]): CanonicalEventV1["actor"] {
  return {
    type: input?.type,
    id: input?.id == null ? null : String(input.id).trim() || null,
    role: input?.role == null ? null : String(input.role).trim() || null,
    displayName: input?.displayName == null ? null : String(input.displayName).trim() || null,
  };
}

function normalizeResource(input: CanonicalEventInput["resource"]): CanonicalEventV1["resource"] {
  const type = String(input?.type || "")
    .trim()
    .slice(0, 120);
  const id = String(input?.id || "")
    .trim()
    .slice(0, 240);
  if (!type || !id) {
    throw new Error("canonical_event_resource_required");
  }
  return {
    type,
    id,
    parentType: input?.parentType == null ? null : String(input.parentType).trim() || null,
    parentId: input?.parentId == null ? null : String(input.parentId).trim() || null,
  };
}

export function buildEvent(input: CanonicalEventInput): CanonicalEventV1 {
  const domain = String(input.domain || "").trim() as CanonicalEventDomain;
  if (!ALLOWED_DOMAINS.has(domain)) {
    throw new Error("canonical_event_domain_invalid");
  }
  const action = String(input.action || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!action) {
    throw new Error("canonical_event_action_required");
  }
  const summary = String(input.summary || "").trim();
  if (!summary) {
    throw new Error("canonical_event_summary_required");
  }

  const now = new Date();
  const event: CanonicalEventV1 = {
    id: String(input.id || "").trim() || crypto.randomUUID(),
    version: "v1",
    type: String(input.type || "").trim() || `${domain}.${action}`,
    domain,
    action,
    status: input.status == null ? null : String(input.status).trim() || null,
    actor: normalizeActor(input.actor),
    resource: normalizeResource(input.resource),
    occurredAt: toIsoTimestamp(input.occurredAt, now),
    recordedAt: now.toISOString(),
    visibility: normalizeEventVisibility(input.visibility),
    summary,
    metadata: input.metadata || undefined,
    metrics: input.metrics || undefined,
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : undefined,
  };

  return event;
}

export async function writeCanonicalEvent(input: CanonicalEventInput): Promise<CanonicalEventV1> {
  const event = buildEvent(input);
  await db.collection(CANONICAL_EVENTS_COLLECTION).doc(event.id).set(event, { merge: false });
  return event;
}
