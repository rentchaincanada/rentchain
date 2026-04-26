import {
  loadAdminSubscriptionConversionDataset,
  type ConversionEventRow,
  type SubscriptionConversionSummary,
} from "./adminSubscriptionConversionView";

type FunnelStep = SubscriptionConversionSummary["funnel"][number];

type RankedCount = {
  key: string;
  count: number;
};

export type SubscriptionConversionInsightsPayload = {
  window: SubscriptionConversionSummary["window"];
  funnel: SubscriptionConversionSummary["funnel"];
  breakdowns: SubscriptionConversionSummary["breakdowns"] & {
    featureKey?: Record<string, number>;
  };
  insights: {
    strongestSurface: {
      surface: string | null;
      count: number;
    };
    strongestPlanInterest: {
      targetPlan: string | null;
      count: number;
    };
    weakestFunnelStep: {
      step: string | null;
      conversion: number | null;
    };
    strongestFeatureSignal?: {
      featureKey: string;
      count: number;
    } | null;
  };
  recommendations: string[];
};

const UPGRADE_INTENT_EVENT_NAMES = new Set([
  "pricing_plan_cta_clicked",
  "upgrade_cta_clicked",
  "upgrade_prompt_checkout_clicked",
  "billing_upgrade_clicked",
]);

function toBreakdownKey(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function incrementBucket(bucket: Record<string, number>, key: string | null) {
  if (!key) return;
  bucket[key] = (bucket[key] || 0) + 1;
}

function topBucket(bucket: Record<string, number>): RankedCount | null {
  const entries = Object.entries(bucket);
  if (!entries.length) return null;
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return { key: entries[0][0], count: entries[0][1] };
}

function weakestFunnelStep(funnel: FunnelStep[]) {
  const candidates = funnel
    .map((step, index) => {
      if (index === 0) return null;
      if (typeof step.conversionFromPrevious !== "number") return null;
      return {
        step: `${funnel[index - 1].step} -> ${step.step}`,
        conversion: step.conversionFromPrevious,
      };
    })
    .filter((item): item is { step: string; conversion: number } => item != null);

  if (!candidates.length) {
    return { step: null, conversion: null };
  }

  candidates.sort((a, b) => {
    if (a.conversion !== b.conversion) return a.conversion - b.conversion;
    return a.step.localeCompare(b.step);
  });
  return candidates[0];
}

function buildFeatureBreakdown(rows: ConversionEventRow[]) {
  const bucket: Record<string, number> = {};
  for (const row of rows) {
    incrementBucket(bucket, toBreakdownKey(row.props.featureKey));
  }
  return bucket;
}

function buildIntentSurfaceBreakdown(rows: ConversionEventRow[]) {
  const bucket: Record<string, number> = {};
  for (const row of rows) {
    if (!UPGRADE_INTENT_EVENT_NAMES.has(row.name)) continue;
    incrementBucket(bucket, toBreakdownKey(row.props.surface));
  }
  return bucket;
}

function buildRecommendations(params: {
  funnel: FunnelStep[];
  strongestSurface: RankedCount | null;
  strongestPlanInterest: RankedCount | null;
  weakestStep: { step: string | null; conversion: number | null };
  promptViews: number;
  totalEvents: number;
}) {
  const recommendations: string[] = [];
  const { strongestSurface, strongestPlanInterest, weakestStep, promptViews, totalEvents } = params;

  if (strongestSurface?.key === "billing_page") {
    recommendations.push("Preserve billing as the primary upgrade hub.");
  }

  if (weakestStep.step === "pricing_page_viewed -> pricing_plan_cta_clicked") {
    recommendations.push("Strengthen plan differentiation on pricing surfaces before asking users to choose a tier.");
  } else if (weakestStep.step === "billing_page_opened -> billing_upgrade_clicked") {
    recommendations.push("Reduce hesitation on billing by making the selected upgrade and next checkout action more prominent.");
  }

  if (strongestPlanInterest?.key === "starter") {
    recommendations.push("Strengthen Pro and Elite differentiation if Starter continues to dominate upgrade interest.");
  }

  if (promptViews <= 1) {
    recommendations.push("Monitor whether prompt-driven upgrade flows become meaningful before prioritizing prompt optimization.");
  }

  if (totalEvents > 0 && totalEvents < 10) {
    recommendations.push("Treat this output as directional until more conversion event volume accumulates.");
  }

  if (!recommendations.length) {
    recommendations.push("Maintain the current funnel shape and keep monitoring surface and plan-interest shifts.");
  }

  return Array.from(new Set(recommendations));
}

export async function loadAdminSubscriptionConversionInsights(params?: {
  days?: number | string;
}): Promise<SubscriptionConversionInsightsPayload> {
  const dataset = await loadAdminSubscriptionConversionDataset(params);
  const featureKey = buildFeatureBreakdown(dataset.rows);
  const intentSurfaceBreakdown = buildIntentSurfaceBreakdown(dataset.rows);
  const strongestSurface = topBucket(intentSurfaceBreakdown);
  const strongestPlanInterest = topBucket(dataset.breakdowns.targetPlan);
  const strongestFeatureSignal = topBucket(featureKey);
  const weakestStep = weakestFunnelStep(dataset.funnel);
  const promptViews =
    dataset.funnel.find((step) => step.step === "upgrade_prompt_viewed")?.count || 0;
  const totalEvents = dataset.rows.length;

  return {
    window: dataset.window,
    funnel: dataset.funnel,
    breakdowns: {
      ...dataset.breakdowns,
      ...(Object.keys(featureKey).length ? { featureKey } : {}),
    },
    insights: {
      strongestSurface: {
        surface: strongestSurface?.key || null,
        count: strongestSurface?.count || 0,
      },
      strongestPlanInterest: {
        targetPlan: strongestPlanInterest?.key || null,
        count: strongestPlanInterest?.count || 0,
      },
      weakestFunnelStep: weakestStep,
      strongestFeatureSignal:
        strongestFeatureSignal && strongestFeatureSignal.count > 0
          ? {
              featureKey: strongestFeatureSignal.key,
              count: strongestFeatureSignal.count,
            }
          : null,
    },
    recommendations: buildRecommendations({
      funnel: dataset.funnel,
      strongestSurface,
      strongestPlanInterest,
      weakestStep,
      promptViews,
      totalEvents,
    }),
  };
}
