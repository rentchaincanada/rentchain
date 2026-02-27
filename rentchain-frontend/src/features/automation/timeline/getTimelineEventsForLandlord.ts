import { listActionRequests } from "@/api/actionRequestsApi";
import { listLedgerV2 } from "@/api/ledgerV2";
import { getLeasesForProperty } from "@/api/leasesApi";
import { fetchLandlordConversations } from "@/api/messagesApi";
import { fetchPayments } from "@/api/paymentsApi";
import { fetchRentalApplications, fetchScreening } from "@/api/rentalApplicationsApi";
import type { AutomationEvent } from "./automationTimeline.types";
import {
  normalizeActionRequests,
  normalizeConversations,
  normalizeLedgerV2Events,
  normalizeLeases,
  normalizePayments,
  normalizeRentalApplicationSummary,
  normalizeScreeningPipeline,
} from "./timelineNormalizers";

type SourceMeta = { tried: string[]; ok: string[] };

export async function getTimelineEventsForLandlord(
  landlordId: string
): Promise<{ events: AutomationEvent[]; sources: SourceMeta }> {
  if (!landlordId) {
    return { events: [], sources: { tried: [], ok: [] } };
  }

  const tried: string[] = [];
  const ok: string[] = [];
  const events: AutomationEvent[] = [];
  const propertyIds = new Set<string>();

  tried.push("rentalApplicationsApi.fetchRentalApplications");
  try {
    const applications = await fetchRentalApplications();
    if (Array.isArray(applications) && applications.length > 0) {
      ok.push("rentalApplicationsApi.fetchRentalApplications");
      events.push(...normalizeRentalApplicationSummary(applications));
      for (const application of applications) {
        if (application.propertyId) propertyIds.add(String(application.propertyId));
      }

      const screeningTargets = applications.slice(0, 6);
      for (const application of screeningTargets) {
        tried.push(`rentalApplicationsApi.fetchScreening:${application.id}`);
        try {
          const screening = await fetchScreening(application.id);
          if (screening?.ok && screening.screening) {
            ok.push(`rentalApplicationsApi.fetchScreening:${application.id}`);
            events.push(...normalizeScreeningPipeline(application.id, screening.screening));
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug("[timeline] source failed", {
              source: "rentalApplicationsApi.fetchScreening",
              applicationId: application.id,
              error,
            });
          }
        }
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("[timeline] source failed", {
        source: "rentalApplicationsApi.fetchRentalApplications",
        error,
      });
    }
  }

  tried.push("paymentsApi.fetchPayments");
  try {
    const payments = await fetchPayments();
    if (Array.isArray(payments) && payments.length > 0) {
      ok.push("paymentsApi.fetchPayments");
      events.push(...normalizePayments(payments));
      for (const payment of payments) {
        if (payment.propertyId) propertyIds.add(String(payment.propertyId));
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("[timeline] source failed", { source: "paymentsApi.fetchPayments", error });
    }
  }

  const leasePropertyIds = Array.from(propertyIds).slice(0, 8);
  for (const propertyId of leasePropertyIds) {
    tried.push(`leasesApi.getLeasesForProperty:${propertyId}`);
    try {
      const response = await getLeasesForProperty(propertyId);
      if (Array.isArray(response?.leases) && response.leases.length > 0) {
        ok.push(`leasesApi.getLeasesForProperty:${propertyId}`);
        events.push(...normalizeLeases(response.leases));
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("[timeline] source failed", {
          source: "leasesApi.getLeasesForProperty",
          propertyId,
          error,
        });
      }
    }
  }

  tried.push("messagesApi.fetchLandlordConversations");
  try {
    const conversations = await fetchLandlordConversations();
    if (Array.isArray(conversations) && conversations.length > 0) {
      ok.push("messagesApi.fetchLandlordConversations");
      events.push(...normalizeConversations(conversations));
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("[timeline] source failed", {
        source: "messagesApi.fetchLandlordConversations",
        error,
      });
    }
  }

  tried.push("actionRequestsApi.listActionRequests");
  try {
    const requests = await listActionRequests({});
    if (Array.isArray(requests) && requests.length > 0) {
      ok.push("actionRequestsApi.listActionRequests");
      events.push(...normalizeActionRequests(requests as any[]));
      for (const request of requests as any[]) {
        if (request?.propertyId) propertyIds.add(String(request.propertyId));
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("[timeline] source failed", { source: "actionRequestsApi.listActionRequests", error });
    }
  }

  tried.push("ledgerV2.listLedgerV2");
  try {
    const ledger = await listLedgerV2({ limit: 50 });
    if (ledger?.ok && Array.isArray(ledger.items) && ledger.items.length > 0) {
      ok.push("ledgerV2.listLedgerV2");
      events.push(...normalizeLedgerV2Events(ledger.items));
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("[timeline] source failed", { source: "ledgerV2.listLedgerV2", error });
    }
  }

  const deduped = Array.from(new Map(events.map((event) => [event.id, event])).values()).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return { events: deduped, sources: { tried, ok } };
}
