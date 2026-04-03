export type PlanKey = "starter" | "pro" | "elite" | "screening";

export function getVisiblePlans(role?: string | null): PlanKey[] {
  void role;
  return ["starter", "pro", "elite"];
}
