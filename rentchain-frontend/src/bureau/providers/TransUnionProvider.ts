import { apiFetch } from "@/api/apiFetch";
import type {
  BureauAdapter,
  BureauCheckoutInput,
  BureauCheckoutResult,
  NormalizedScreeningEvent,
  NormalizedScreeningStatus,
  BureauQuoteInput,
  BureauQuoteResult,
} from "../types";

const mapPipelineStatus = (status: string | null | undefined): NormalizedScreeningStatus => {
  switch (status) {
    case "unpaid":
      return "created";
    case "paid":
      return "invited";
    case "processing":
      return "in_progress";
    case "complete":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "created";
  }
};

export class TransUnionProvider implements BureauAdapter {
  providerId = "transunion" as const;

  async startScreeningRedirect(input: {
    applicationId: string;
  }): Promise<{ redirectUrl: string; requestId: string }> {
    const response = (await apiFetch(`/screening/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: input.applicationId,
        scoreAddOn: false,
        serviceLevel: "SELF_SERVE",
      }),
    })) as any;

    if (!response?.ok || !response.checkoutUrl) {
      throw new Error(response?.error || "Unable to create screening redirect");
    }

    return {
      redirectUrl: response.checkoutUrl,
      requestId: response.orderId || input.applicationId,
    };
  }

  async quoteScreening(input: BureauQuoteInput): Promise<BureauQuoteResult> {
    const response = (await apiFetch(
      `/rental-applications/${encodeURIComponent(input.applicationId)}/screening/quote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screeningTier: input.screeningTier,
          addons: input.addons,
          totalAmount: input.totalAmount,
          serviceLevel: input.serviceLevel,
          scoreAddOn: input.scoreAddOn,
        }),
      }
    )) as any;

    return {
      ok: Boolean(response?.ok),
      provider: this.providerId,
      totalAmountCents: response?.data?.totalAmountCents,
      currency: response?.data?.currency,
      eligible: response?.data?.eligible,
      errorCode: response?.error,
    };
  }

  async createCheckout(input: BureauCheckoutInput): Promise<BureauCheckoutResult> {
    const response = (await apiFetch(`/screening/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: input.applicationId,
        screeningTier: input.screeningTier,
        addons: input.addons,
        totalAmount: input.totalAmount,
        scoreAddOn: input.scoreAddOn,
        serviceLevel: input.serviceLevel,
        consent: input.consent,
      }),
    })) as any;

    return {
      ok: Boolean(response?.ok),
      provider: this.providerId,
      checkoutUrlPresent: Boolean(response?.checkoutUrl),
      orderIdPresent: Boolean(response?.orderId),
      errorCode: response?.error,
    };
  }

  async getScreeningStatus(requestId: string): Promise<{
    status: NormalizedScreeningStatus;
    updatedAt: string;
  }> {
    const response = (await apiFetch(
      `/rental-applications/${encodeURIComponent(requestId)}/screening`
    )) as any;
    const status = mapPipelineStatus(response?.screening?.status);
    const updatedAtMs =
      response?.screening?.lastUpdatedAt ||
      response?.screening?.completedAt ||
      response?.screening?.startedAt ||
      response?.screening?.paidAt ||
      Date.now();

    const iso = new Date(updatedAtMs < 1e12 ? updatedAtMs * 1000 : updatedAtMs).toISOString();

    return { status, updatedAt: iso };
  }

  async fetchReportSummary(_requestId: string): Promise<{
    available: boolean;
    scoreBand?: string;
  }> {
    return { available: false };
  }

  async listScreeningsForLandlord(_landlordId: string): Promise<NormalizedScreeningEvent[]> {
    const listResponse = (await apiFetch(`/rental-applications?`)) as any;
    const applications = (listResponse?.data || []) as Array<{
      id: string;
      propertyId?: string | null;
      submittedAt?: number | null;
    }>;
    const latest = applications.slice(0, 10);

    const events = await Promise.all(
      latest.map(async (application) => {
        const screeningResponse = (await apiFetch(
          `/rental-applications/${encodeURIComponent(application.id)}/screening`
        )) as any;
        const screening = screeningResponse?.screening;
        if (!screening?.status) {
          return null;
        }

        const occurredAtMs =
          screening.lastUpdatedAt ||
          screening.completedAt ||
          screening.startedAt ||
          screening.paidAt ||
          application.submittedAt ||
          Date.now();

        return {
          provider: "transunion",
          requestId: `${application.id}:${screening.status}`,
          applicationId: application.id,
          propertyId: application.propertyId || undefined,
          status: mapPipelineStatus(screening.status),
          occurredAt: new Date(
            occurredAtMs < 1e12 ? occurredAtMs * 1000 : occurredAtMs
          ).toISOString(),
          summary: screening.summary?.overall
            ? `Screening result: ${screening.summary.overall}`
            : `Screening status: ${screening.status}`,
          metadata: {
            source: "TransUnionProvider.listScreeningsForLandlord",
          },
        } satisfies NormalizedScreeningEvent;
      })
    );

    return events.filter((event): event is NormalizedScreeningEvent => Boolean(event));
  }
}
