import { resolveCanonicalPlan, type Plan } from "../services/entitlements/planCapabilities";

export type BillingPlanKey = "starter" | "pro" | "elite";
type PlanInterval = "monthly" | "yearly";
type StripeEnv = "live" | "test";

type PlanConfig = {
  key: BillingPlanKey;
  label: string;
  monthlyAmountCents: number;
  yearlyAmountCents: number;
};

const PLAN_MATRIX: Record<BillingPlanKey, PlanConfig> = {
  starter: {
    key: "starter",
    label: "Starter",
    monthlyAmountCents: 2900,
    yearlyAmountCents: 29000,
  },
  pro: {
    key: "pro",
    label: "Pro",
    monthlyAmountCents: 4900,
    yearlyAmountCents: 49000,
  },
  elite: {
    key: "elite",
    label: "Elite",
    monthlyAmountCents: 7900,
    yearlyAmountCents: 79000,
  },
};

function inferStripeEnv(): StripeEnv {
  const mode = String(process.env.STRIPE_MODE || process.env.STRIPE_ENV || "").trim().toLowerCase();
  if (mode === "live" || mode === "production") return "live";
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim().toLowerCase();
  if (key.startsWith("sk_live")) return "live";
  return "test";
}

function envVal(key: string | undefined): string | null {
  if (!key) return null;
  const raw = process.env[key];
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  return trimmed.length ? trimmed : null;
}

const compact = <T,>(arr: Array<T | null | undefined>): T[] =>
  arr.filter((value): value is T => value != null);

function resolveEnvKeys(plan: BillingPlanKey, interval: PlanInterval, env: StripeEnv) {
  const preferredUpper = plan.toUpperCase();
  const legacyUpper = plan === "elite" ? "BUSINESS" : preferredUpper;
  const intervalUpper = interval === "yearly" ? "YEARLY" : "MONTHLY";

  const preferred = `STRIPE_PRICE_${preferredUpper}_${intervalUpper}_${env.toUpperCase()}`;
  const fallback = `STRIPE_PRICE_${preferredUpper}_${intervalUpper}`;
  const legacyPreferred = interval === "monthly" ? `STRIPE_PRICE_${preferredUpper}` : null;
  const legacyEnvPreferred = plan === "elite" ? `STRIPE_PRICE_${legacyUpper}_${intervalUpper}_${env.toUpperCase()}` : null;
  const legacyEnvFallback = plan === "elite" ? `STRIPE_PRICE_${legacyUpper}_${intervalUpper}` : null;
  const legacyLegacy = plan === "elite" && interval === "monthly" ? `STRIPE_PRICE_${legacyUpper}` : null;

  return {
    preferred,
    fallback,
    legacyPreferred,
    legacyEnvPreferred,
    legacyEnvFallback,
    legacyLegacy,
  };
}

function isProductionEnv() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function allowFallback(env: StripeEnv) {
  if (env === "test") return true;
  return !isProductionEnv();
}

export function resolvePlanPriceId(params: {
  plan: BillingPlanKey;
  interval: PlanInterval;
  env?: StripeEnv;
}): {
  priceId: string | null;
  envKey: string;
  valid: boolean;
  missing: boolean;
  fallbackUsed: boolean;
} {
  const env = params.env || inferStripeEnv();
  const {
    preferred,
    fallback,
    legacyPreferred,
    legacyEnvPreferred,
    legacyEnvFallback,
    legacyLegacy,
  } = resolveEnvKeys(params.plan, params.interval, env);
  const candidates = compact([preferred]).concat(
    compact(
      allowFallback(env)
        ? [fallback, legacyPreferred, legacyEnvPreferred, legacyEnvFallback, legacyLegacy]
        : [legacyEnvPreferred]
    )
  );

  for (const key of candidates) {
    const value = envVal(key);
    if (!value) continue;
    return {
      priceId: value.startsWith("price_") ? value : null,
      envKey: key,
      valid: value.startsWith("price_"),
      missing: false,
      fallbackUsed: key !== preferred,
    };
  }

  return { priceId: null, envKey: preferred, valid: false, missing: true, fallbackUsed: false };
}

export function getPlanMatrix(): PlanConfig[] {
  return Object.values(PLAN_MATRIX);
}

export function getPlanConfig(plan: BillingPlanKey): PlanConfig {
  return PLAN_MATRIX[plan];
}

export function getStripeEnv(): StripeEnv {
  return inferStripeEnv();
}

export function getPricingHealth() {
  const env = inferStripeEnv();
  const required: Array<{ plan: BillingPlanKey; interval: PlanInterval }> = [
    { plan: "starter", interval: "monthly" },
    { plan: "starter", interval: "yearly" },
    { plan: "pro", interval: "monthly" },
    { plan: "pro", interval: "yearly" },
    { plan: "elite", interval: "monthly" },
    { plan: "elite", interval: "yearly" },
  ];

  const missing: string[] = [];
  const invalid: string[] = [];
  const amountInvalid: string[] = [];
  const used: Array<{
    plan: BillingPlanKey;
    interval: PlanInterval;
    envKey: string;
    fallbackUsed: boolean;
  }> = [];

  for (const req of required) {
    const resolved = resolvePlanPriceId({ ...req, env });
    if (resolved.missing) {
      missing.push(resolved.envKey);
      continue;
    }
    used.push({
      plan: req.plan,
      interval: req.interval,
      envKey: resolved.envKey,
      fallbackUsed: resolved.fallbackUsed,
    });
    if (!resolved.valid) {
      invalid.push(resolved.envKey);
      continue;
    }
    if (env === "live" && isProductionEnv() && resolved.fallbackUsed) {
      invalid.push(resolved.envKey);
    }
  }

  for (const plan of Object.values(PLAN_MATRIX)) {
    if (!plan.monthlyAmountCents || !plan.yearlyAmountCents) {
      amountInvalid.push(plan.key);
    }
  }

  return {
    ok: missing.length === 0 && invalid.length === 0 && amountInvalid.length === 0,
    env,
    missing,
    invalid,
    amountInvalid,
    used,
  };
}

export function resolvePaidBillingPlan(input?: string | null): BillingPlanKey | null {
  const plan = resolveCanonicalPlan(input);
  if (plan === "starter" || plan === "pro" || plan === "elite") return plan;
  return null;
}

export function isCanonicalFreePlan(input?: string | null): boolean {
  return resolveCanonicalPlan(input) === "free";
}

export function resolvePlanFromPriceId(priceId?: string | null): BillingPlanKey | null {
  const id = String(priceId || "").trim();
  if (!id) return null;
  const envs: StripeEnv[] = ["live", "test"];
  const intervals: PlanInterval[] = ["monthly", "yearly"];
  const plans: BillingPlanKey[] = ["starter", "pro", "elite"];

  for (const env of envs) {
    const includeFallback = allowFallback(env);
    for (const plan of plans) {
      for (const interval of intervals) {
        const {
          preferred,
          fallback,
          legacyPreferred,
          legacyEnvPreferred,
          legacyEnvFallback,
          legacyLegacy,
        } = resolveEnvKeys(plan, interval, env);
        const keys = compact([preferred]).concat(
          compact(
            includeFallback
              ? [fallback, legacyPreferred, legacyEnvPreferred, legacyEnvFallback, legacyLegacy]
              : [legacyEnvPreferred]
          )
        );
        for (const key of keys) {
          const value = envVal(key);
          if (value && value === id) return plan;
        }
      }
    }
  }
  return null;
}
