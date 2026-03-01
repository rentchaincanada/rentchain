import type {
  BureauAdapter,
  BureauCheckoutInput,
  BureauCheckoutResult,
  NormalizedScreeningEvent,
  NormalizedScreeningStatus,
  BureauQuoteInput,
  BureauQuoteResult,
} from "../types";

export class MockProvider implements BureauAdapter {
  providerId = "mock" as const;

  async startScreeningRedirect(input: {
    applicationId: string;
  }): Promise<{ redirectUrl: string; requestId: string }> {
    return {
      redirectUrl: `/screening/mock/${encodeURIComponent(input.applicationId)}`,
      requestId: `mock-${input.applicationId}`,
    };
  }

  async getScreeningStatus(_requestId: string): Promise<{
    status: NormalizedScreeningStatus;
    updatedAt: string;
  }> {
    return {
      status: "completed",
      updatedAt: new Date().toISOString(),
    };
  }

  async fetchReportSummary(_requestId: string): Promise<{
    available: boolean;
    scoreBand?: string;
  }> {
    return {
      available: true,
      scoreBand: "B",
    };
  }

  async quoteScreening(_input: BureauQuoteInput): Promise<BureauQuoteResult> {
    return {
      ok: true,
      provider: this.providerId,
      totalAmountCents: 2995,
      currency: "CAD",
      eligible: true,
    };
  }

  async createCheckout(_input: BureauCheckoutInput): Promise<BureauCheckoutResult> {
    return {
      ok: true,
      provider: this.providerId,
      checkoutUrlPresent: true,
      orderIdPresent: true,
    };
  }

  async listScreeningsForLandlord(landlordId: string): Promise<NormalizedScreeningEvent[]> {
    const now = Date.now();
    return [
      {
        provider: "mock",
        requestId: `mock-${landlordId}-1`,
        applicationId: "mock-app-1",
        tenantId: "mock-tenant-1",
        propertyId: "mock-property-1",
        status: "in_progress",
        occurredAt: new Date(now - 30 * 60 * 1000).toISOString(),
        summary: "Mock screening in progress",
        metadata: { source: "MockProvider" },
      },
      {
        provider: "mock",
        requestId: `mock-${landlordId}-2`,
        applicationId: "mock-app-2",
        tenantId: "mock-tenant-2",
        propertyId: "mock-property-2",
        status: "completed",
        occurredAt: new Date(now - 5 * 60 * 1000).toISOString(),
        summary: "Mock screening completed",
        metadata: { source: "MockProvider", scoreBand: "A" },
      },
    ];
  }
}
