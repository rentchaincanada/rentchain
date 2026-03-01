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

export interface BureauQuoteInput {
  applicationId: string;
  screeningTier?: "basic" | "verify" | "verify_ai";
  addons?: string[];
  totalAmount?: number;
  serviceLevel?: "SELF_SERVE" | "VERIFIED" | "VERIFIED_AI";
  scoreAddOn?: boolean;
}

export interface BureauQuoteResult {
  ok: boolean;
  provider?: BureauProviderId;
  totalAmountCents?: number;
  currency?: string;
  eligible?: boolean;
  errorCode?: string;
}

export interface BureauCheckoutInput {
  applicationId: string;
  screeningTier?: "basic" | "verify" | "verify_ai";
  addons?: string[];
  totalAmount?: number;
  scoreAddOn: boolean;
  serviceLevel: "SELF_SERVE" | "VERIFIED" | "VERIFIED_AI";
  consent?: {
    given: boolean;
    timestamp: string;
    version: string;
  };
}

export interface BureauCheckoutResult {
  ok: boolean;
  provider?: BureauProviderId;
  checkoutUrlPresent: boolean;
  orderIdPresent: boolean;
  errorCode?: string;
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

  quoteScreening?(input: BureauQuoteInput): Promise<BureauQuoteResult>;
  createCheckout?(input: BureauCheckoutInput): Promise<BureauCheckoutResult>;
}
