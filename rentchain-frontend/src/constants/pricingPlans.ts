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
      "Guided property and unit setup",
      "Basic applicant and viewing workflow",
      "Manual expense tracking",
      "Archive properties and keep history",
      "Guided screening setup path",
    ],
  },
  {
    key: "starter",
    label: "Starter",
    monthlyPrice: "$29",
    yearlyPrice: "$290",
    features: [
      "Tenant invites and linked applications",
      "Viewing coordination and workflow tools",
      "Messaging and day-to-day landlord operations",
      "Basic ledger and billing workspace",
    ],
  },
  {
    key: "pro",
    label: "Pro",
    monthlyPrice: "$79",
    yearlyPrice: "$790",
    features: [
      "CSV expense import",
      "Accountant-ready CSV, spreadsheet, and PDF exports",
      "Screening workflow with decision support",
      "Portfolio dashboard and stronger reporting",
      "Team workflow tools",
    ],
  },
  {
    key: "elite",
    label: "Elite",
    monthlyPrice: "$149",
    yearlyPrice: "$1490",
    features: [
      "Premium workflow controls",
      "Advanced exports and audit visibility",
      "Portfolio analytics and AI summaries",
      "Priority access to premium operations features",
    ],
  },
];
