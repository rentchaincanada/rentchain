import { listActionRequests } from "@/api/actionRequestsApi";
import { listLedgerV2 } from "@/api/ledgerV2";
import { getLeasesForProperty } from "@/api/leasesApi";
import { fetchLandlordConversations } from "@/api/messagesApi";
import { fetchPayments } from "@/api/paymentsApi";
import { fetchRentalApplications, fetchScreening } from "@/api/rentalApplicationsApi";
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

type SourceMeta = { tried: string[]; ok: string[]; failed: string[] };

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

export async function getTimelineEventsForLandlord(
  landlordId: string
): Promise<{ events: AutomationEvent[]; sources: SourceMeta }> {
  if (!landlordId) {
    return { events: [], sources: { tried: [], ok: [], failed: [] } };
  }

  const tried: string[] = [];
  const ok: string[] = [];
  const failed: string[] = [];
  const events: AutomationEvent[] = [];
  const propertyLastActivity = new Map<string, number>();

  const rememberProperty = (propertyId: unknown, occurredAt: unknown) => {
    const key = String(propertyId || "").trim();
    if (!key) return;
    const ts = toMs(occurredAt);
    const existing = propertyLastActivity.get(key) || 0;
    if (ts > existing) propertyLastActivity.set(key, ts);
  };

  const markFailure = (source: string, error: unknown) => {
    failed.push(source);
    if (import.meta.env.DEV) {
      console.debug("[timeline] source failed", { source, error });
    }
  };

  tried.push("rentalApplicationsApi.fetchRentalApplications");
  try {
    const applications = sortByTimeDesc(await fetchRentalApplications(), (application) => application.submittedAt);
    const limitedApplications = cap(applications, MAX_APPS);
    if (Array.isArray(limitedApplications) && limitedApplications.length > 0) {
      ok.push("rentalApplicationsApi.fetchRentalApplications");
      events.push(...normalizeRentalApplicationSummary(limitedApplications));
      for (const application of limitedApplications) {
        rememberProperty(application.propertyId, application.submittedAt);
      }

      const screeningTargets = cap(limitedApplications, MAX_SCREENING_LOOKUPS);
      for (const application of screeningTargets) {
        const screeningSource = `rentalApplicationsApi.fetchScreening:${application.id}`;
        tried.push(screeningSource);
        try {
          const screening = await fetchScreening(application.id);
          if (screening?.ok && screening.screening) {
            ok.push(screeningSource);
            events.push(...normalizeScreeningPipeline(application.id, screening.screening));
          }
        } catch (error) {
          markFailure(screeningSource, error);
        }
      }
    }
  } catch (error) {
    markFailure("rentalApplicationsApi.fetchRentalApplications", error);
  }

  tried.push("paymentsApi.fetchPayments");
  try {
    const payments = sortByTimeDesc(await fetchPayments(), (payment) => payment.paidAt || payment.updatedAt || payment.createdAt);
    const limitedPayments = cap(payments, MAX_PAYMENTS);
    if (Array.isArray(limitedPayments) && limitedPayments.length > 0) {
      ok.push("paymentsApi.fetchPayments");
      events.push(...normalizePayments(limitedPayments));
      for (const payment of limitedPayments) {
        rememberProperty(payment.propertyId, payment.paidAt || payment.updatedAt || payment.createdAt);
      }
    }
  } catch (error) {
    markFailure("paymentsApi.fetchPayments", error);
  }

  const leasePropertyIds = Array.from(propertyLastActivity.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LEASE_PROPERTIES)
    .map(([propertyId]) => propertyId);
  for (const propertyId of leasePropertyIds) {
    const leaseSource = `leasesApi.getLeasesForProperty:${propertyId}`;
    tried.push(leaseSource);
    try {
      const response = await getLeasesForProperty(propertyId);
      if (Array.isArray(response?.leases) && response.leases.length > 0) {
        ok.push(leaseSource);
        events.push(...normalizeLeases(response.leases));
      }
    } catch (error) {
      markFailure(leaseSource, error);
    }
  }

  tried.push("messagesApi.fetchLandlordConversations");
  try {
    const conversations = sortByTimeDesc(await fetchLandlordConversations(), (conversation) => conversation.lastMessageAt || conversation.createdAt);
    const limitedConversations = cap(conversations, MAX_MESSAGES);
    if (Array.isArray(limitedConversations) && limitedConversations.length > 0) {
      ok.push("messagesApi.fetchLandlordConversations");
      events.push(...normalizeConversations(limitedConversations));
    }
  } catch (error) {
    markFailure("messagesApi.fetchLandlordConversations", error);
  }

  tried.push("actionRequestsApi.listActionRequests");
  try {
    const requests = sortByTimeDesc(await listActionRequests({}), (request: any) => request.updatedAt || request.createdAt);
    const limitedRequests = cap(requests as any[], MAX_ACTION_REQUESTS);
    if (Array.isArray(limitedRequests) && limitedRequests.length > 0) {
      ok.push("actionRequestsApi.listActionRequests");
      events.push(...normalizeActionRequests(limitedRequests as any[]));
      for (const request of limitedRequests as any[]) {
        rememberProperty(request?.propertyId, request?.updatedAt || request?.createdAt);
      }
    }
  } catch (error) {
    markFailure("actionRequestsApi.listActionRequests", error);
  }

  tried.push("ledgerV2.listLedgerV2");
  try {
    const ledger = await listLedgerV2({ limit: LEDGER_FETCH_LIMIT });
    if (ledger?.ok && Array.isArray(ledger.items) && ledger.items.length > 0) {
      ok.push("ledgerV2.listLedgerV2");
      events.push(...normalizeLedgerV2Events(ledger.items));
    }
  } catch (error) {
    markFailure("ledgerV2.listLedgerV2", error);
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

  return { events: sorted, sources: { tried, ok, failed } };
}
