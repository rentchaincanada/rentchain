import type { PortfolioHealthStatus } from "../portfolioHealth/portfolioHealthTypes";
import type { AggregatedFeedbackSignalV1, LandlordFeedbackSummaryV1 } from "./feedbackTypes";

export function deriveLandlordFeedbackSummary(signals: AggregatedFeedbackSignalV1[]): LandlordFeedbackSummaryV1 & {
  dimensionAdjustments: Partial<
    Record<"screening_health" | "maintenance_health" | "response_health", PortfolioHealthStatus>
  >;
} {
  const summaries: string[] = [];
  const dimensionAdjustments: Partial<
    Record<"screening_health" | "maintenance_health" | "response_health", PortfolioHealthStatus>
  > = {};

  for (const signal of signals) {
    if (signal.type === "screening_experience") {
      if (signal.dominant === "positive" && signal.signalStrength !== "weak") {
        summaries.push("Applicants generally report a smooth screening experience.");
      } else if (signal.dominant === "negative") {
        summaries.push("Some applicants experienced less consistent screening follow-through.");
        dimensionAdjustments.screening_health =
          signal.signalStrength === "strong" ? "attention_needed" : "watch";
      }
    }

    if (signal.type === "maintenance_experience") {
      if (signal.dominant === "positive" && signal.signalStrength !== "weak") {
        summaries.push("Tenants generally describe maintenance follow-through as steady.");
      } else if (signal.dominant === "negative") {
        summaries.push("Some tenants experienced slower maintenance follow-through.");
        dimensionAdjustments.maintenance_health =
          signal.signalStrength === "strong" ? "attention_needed" : "watch";
      }
    }

    if (signal.type === "communication_experience") {
      if (signal.dominant === "positive" && signal.signalStrength !== "weak") {
        summaries.push("Communication patterns appear generally consistent.");
      } else if (signal.dominant === "negative") {
        summaries.push("Some recent feedback suggests communication consistency may need attention.");
        dimensionAdjustments.response_health =
          signal.signalStrength === "strong" ? "attention_needed" : "watch";
      }
    }
  }

  return {
    summaries: summaries.slice(0, 3),
    dimensionAdjustments,
  };
}
