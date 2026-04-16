export type FeedbackType =
  | "application_experience"
  | "screening_experience"
  | "maintenance_experience"
  | "communication_experience";

export type FeedbackSentiment =
  | "positive"
  | "neutral"
  | "negative";

export type TenantFeedbackV1 = {
  version: "v1";
  id: string;
  type: FeedbackType;
  resource: {
    type: string;
    id: string;
    portfolioId?: string | null;
  };
  sentiment: FeedbackSentiment;
  tags: string[];
  notes?: string | null;
  createdAt: string;
  metadata?: {
    tenantId?: string | null;
  };
};

export type AggregatedFeedbackSignalV1 = {
  type: FeedbackType;
  positiveRatio: number;
  neutralRatio: number;
  negativeRatio: number;
  dominant: FeedbackSentiment;
  signalStrength: "weak" | "moderate" | "strong";
};

export type LandlordFeedbackSummaryV1 = {
  summaries: string[];
};
