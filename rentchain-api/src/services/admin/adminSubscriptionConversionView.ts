import { db } from "../../config/firebase";

export const SUBSCRIPTION_CONVERSION_FUNNEL_STEPS = [
  "pricing_page_viewed",
  "pricing_plan_cta_clicked",
  "upgrade_cta_clicked",
  "upgrade_prompt_viewed",
  "upgrade_prompt_checkout_clicked",
  "billing_page_opened",
  "billing_upgrade_clicked",
] as const;

type FunnelStepName = (typeof SUBSCRIPTION_CONVERSION_FUNNEL_STEPS)[number];

type EventProps = {
  targetPlan?: unknown;
  surface?: unknown;
  source?: unknown;
};

type ConversionEventRow = {
  name: FunnelStepName;
  ts: number;
  props: EventProps;
};

export type SubscriptionConversionSummary = {
  window: {
    days: number;
    from: string;
    to: string;
  };
  funnel: Array<{
    step: FunnelStepName;
    count: number;
    conversionFromPrevious?: number | null;
  }>;
  breakdowns: {
    targetPlan: Record<string, number>;
    surface: Record<string, number>;
    source: Record<string, number>;
  };
};

const FUNNEL_STEP_SET = new Set<string>(SUBSCRIPTION_CONVERSION_FUNNEL_STEPS);

function clampDays(input: unknown) {
  const value = Number(input);
  if (!Number.isFinite(value)) return 30;
  return Math.min(Math.max(Math.round(value), 1), 90);
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toBreakdownKey(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function incrementBucket(bucket: Record<string, number>, key: string | null) {
  if (!key) return;
  bucket[key] = (bucket[key] || 0) + 1;
}

function isMission29ConversionEvent(data: any): data is { name: FunnelStepName; ts: number; props: EventProps } {
  if (!FUNNEL_STEP_SET.has(String(data?.name || ""))) return false;
  if (toNumber(data?.ts) == null) return false;
  if (!isPlainObject(data?.props)) return false;
  return true;
}

function toConversionEventRow(data: any): ConversionEventRow | null {
  if (!isMission29ConversionEvent(data)) return null;
  return {
    name: data.name,
    ts: Number(data.ts),
    props: data.props,
  };
}

export async function loadAdminSubscriptionConversionFunnel(params?: {
  days?: number | string;
}): Promise<SubscriptionConversionSummary> {
  const days = clampDays(params?.days);
  const to = Date.now();
  const from = to - days * 24 * 60 * 60 * 1000;

  const snapshot = await db
    .collection("events")
    .where("ts", ">=", from)
    .where("ts", "<=", to)
    .get();

  const rows = (snapshot.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
    .map(toConversionEventRow)
    .filter((row): row is ConversionEventRow => row != null);

  const counts = SUBSCRIPTION_CONVERSION_FUNNEL_STEPS.reduce<Record<FunnelStepName, number>>((acc, step) => {
    acc[step] = 0;
    return acc;
  }, {} as Record<FunnelStepName, number>);

  const breakdowns = {
    targetPlan: {} as Record<string, number>,
    surface: {} as Record<string, number>,
    source: {} as Record<string, number>,
  };

  for (const row of rows) {
    counts[row.name] += 1;
    incrementBucket(breakdowns.targetPlan, toBreakdownKey(row.props.targetPlan));
    incrementBucket(breakdowns.surface, toBreakdownKey(row.props.surface));
    incrementBucket(breakdowns.source, toBreakdownKey(row.props.source));
  }

  const funnel = SUBSCRIPTION_CONVERSION_FUNNEL_STEPS.map((step, index) => {
    const count = counts[step];
    if (index === 0) {
      return { step, count };
    }
    const previousCount = counts[SUBSCRIPTION_CONVERSION_FUNNEL_STEPS[index - 1]];
    return {
      step,
      count,
      conversionFromPrevious: previousCount > 0 ? count / previousCount : null,
    };
  });

  return {
    window: {
      days,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    },
    funnel,
    breakdowns,
  };
}
