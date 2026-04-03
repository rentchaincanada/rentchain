export type NormalizedPlanLabel = "Free" | "Starter" | "Pro" | "Elite";

export function normalizePlanLabel(plan?: string | null): NormalizedPlanLabel {
  const raw = String(plan || "").trim().toLowerCase();
  if (!raw || raw === "screening" || raw === "free") return "Free";
  if (raw === "starter" || raw === "core") return "Starter";
  if (raw === "pro") return "Pro";
  if (raw === "business" || raw === "elite" || raw === "enterprise") return "Elite";
  return "Starter";
}
