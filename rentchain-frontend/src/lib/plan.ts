// src/lib/plan.ts
export type Plan = "starter" | "core" | "pro" | "elite";

export function normalizePlan(input: any): Plan {
  const v = String(input ?? "").trim().toLowerCase();
  if (v === "starter" || v === "core" || v === "pro" || v === "elite") return v;
  return "starter";
}

export function planLabel(plan: Plan): string {
  if (plan === "starter") return "Starter";
  if (plan === "core") return "Core";
  if (plan === "pro") return "Pro";
  return "Elite";
}

export function resolvePlanFrom(args: { me?: any; limits?: any }): Plan {
  const fromLimits =
    args?.limits?.plan ??
    args?.limits?.tier ??
    args?.limits?.entitlements?.plan;
  if (fromLimits) return normalizePlan(fromLimits);

  const fromMe = args?.me?.plan ?? args?.me?.tier;
  if (fromMe) return normalizePlan(fromMe);

  return "starter";
}
