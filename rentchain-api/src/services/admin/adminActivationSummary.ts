import { db } from "../../firebase";

export const ACTIVATION_EVENT_NAMES = [
  "activation_property_created",
  "activation_unit_created",
  "activation_tenant_added",
  "activation_work_order_created",
] as const;

type ActivationEventName = (typeof ACTIVATION_EVENT_NAMES)[number];

type ActivationEventProps = {
  surface?: unknown;
  source?: unknown;
  plan?: unknown;
  route?: unknown;
};

type ActivationEventRow = {
  name: ActivationEventName;
  ts: number;
  props: ActivationEventProps;
  userId: string | null;
  sessionId: string | null;
};

export type ActivationSummaryPayload = {
  window: {
    days: number;
    from: string;
    to: string;
  };
  activationEvents: {
    property_created: number;
    unit_created: number;
    tenant_added: number;
    work_order_created: number;
  };
  activatedUsers: number;
  activationRateEstimate: number | null;
  breakdowns: {
    byEventName: Record<string, number>;
    byPlan: Record<string, number>;
    bySurface: Record<string, number>;
  };
  insights: {
    mostCommonActivationEvent: {
      eventName: string | null;
      count: number;
    };
    planSeeingActivation: {
      plan: string | null;
      count: number;
    };
    activationOccurring: boolean;
  };
};

const ACTIVATION_EVENT_SET = new Set<string>(ACTIVATION_EVENT_NAMES);

function clampDays(input: unknown) {
  const value = Number(input);
  if (!Number.isFinite(value)) return 30;
  return Math.min(Math.max(Math.round(value), 1), 90);
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isActivationEvent(data: any): data is {
  name: ActivationEventName;
  ts: number;
  props: ActivationEventProps;
  userId?: unknown;
  sessionId?: unknown;
} {
  if (!ACTIVATION_EVENT_SET.has(String(data?.name || ""))) return false;
  if (toNumber(data?.ts) == null) return false;
  if (!isPlainObject(data?.props)) return false;
  return true;
}

function toActivationRow(data: any): ActivationEventRow | null {
  if (!isActivationEvent(data)) return null;
  return {
    name: data.name,
    ts: Number(data.ts),
    props: data.props,
    userId: toOptionalString(data.userId),
    sessionId: toOptionalString(data.sessionId),
  };
}

function toBreakdownKey(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function incrementBucket(bucket: Record<string, number>, key: string | null) {
  if (!key) return;
  bucket[key] = (bucket[key] || 0) + 1;
}

function actorKey(row: ActivationEventRow) {
  if (row.userId) return `user:${row.userId}`;
  if (row.sessionId) return `session:${row.sessionId}`;
  return null;
}

function topBucket(bucket: Record<string, number>) {
  const entries = Object.entries(bucket);
  if (!entries.length) return null;
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return { key: entries[0][0], count: entries[0][1] };
}

export async function loadAdminActivationSummary(params?: {
  days?: number | string;
}): Promise<ActivationSummaryPayload> {
  const days = clampDays(params?.days);
  const to = Date.now();
  const from = to - days * 24 * 60 * 60 * 1000;

  const snapshot = await db
    .collection("events")
    .where("ts", ">=", from)
    .where("ts", "<=", to)
    .get();

  const activationRows = (snapshot.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
    .map(toActivationRow)
    .filter((row): row is ActivationEventRow => row != null);

  const activationEvents = {
    property_created: 0,
    unit_created: 0,
    tenant_added: 0,
    work_order_created: 0,
  };
  const byEventName: Record<string, number> = {};
  const byPlan: Record<string, number> = {};
  const bySurface: Record<string, number> = {};
  const activatedActorKeys = new Set<string>();
  const trackedActorKeys = new Set<string>();

  for (const doc of snapshot.docs || []) {
    const raw = doc.data() || {};
    const key =
      toOptionalString(raw.userId) ? `user:${toOptionalString(raw.userId)}` :
      toOptionalString(raw.sessionId) ? `session:${toOptionalString(raw.sessionId)}` :
      null;
    if (key) trackedActorKeys.add(key);
  }

  for (const row of activationRows) {
    if (row.name === "activation_property_created") activationEvents.property_created += 1;
    if (row.name === "activation_unit_created") activationEvents.unit_created += 1;
    if (row.name === "activation_tenant_added") activationEvents.tenant_added += 1;
    if (row.name === "activation_work_order_created") activationEvents.work_order_created += 1;

    incrementBucket(byEventName, row.name);
    incrementBucket(byPlan, toBreakdownKey(row.props.plan));
    incrementBucket(bySurface, toBreakdownKey(row.props.surface));
    const key = actorKey(row);
    if (key) activatedActorKeys.add(key);
  }

  const mostCommonActivationEvent = topBucket(byEventName);
  const planSeeingActivation = topBucket(byPlan);
  const activatedUsers = activatedActorKeys.size;
  const activationRateEstimate =
    trackedActorKeys.size > 0 ? activatedUsers / trackedActorKeys.size : null;

  return {
    window: {
      days,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    },
    activationEvents,
    activatedUsers,
    activationRateEstimate,
    breakdowns: {
      byEventName,
      byPlan,
      bySurface,
    },
    insights: {
      mostCommonActivationEvent: {
        eventName: mostCommonActivationEvent?.key || null,
        count: mostCommonActivationEvent?.count || 0,
      },
      planSeeingActivation: {
        plan: planSeeingActivation?.key || null,
        count: planSeeingActivation?.count || 0,
      },
      activationOccurring: activationRows.length > 0,
    },
  };
}
