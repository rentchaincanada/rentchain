import { db } from "../../config/firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../../lib/events/eventTypes";

export type IdentityTimelineEventType =
  | "application.created"
  | "application.submitted"
  | "screening_consent_confirmed"
  | "screening.completed"
  | "lease.created"
  | "lease.activated"
  | "lease.tenant_signed";

export type IdentityTimeline = {
  events: Array<{
    type: IdentityTimelineEventType;
    label: string;
    description: string;
    occurredAt: string;
  }>;
};

export type DeriveIdentityTimelineInput = {
  tenantId: string;
  applicationId?: string | null;
  leaseId?: string | null;
};

const ALLOWED_EVENT_TYPES = new Set<string>([
  "application.created",
  "application.submitted",
  "screening_consent_confirmed",
  "screening.screening_consent_confirmed",
  "screening.completed",
  "lease.created",
  "lease.activated",
  "lease.tenant_signed",
]);

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function parseTimestamp(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeType(rawType: string): IdentityTimelineEventType | null {
  if (rawType === "screening.screening_consent_confirmed") {
    return "screening_consent_confirmed";
  }
  return ALLOWED_EVENT_TYPES.has(rawType) ? (rawType as IdentityTimelineEventType) : null;
}

function eventLabel(type: IdentityTimelineEventType): string {
  switch (type) {
    case "application.created":
      return "Application created";
    case "application.submitted":
      return "Application submitted";
    case "screening_consent_confirmed":
      return "Screening authorized";
    case "screening.completed":
      return "Screening completed";
    case "lease.created":
      return "Lease created";
    case "lease.activated":
      return "Lease activated";
    case "lease.tenant_signed":
      return "Lease signed";
    default:
      return "Activity recorded";
  }
}

function eventDescription(type: IdentityTimelineEventType): string {
  switch (type) {
    case "application.created":
      return "A rental application record was started.";
    case "application.submitted":
      return "Your rental application was submitted for review.";
    case "screening_consent_confirmed":
      return "Screening consent was recorded for this application.";
    case "screening.completed":
      return "Screening completed in the current workflow.";
    case "lease.created":
      return "A lease record was prepared for this tenancy.";
    case "lease.activated":
      return "The lease moved into its active workflow state.";
    case "lease.tenant_signed":
      return "Tenant lease signing was recorded.";
    default:
      return "Activity was recorded in the current workflow.";
  }
}

function metadataMatchesTenantScope(event: CanonicalEventV1, tenantId: string, applicationId: string) {
  const metadataTenantId = asString(event.metadata?.tenantId);
  const metadataApplicationId = asString(event.metadata?.applicationId);
  if (metadataTenantId && metadataTenantId !== tenantId) return false;
  if (metadataApplicationId && metadataApplicationId !== applicationId) return false;
  return true;
}

function matchesScope(event: CanonicalEventV1, tenantId: string, applicationId: string, leaseId: string) {
  const type = asString(event.type, 160);
  if (!ALLOWED_EVENT_TYPES.has(type)) return false;

  if (type.startsWith("application.")) {
    return Boolean(applicationId) && asString(event.resource?.id) === applicationId;
  }

  if (type === "screening_consent_confirmed" || type === "screening.screening_consent_confirmed" || type === "screening.completed") {
    if (!applicationId) return false;
    const resourceId = asString(event.resource?.id);
    const parentId = asString(event.resource?.parentId);
    if (resourceId !== applicationId && parentId !== applicationId) return false;
    return metadataMatchesTenantScope(event, tenantId, applicationId);
  }

  if (type.startsWith("lease.")) {
    if (!leaseId) return false;
    if (asString(event.resource?.id) !== leaseId) return false;
    const metadataTenantId = asString(event.metadata?.tenantId);
    if (metadataTenantId && metadataTenantId !== tenantId) return false;
    return true;
  }

  return false;
}

function compareEventsAscending(
  a: CanonicalEventV1 & { __normalizedOccurredAt: string },
  b: CanonicalEventV1 & { __normalizedOccurredAt: string }
) {
  const aTs = Date.parse(a.__normalizedOccurredAt);
  const bTs = Date.parse(b.__normalizedOccurredAt);
  if (aTs !== bTs) return aTs - bTs;
  return asString(a.id).localeCompare(asString(b.id));
}

export async function deriveIdentityTimeline(params: DeriveIdentityTimelineInput): Promise<IdentityTimeline> {
  const tenantId = asString(params.tenantId);
  const applicationId = asString(params.applicationId);
  const leaseId = asString(params.leaseId);

  if (!tenantId) {
    return { events: [] };
  }

  const snap = await db.collection(CANONICAL_EVENTS_COLLECTION).get().catch(() => ({ docs: [] } as any));
  const events: Array<
    CanonicalEventV1 & {
      __normalizedOccurredAt: string;
      __normalizedType: IdentityTimelineEventType;
    }
  > = (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as CanonicalEventV1)
    .filter((event: CanonicalEventV1) => matchesScope(event, tenantId, applicationId, leaseId))
    .map((event: CanonicalEventV1) => {
      const normalizedType = normalizeType(asString(event.type, 160));
      const occurredAt = parseTimestamp(event.occurredAt) || parseTimestamp(event.recordedAt);
      if (!normalizedType || !occurredAt) return null;
      return {
        ...event,
        __normalizedOccurredAt: occurredAt,
        __normalizedType: normalizedType,
      };
    })
    .filter(
      (
        event: (CanonicalEventV1 & {
          __normalizedOccurredAt: string;
          __normalizedType: IdentityTimelineEventType;
        }) | null
      ): event is CanonicalEventV1 & {
        __normalizedOccurredAt: string;
        __normalizedType: IdentityTimelineEventType;
      } => Boolean(event)
    )
    .sort(compareEventsAscending);

  return {
    events: events.map((event: CanonicalEventV1 & { __normalizedOccurredAt: string; __normalizedType: IdentityTimelineEventType }) => ({
      type: event.__normalizedType,
      label: eventLabel(event.__normalizedType),
      description: eventDescription(event.__normalizedType),
      occurredAt: event.__normalizedOccurredAt,
    })),
  };
}
