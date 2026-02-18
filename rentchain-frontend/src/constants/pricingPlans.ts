export type PricingPlanKey = "free" | "starter" | "pro" | "elite";
export type PricingInterval = "monthly" | "yearly";

export type PricingPlan = {
  key: PricingPlanKey;
  label: string;
  monthlyPrice: string;
  yearlyPrice: string;
  features: string[];
};

export const DEFAULT_PLANS: PricingPlan[] = [
  {
    key: "free",
    label: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    features: [
      "Unlimited properties and units",
      "Manual tenant and application entry",
      "Pay-per-screening access",
    ],
  },
  {
    key: "starter",
    label: "Starter",
    monthlyPrice: "$29",
    yearlyPrice: "$290",
    features: [
      "Tenant invites",
      "Applications",
      "Messaging",
      "Basic ledger",
    ],
  },
  {
    key: "pro",
    label: "Pro",
    monthlyPrice: "$79",
    yearlyPrice: "$790",
    features: [
      "Verified ledger",
      "Basic exports",
      "Compliance reports",
      "Portfolio dashboard",
      "Team tools",
    ],
  },
  {
    key: "elite",
    label: "Elite",
    monthlyPrice: "$149",
    yearlyPrice: "$1490",
    features: [
      "AI summaries",
      "Advanced exports",
      "Audit logs",
      "Portfolio analytics",
    ],
  },
];
