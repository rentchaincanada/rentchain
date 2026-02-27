import type { AutomationEvent, AutomationEventType } from "./automationTimeline.types";

type DurationAggregate = {
  appToScreeningMedianHours?: number;
  screeningToLeaseMedianHours?: number;
};

export type TimelineAnalytics = {
  totalEvents: number;
  countsByType: Record<AutomationEventType, number>;
  lastActivityAt: string | null;
  payment30d: { count: number; sumCents: number };
  maintenance: { open: number; completed: number };
  funnels: DurationAggregate;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function toMillis(value?: string | null): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function isScreeningCompleted(event: AutomationEvent): boolean {
  if (event.type !== "SCREENING") return false;
  const title = String(event.title || "").toLowerCase();
  const summary = String(event.summary || "").toLowerCase();
  const status = String((event.metadata as any)?.status || "").toLowerCase();
  return (
    title.includes("completed") ||
    summary.includes("completed") ||
    status === "complete" ||
    status === "completed"
  );
}

function isApplicationCreated(event: AutomationEvent): boolean {
  if (event.type !== "TENANT") return false;
  const title = String(event.title || "").toLowerCase();
  const summary = String(event.summary || "").toLowerCase();
  return title.includes("application") || summary.includes("application");
}

function isLeaseEvent(event: AutomationEvent): boolean {
  if (event.type !== "LEASE") return false;
  const title = String(event.title || "").toLowerCase();
  const summary = String(event.summary || "").toLowerCase();
  return (
    title.includes("lease") ||
    title.includes("generated") ||
    title.includes("signed") ||
    summary.includes("lease")
  );
}

function extractAmountCents(event: AutomationEvent): number {
  const metadata = (event.metadata || {}) as Record<string, unknown>;
  const fromMeta =
    metadata.amountCents ?? metadata.amount_cents ?? metadata.amount ?? metadata.sumCents;
  if (typeof fromMeta === "number" && Number.isFinite(fromMeta)) {
    return fromMeta > 1000 ? Math.round(fromMeta) : Math.round(fromMeta * 100);
  }
  return 0;
}

function isMaintenanceEvent(event: AutomationEvent): boolean {
  if (event.type !== "PROPERTY" && event.type !== "SYSTEM") return false;
  const text = `${event.title || ""} ${event.summary || ""}`.toLowerCase();
  return text.includes("maintenance") || text.includes("action request");
}

export function computeTimelineAnalytics(events: AutomationEvent[]): TimelineAnalytics {
  const countsByType: Record<AutomationEventType, number> = {
    LEASE: 0,
    SCREENING: 0,
    PAYMENT: 0,
    MESSAGE: 0,
    PROPERTY: 0,
    TENANT: 0,
    SYSTEM: 0,
  };

  let lastActivityMs: number | null = null;
  let paymentCount30d = 0;
  let paymentSumCents30d = 0;
  let maintenanceOpen = 0;
  let maintenanceCompleted = 0;

  const appCreatedAt = new Map<string, number>();
  const appScreeningAt = new Map<string, number>();
  const screeningAtByLink = new Map<string, number>();
  const leaseAtByLink = new Map<string, number>();

  const now = Date.now();

  for (const event of events) {
    countsByType[event.type] += 1;

    const atMs = toMillis(event.occurredAt);
    if (atMs !== null && (lastActivityMs === null || atMs > lastActivityMs)) {
      lastActivityMs = atMs;
    }

    if (event.type === "PAYMENT" && atMs !== null && now - atMs <= 30 * MS_PER_DAY) {
      paymentCount30d += 1;
      paymentSumCents30d += extractAmountCents(event);
    }

    if (isMaintenanceEvent(event)) {
      const status = String((event.metadata as any)?.status || "").toLowerCase();
      const text = `${event.title || ""} ${event.summary || ""}`.toLowerCase();
      const done =
        status === "resolved" ||
        status === "complete" ||
        status === "completed" ||
        text.includes("resolved") ||
        text.includes("completed");
      if (done) {
        maintenanceCompleted += 1;
      } else {
        maintenanceOpen += 1;
      }
    }

    const appId = event.entity?.applicationId;
    if (appId && atMs !== null && isApplicationCreated(event) && !appCreatedAt.has(appId)) {
      appCreatedAt.set(appId, atMs);
    }

    if (appId && atMs !== null && isScreeningCompleted(event) && !appScreeningAt.has(appId)) {
      appScreeningAt.set(appId, atMs);
    }

    const linkId = event.entity?.applicationId || event.entity?.tenantId || event.entity?.leaseId;
    if (linkId && atMs !== null && isScreeningCompleted(event) && !screeningAtByLink.has(linkId)) {
      screeningAtByLink.set(linkId, atMs);
    }
    if (linkId && atMs !== null && isLeaseEvent(event) && !leaseAtByLink.has(linkId)) {
      leaseAtByLink.set(linkId, atMs);
    }
  }

  const appToScreeningHours: number[] = [];
  for (const [appId, createdMs] of appCreatedAt.entries()) {
    const screenedMs = appScreeningAt.get(appId);
    if (screenedMs && screenedMs >= createdMs) {
      appToScreeningHours.push((screenedMs - createdMs) / MS_PER_HOUR);
    }
  }

  const screeningToLeaseHours: number[] = [];
  for (const [linkId, screeningMs] of screeningAtByLink.entries()) {
    const leaseMs = leaseAtByLink.get(linkId);
    if (leaseMs && leaseMs >= screeningMs) {
      screeningToLeaseHours.push((leaseMs - screeningMs) / MS_PER_HOUR);
    }
  }

  return {
    totalEvents: events.length,
    countsByType,
    lastActivityAt: lastActivityMs ? new Date(lastActivityMs).toISOString() : null,
    payment30d: {
      count: paymentCount30d,
      sumCents: paymentSumCents30d,
    },
    maintenance: {
      open: maintenanceOpen,
      completed: maintenanceCompleted,
    },
    funnels: {
      appToScreeningMedianHours: median(appToScreeningHours),
      screeningToLeaseMedianHours: median(screeningToLeaseHours),
    },
  };
}
