import { normalizePlan, planLabel } from "@/lib/plan";

export type NormalizedPlanLabel = "Free" | "Starter" | "Pro" | "Elite";

export function normalizePlanLabel(plan?: string | null): NormalizedPlanLabel {
  return planLabel(normalizePlan(plan)) as NormalizedPlanLabel;
}
