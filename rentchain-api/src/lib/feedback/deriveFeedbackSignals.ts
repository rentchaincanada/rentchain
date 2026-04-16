import type {
  AggregatedFeedbackSignalV1,
  FeedbackSentiment,
  FeedbackType,
  TenantFeedbackV1,
} from "./feedbackTypes";

const FEEDBACK_TYPES: FeedbackType[] = [
  "application_experience",
  "screening_experience",
  "maintenance_experience",
  "communication_experience",
];

function ratio(count: number, total: number) {
  return total > 0 ? Number((count / total).toFixed(2)) : 0;
}

function dominantSentiment(counts: Record<FeedbackSentiment, number>): FeedbackSentiment {
  if (counts.negative > counts.positive && counts.negative >= counts.neutral) return "negative";
  if (counts.positive >= counts.neutral) return "positive";
  return "neutral";
}

function signalStrength(total: number): AggregatedFeedbackSignalV1["signalStrength"] {
  if (total >= 8) return "strong";
  if (total >= 4) return "moderate";
  return "weak";
}

export function deriveFeedbackSignals(feedback: TenantFeedbackV1[]): AggregatedFeedbackSignalV1[] {
  return FEEDBACK_TYPES.map((type) => {
    const items = feedback.filter((entry) => entry.type === type);
    const counts: Record<FeedbackSentiment, number> = {
      positive: items.filter((entry) => entry.sentiment === "positive").length,
      neutral: items.filter((entry) => entry.sentiment === "neutral").length,
      negative: items.filter((entry) => entry.sentiment === "negative").length,
    };
    const total = items.length;

    return {
      type,
      positiveRatio: ratio(counts.positive, total),
      neutralRatio: ratio(counts.neutral, total),
      negativeRatio: ratio(counts.negative, total),
      dominant: dominantSentiment(counts),
      signalStrength: signalStrength(total),
    };
  }).filter((signal) => signal.positiveRatio || signal.neutralRatio || signal.negativeRatio);
}
