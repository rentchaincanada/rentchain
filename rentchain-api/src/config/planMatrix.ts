export type BillingPlanKey = "starter" | "pro" | "business";
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
    monthlyAmountCents: 0,
    yearlyAmountCents: 0,
  },
  pro: {
    key: "pro",
    label: "Pro",
    monthlyAmountCents: 2900,
    yearlyAmountCents: 29000,
  },
  business: {
    key: "business",
    label: "Business",
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

function resolveEnvKeys(plan: BillingPlanKey, interval: PlanInterval, env: StripeEnv) {
  const upper = plan.toUpperCase();
  const intervalUpper = interval === "yearly" ? "YEARLY" : "MONTHLY";

  const preferred = `STRIPE_PRICE_${upper}_${intervalUpper}_${env.toUpperCase()}`;
  const fallback = `STRIPE_PRICE_${upper}_${intervalUpper}`;
  const legacy = interval === "monthly" ? `STRIPE_PRICE_${upper}` : null;

  return { preferred, fallback, legacy };
}

export function resolvePlanPriceId(params: {
  plan: BillingPlanKey;
  interval: PlanInterval;
  env?: StripeEnv;
}): { priceId: string | null; envKey: string; valid: boolean; missing: boolean } {
  const env = params.env || inferStripeEnv();
  const { preferred, fallback, legacy } = resolveEnvKeys(params.plan, params.interval, env);
  const candidates = [preferred, fallback, legacy].filter(Boolean) as string[];

  for (const key of candidates) {
    const value = envVal(key);
    if (!value) continue;
    return {
      priceId: value.startsWith("price_") ? value : null,
      envKey: key,
      valid: value.startsWith("price_"),
      missing: false,
    };
  }

  return { priceId: null, envKey: preferred, valid: false, missing: true };
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
    { plan: "business", interval: "monthly" },
    { plan: "business", interval: "yearly" },
  ];

  const missing: string[] = [];
  const invalid: string[] = [];

  for (const req of required) {
    const resolved = resolvePlanPriceId({ ...req, env });
    if (resolved.missing) {
      missing.push(resolved.envKey);
      continue;
    }
    if (!resolved.valid) {
      invalid.push(resolved.envKey);
    }
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    env,
    missing,
    invalid,
  };
}

export function resolvePlanFromPriceId(priceId?: string | null): BillingPlanKey | null {
  const id = String(priceId || "").trim();
  if (!id) return null;
  const envs: StripeEnv[] = ["live", "test"];
  const intervals: PlanInterval[] = ["monthly", "yearly"];
  const plans: BillingPlanKey[] = ["starter", "pro", "business"];

  for (const env of envs) {
    for (const plan of plans) {
      for (const interval of intervals) {
        const { preferred, fallback, legacy } = resolveEnvKeys(plan, interval, env);
        const keys = [preferred, fallback, legacy].filter(Boolean) as string[];
        for (const key of keys) {
          const value = envVal(key);
          if (value && value === id) return plan;
        }
      }
    }
  }
  return null;
}
