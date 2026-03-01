import {
  createScreeningOrder,
  fetchRentalApplications,
  fetchScreening,
} from "@/api/rentalApplicationsApi";
import type {
  BureauAdapter,
  NormalizedScreeningEvent,
  NormalizedScreeningStatus,
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
    const response = await createScreeningOrder({
      applicationId: input.applicationId,
      scoreAddOn: false,
      serviceLevel: "SELF_SERVE",
    });

    if (!response?.ok || !response.checkoutUrl) {
      throw new Error(response?.error || "Unable to create screening redirect");
    }

    return {
      redirectUrl: response.checkoutUrl,
      requestId: response.orderId || input.applicationId,
    };
  }

  async getScreeningStatus(requestId: string): Promise<{
    status: NormalizedScreeningStatus;
    updatedAt: string;
  }> {
    const response = await fetchScreening(requestId);
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
    const applications = await fetchRentalApplications();
    const latest = applications.slice(0, 10);

    const events = await Promise.all(
      latest.map(async (application) => {
        const screeningResponse = await fetchScreening(application.id);
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
