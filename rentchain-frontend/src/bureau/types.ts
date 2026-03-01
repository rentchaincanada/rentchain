export type BureauProviderId = "transunion" | "equifax" | "mock";

export type NormalizedScreeningStatus =
  | "created"
  | "invited"
  | "in_progress"
  | "completed"
  | "failed"
  | "expired"
  | "canceled";

export interface NormalizedScreeningEvent {
  provider: BureauProviderId;
  requestId: string;
  applicationId?: string;
  tenantId?: string;
  propertyId?: string;
  status: NormalizedScreeningStatus;
  occurredAt: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface BureauAdapter {
  providerId: BureauProviderId;

  startScreeningRedirect(input: {
    applicationId: string;
  }): Promise<{ redirectUrl: string; requestId: string }>;

  getScreeningStatus(requestId: string): Promise<{
    status: NormalizedScreeningStatus;
    updatedAt: string;
  }>;

  fetchReportSummary(requestId: string): Promise<{
    available: boolean;
    scoreBand?: string;
  }>;

  listScreeningsForLandlord(landlordId: string): Promise<NormalizedScreeningEvent[]>;
}
