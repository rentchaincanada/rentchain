export type TimelinePlan = "free" | "starter" | "core" | "pro" | "elite" | "elite_enterprise";

export function normalizeTimelinePlan(plan?: string | null): TimelinePlan {
  const raw = String(plan || "").trim().toLowerCase();
  if (raw === "pro") return "pro";
  if (raw === "elite" || raw === "business") return "elite";
  if (raw === "elite_enterprise" || raw === "enterprise") return "elite_enterprise";
  if (raw === "core") return "core";
  if (raw === "starter") return "starter";
  return "free";
}

export function canUseTimeline(plan?: string | null): boolean {
  const normalized = normalizeTimelinePlan(plan);
  return normalized === "pro" || normalized === "elite" || normalized === "elite_enterprise";
}
