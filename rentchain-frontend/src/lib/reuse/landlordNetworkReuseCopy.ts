import type { ApplicationReviewSummary } from "../../api/reviewSummaryApi";

type NetworkReuseSummary = NonNullable<ApplicationReviewSummary["networkReuseSummary"]>;

export type LandlordNetworkReuseCopy = {
  headline: string;
  description: string;
  sourceLabel: string;
  guardrailCopy: string;
};

function sourceLabel(value: NetworkReuseSummary["source"]) {
  return value === "apply_with_rentchain" ? "RentChain application" : "Share package";
}

export function buildLandlordNetworkReuseCopy(
  summary: NetworkReuseSummary
): LandlordNetworkReuseCopy {
  switch (summary.reusePath) {
    case "apply_prefill_ready":
      return {
        headline: "Tenant-approved reusable application path is available",
        description:
          "Identity and reusable application context are already in scope for this review path.",
        sourceLabel: sourceLabel(summary.source),
        guardrailCopy:
          "Use this as review context only. It does not expand landlord access or permissions.",
      };
    case "share_summary_with_more_available":
      return {
        headline: "Some reuse context is available now",
        description:
          "Summary-level reuse is available for follow-through, and broader reusable application detail still requires tenant approval.",
        sourceLabel: sourceLabel(summary.source),
        guardrailCopy:
          "Use this as review context only. It does not expand landlord access or permissions.",
      };
    case "share_summary_ready":
      return {
        headline: "Summary-only reuse is available",
        description:
          "Tenant-approved reuse context is available for review follow-through without broadening landlord visibility.",
        sourceLabel: sourceLabel(summary.source),
        guardrailCopy:
          "Use this as review context only. It does not expand landlord access or permissions.",
      };
    case "not_ready":
    default:
      return {
        headline: "No reusable path is currently ready",
        description:
          "This review does not currently include a reusable RentChain application path.",
        sourceLabel: sourceLabel(summary.source),
        guardrailCopy:
          "Use this as review context only. It does not expand landlord access or permissions.",
      };
  }
}
