export type LimitType = "properties" | "units" | "tenants" | "activeLeases";

export function isUnlimited(n: number) {
  return !Number.isFinite(n);
}

export function wouldExceed(current: number, delta: number, max: number) {
  if (isUnlimited(max)) return false;
  return current + delta > max;
}

export function limitError(args: {
  plan: string;
  limitType: LimitType;
  max: number;
  current: number;
  attempted: number;
}) {
  const { plan, limitType, max, current, attempted } = args;
  return {
    error: "Upgrade required",
    code: "PLAN_LIMIT_EXCEEDED",
    plan,
    limitType,
    max: Number.isFinite(max) ? max : null,
    current,
    attempted,
  };
}
