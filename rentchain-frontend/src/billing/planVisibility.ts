export type PlanKey = "starter" | "pro" | "elite";

export function getVisiblePlans(role?: string | null): PlanKey[] {
  void role;
  return ["starter", "pro", "elite"];
}
