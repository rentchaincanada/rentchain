import { listActionRequests } from "@/api/actionRequestsApi";
import { listLedgerV2 } from "@/api/ledgerV2";
import { getLeasesForProperty } from "@/api/leasesApi";
import { fetchLandlordConversations } from "@/api/messagesApi";
import { fetchPayments } from "@/api/paymentsApi";
import { fetchRentalApplications, fetchScreening } from "@/api/rentalApplicationsApi";
import { getBureauAdapter } from "@/bureau";
import type { NormalizedScreeningEvent } from "@/bureau";
import type { AutomationEvent } from "./automationTimeline.types";
import {
  buildEventFingerprint,
  getTimelineSourceKey,
  getTimelineSourcePriority,
  normalizeActionRequests,
  normalizeConversations,
  normalizeLedgerV2Events,
  normalizeLeases,
  normalizePayments,
  normalizeRentalApplicationSummary,
  normalizeScreeningPipeline,
} from "./timelineNormalizers";

export type TimelineSourceReportItem = {
  source: string;
  ok: boolean;
  ms: number;
  count: number;
  errorCode?: "unauthorized" | "forbidden" | "not_found" | "timeout" | "network" | "unknown";
};

type SourceMeta = { tried: string[]; ok: string[]; report: TimelineSourceReportItem[] };

export const MAX_EVENTS_TOTAL = 200;
export const MAX_APPS = 25;
export const MAX_SCREENING_LOOKUPS = 10;
export const MAX_PAYMENTS = 50;
export const MAX_MESSAGES = 50;
export const MAX_ACTION_REQUESTS = 50;
const MAX_LEASE_PROPERTIES = 10;
const LEDGER_FETCH_LIMIT = 60;

const toMs = (input: unknown): number => {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input < 1e12 ? input * 1000 : input;
  }
  if (typeof input === "string" && input.trim()) {
    const parsed = new Date(input).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

const sortByTimeDesc = <T>(items: T[], readTime: (item: T) => unknown): T[] =>
  [...items].sort((a, b) => toMs(readTime(b)) - toMs(readTime(a)));

const cap = <T>(items: T[], limit: number): T[] => (limit > 0 ? items.slice(0, limit) : []);
const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const classifyError = (
  error: unknown
): "unauthorized" | "forbidden" | "not_found" | "timeout" | "network" | "unknown" => {
  const message = String((error as any)?.message || "").toLowerCase();
  if (message.includes("401") || message.includes("unauthorized")) return "unauthorized";
  if (message.includes("403") || message.includes("forbidden")) return "forbidden";
  if (message.includes("404") || message.includes("not found")) return "not_found";
  if (message.includes("timeout") || message.includes("408")) return "timeout";
  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch error") ||
    message.includes("ecconn")
  ) {
    return "network";
  }
  return "unknown";
};

const normalizeBureauEvent = (event: NormalizedScreeningEvent): AutomationEvent => ({
  id: `bureau:${event.provider}:${event.requestId}:${event.status}`,
  type: "SCREENING",
  occurredAt: event.occurredAt || new Date().toISOString(),
  title: `Screening ${String(event.status).replaceAll("_", " ")}`,
  summary: event.summary,
  entity: {
    propertyId: event.propertyId,
    tenantId: event.tenantId,
    applicationId: event.applicationId,
  },
  metadata: {
    source: "bureauAdapter.listScreeningsForLandlord",
    provider: event.provider,
    ...(event.metadata || {}),
  },
});

export async function getTimelineEventsForLandlord(
  landlordId: string
): Promise<{ events: AutomationEvent[]; sources: SourceMeta }> {
  if (!landlordId) {
    return { events: [], sources: { tried: [], ok: [], report: [] } };
  }

  const tried: string[] = [];
  const ok: string[] = [];
  const report: TimelineSourceReportItem[] = [];
  const events: AutomationEvent[] = [];
  const propertyLastActivity = new Map<string, number>();

  const rememberProperty = (propertyId: unknown, occurredAt: unknown) => {
    const key = String(propertyId || "").trim();
    if (!key) return;
    const ts = toMs(occurredAt);
    const existing = propertyLastActivity.get(key) || 0;
    if (ts > existing) propertyLastActivity.set(key, ts);
  };

  const markFailure = (source: string, error: unknown, ms: number) => {
    report.push({ source, ok: false, ms, count: 0, errorCode: classifyError(error) });
    if (import.meta.env.DEV) {
      console.debug("[timeline] source failed", {
        source,
        errorCode: classifyError(error),
        ms,
      });
    }
  };

  const applicationsSource = "rentalApplications";
  tried.push(applicationsSource);
  const applicationsStart = nowMs();
  let applicationsCount = 0;
  let limitedApplications: any[] = [];
  try {
    const applications = sortByTimeDesc(await fetchRentalApplications(), (application) => application.submittedAt);
    limitedApplications = cap(applications, MAX_APPS);
    if (Array.isArray(limitedApplications) && limitedApplications.length > 0) {
      ok.push(applicationsSource);
      applicationsCount = limitedApplications.length;
      events.push(...normalizeRentalApplicationSummary(limitedApplications));
      for (const application of limitedApplications) {
        rememberProperty(application.propertyId, application.submittedAt);
      }
    }
    report.push({
      source: applicationsSource,
      ok: true,
      ms: Math.round(nowMs() - applicationsStart),
      count: applicationsCount,
    });
  } catch (error) {
    markFailure(applicationsSource, error, Math.round(nowMs() - applicationsStart));
  }

  const screeningSource = "screeningPipeline";
  tried.push(screeningSource);
  const screeningStart = nowMs();
  let screeningCount = 0;
  try {
    const screeningTargets = cap(limitedApplications, MAX_SCREENING_LOOKUPS);
    for (const application of screeningTargets) {
      const screening = await fetchScreening(application.id);
      if (screening?.ok && screening.screening) {
        events.push(...normalizeScreeningPipeline(application.id, screening.screening));
        screeningCount += 1;
      }
    }
    if (screeningCount > 0) ok.push(screeningSource);
    report.push({
      source: screeningSource,
      ok: true,
      ms: Math.round(nowMs() - screeningStart),
      count: screeningCount,
    });
  } catch (error) {
    markFailure(screeningSource, error, Math.round(nowMs() - screeningStart));
  }

  const paymentsSource = "payments";
  tried.push(paymentsSource);
  const paymentsStart = nowMs();
  let paymentsCount = 0;
  try {
    const payments = sortByTimeDesc(await fetchPayments(), (payment) => payment.paidAt || payment.updatedAt || payment.createdAt);
    const limitedPayments = cap(payments, MAX_PAYMENTS);
    if (Array.isArray(limitedPayments) && limitedPayments.length > 0) {
      ok.push(paymentsSource);
      paymentsCount = limitedPayments.length;
      events.push(...normalizePayments(limitedPayments));
      for (const payment of limitedPayments) {
        rememberProperty(payment.propertyId, payment.paidAt || payment.updatedAt || payment.createdAt);
      }
    }
    report.push({
      source: paymentsSource,
      ok: true,
      ms: Math.round(nowMs() - paymentsStart),
      count: paymentsCount,
    });
  } catch (error) {
    markFailure(paymentsSource, error, Math.round(nowMs() - paymentsStart));
  }

  const leasesSource = "leases";
  const leasePropertyIds = Array.from(propertyLastActivity.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LEASE_PROPERTIES)
    .map(([propertyId]) => propertyId);
  tried.push(leasesSource);
  const leasesStart = nowMs();
  let leasesCount = 0;
  try {
    for (const propertyId of leasePropertyIds) {
      const response = await getLeasesForProperty(propertyId);
      if (Array.isArray(response?.leases) && response.leases.length > 0) {
        events.push(...normalizeLeases(response.leases));
        leasesCount += response.leases.length;
      }
    }
    if (leasesCount > 0) ok.push(leasesSource);
    report.push({
      source: leasesSource,
      ok: true,
      ms: Math.round(nowMs() - leasesStart),
      count: leasesCount,
    });
  } catch (error) {
    markFailure(leasesSource, error, Math.round(nowMs() - leasesStart));
  }

  const messagesSource = "messages";
  tried.push(messagesSource);
  const messagesStart = nowMs();
  let messagesCount = 0;
  try {
    const conversations = sortByTimeDesc(await fetchLandlordConversations(), (conversation) => conversation.lastMessageAt || conversation.createdAt);
    const limitedConversations = cap(conversations, MAX_MESSAGES);
    if (Array.isArray(limitedConversations) && limitedConversations.length > 0) {
      ok.push(messagesSource);
      messagesCount = limitedConversations.length;
      events.push(...normalizeConversations(limitedConversations));
    }
    report.push({
      source: messagesSource,
      ok: true,
      ms: Math.round(nowMs() - messagesStart),
      count: messagesCount,
    });
  } catch (error) {
    markFailure(messagesSource, error, Math.round(nowMs() - messagesStart));
  }

  const actionRequestsSource = "actionRequests";
  tried.push(actionRequestsSource);
  const actionRequestsStart = nowMs();
  let actionRequestsCount = 0;
  try {
    const requests = sortByTimeDesc(await listActionRequests({}), (request: any) => request.updatedAt || request.createdAt);
    const limitedRequests = cap(requests as any[], MAX_ACTION_REQUESTS);
    if (Array.isArray(limitedRequests) && limitedRequests.length > 0) {
      ok.push(actionRequestsSource);
      actionRequestsCount = limitedRequests.length;
      events.push(...normalizeActionRequests(limitedRequests as any[]));
      for (const request of limitedRequests as any[]) {
        rememberProperty(request?.propertyId, request?.updatedAt || request?.createdAt);
      }
    }
    report.push({
      source: actionRequestsSource,
      ok: true,
      ms: Math.round(nowMs() - actionRequestsStart),
      count: actionRequestsCount,
    });
  } catch (error) {
    markFailure(actionRequestsSource, error, Math.round(nowMs() - actionRequestsStart));
  }

  const ledgerSource = "ledgerV2";
  tried.push(ledgerSource);
  const ledgerStart = nowMs();
  let ledgerCount = 0;
  try {
    const ledger = await listLedgerV2({ limit: LEDGER_FETCH_LIMIT });
    if (ledger?.ok && Array.isArray(ledger.items) && ledger.items.length > 0) {
      ok.push(ledgerSource);
      ledgerCount = ledger.items.length;
      events.push(...normalizeLedgerV2Events(ledger.items));
    }
    report.push({
      source: ledgerSource,
      ok: true,
      ms: Math.round(nowMs() - ledgerStart),
      count: ledgerCount,
    });
  } catch (error) {
    markFailure(ledgerSource, error, Math.round(nowMs() - ledgerStart));
  }

  const bureauAdapterTestEnabled =
    import.meta.env.MODE !== "test" && import.meta.env.VITE_BUREAU_ADAPTER_TEST === "true";

  if (bureauAdapterTestEnabled) {
    const bureauSource = "bureauAdapter";
    tried.push(bureauSource);
    const bureauStart = nowMs();
    let bureauCount = 0;
    try {
      const bureauEvents = await getBureauAdapter().listScreeningsForLandlord(landlordId);
      if (Array.isArray(bureauEvents) && bureauEvents.length > 0) {
        bureauCount = bureauEvents.length;
        ok.push(bureauSource);
        events.push(...bureauEvents.map(normalizeBureauEvent));
      }
      report.push({
        source: bureauSource,
        ok: true,
        ms: Math.round(nowMs() - bureauStart),
        count: bureauCount,
      });
    } catch (error) {
      markFailure(bureauSource, error, Math.round(nowMs() - bureauStart));
    }
  }

  const candidates = events
    .map((event) => {
      const source = getTimelineSourceKey(event);
      return {
        event,
        source,
        priority: getTimelineSourcePriority(source),
        occurredAtMs: toMs(event.occurredAt),
      };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.occurredAtMs - a.occurredAtMs;
    });

  const keptById = new Set<string>();
  const keptByFingerprint = new Set<string>();
  const deduped: AutomationEvent[] = [];
  for (const candidate of candidates) {
    const id = String(candidate.event.id || "").trim();
    if (id && keptById.has(id)) continue;
    const fingerprint = buildEventFingerprint(candidate.event);
    if (keptByFingerprint.has(fingerprint)) continue;
    if (id) keptById.add(id);
    keptByFingerprint.add(fingerprint);
    deduped.push(candidate.event);
  }

  const sorted = deduped
    .sort((a, b) => toMs(b.occurredAt) - toMs(a.occurredAt))
    .slice(0, MAX_EVENTS_TOTAL);

  return { events: sorted, sources: { tried, ok, report } };
}
