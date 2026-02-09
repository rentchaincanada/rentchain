export type PlanKey = "starter" | "pro" | "business" | "elite" | "screening";

const isEliteUiEnabled = () => {
  const raw =
    (import.meta as any)?.env?.VITE_ENABLE_ELITE_UI ??
    (import.meta as any)?.env?.ENABLE_ELITE_UI ??
    "";
  return String(raw).toLowerCase() === "true";
};

export function getVisiblePlans(role?: string | null): PlanKey[] {
  const isAdmin = String(role || "").toLowerCase() === "admin";
  const base: PlanKey[] = ["starter", "pro", "business"];
  if (isAdmin || isEliteUiEnabled()) {
    base.push("elite");
  }
  return base;
}
