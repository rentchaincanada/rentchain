import { db } from "../../firebase";
import {
  buildSubscriptionConversionSummary,
  loadAdminSubscriptionConversionDataset,
  type ConversionEventRow,
  type SubscriptionConversionSummary,
} from "./adminSubscriptionConversionView";

type FunnelStep = SubscriptionConversionSummary["funnel"][number];

type RankedCount = {
  key: string;
  count: number;
};

type SegmentKey = "all_activity" | "likely_internal_or_test" | "likely_external_or_real";

type SegmentInsights = {
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
  strongestFeatureSignal: {
    featureKey: string;
    count: number;
  } | null;
  promptViewCount: number;
};

export type SubscriptionConversionValidationSegment = SubscriptionConversionSummary & {
  eventCount: number;
  actorCount: number;
  breakdowns: SubscriptionConversionSummary["breakdowns"] & {
    featureKey?: Record<string, number>;
  };
  insights: SegmentInsights;
};

export type SubscriptionConversionValidationPayload = {
  window: SubscriptionConversionSummary["window"];
  segmentation: {
    strategy: "internal_allowlist_plus_heuristics_v1";
    buckets: Record<SegmentKey, { description: string }>;
    caveats: string[];
  };
  segments: Record<SegmentKey, SubscriptionConversionValidationSegment>;
  comparisons: {
    dominantSegment: {
      segment: Exclude<SegmentKey, "all_activity">;
      eventCount: number;
    } | null;
    strongestSurfaceAlignment: {
      allActivity: string | null;
      likelyInternalOrTest: string | null;
      likelyExternalOrReal: string | null;
    };
  };
  recommendations: string[];
};

const UPGRADE_INTENT_EVENT_NAMES = new Set([
  "pricing_plan_cta_clicked",
  "upgrade_cta_clicked",
  "upgrade_prompt_checkout_clicked",
  "billing_upgrade_clicked",
]);

const INTERNAL_TEST_EMAILS = new Set([
  "admin+free@rentchain.ai",
  "admin+starter@rentchain.ai",
  "admin+pro@rentchain.ai",
  "admin+elite@rentchain.ai",
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

function buildSegmentInsights(params: {
  rows: ConversionEventRow[];
  breakdowns: SubscriptionConversionSummary["breakdowns"];
  funnel: SubscriptionConversionSummary["funnel"];
}): SegmentInsights {
  const { rows, breakdowns, funnel } = params;
  const featureKey = buildFeatureBreakdown(rows);
  const strongestSurface = topBucket(buildIntentSurfaceBreakdown(rows));
  const strongestPlanInterest = topBucket(breakdowns.targetPlan);
  const strongestFeatureSignal = topBucket(featureKey);
  const promptViewCount = funnel.find((step) => step.step === "upgrade_prompt_viewed")?.count || 0;

  return {
    strongestSurface: {
      surface: strongestSurface?.key || null,
      count: strongestSurface?.count || 0,
    },
    strongestPlanInterest: {
      targetPlan: strongestPlanInterest?.key || null,
      count: strongestPlanInterest?.count || 0,
    },
    weakestFunnelStep: weakestFunnelStep(funnel),
    strongestFeatureSignal:
      strongestFeatureSignal && strongestFeatureSignal.count > 0
        ? {
            featureKey: strongestFeatureSignal.key,
            count: strongestFeatureSignal.count,
          }
        : null,
    promptViewCount,
  };
}

function buildSegmentSummary(params: {
  rows: ConversionEventRow[];
  days: number;
  from: number;
  to: number;
  actorCount: number;
}): SubscriptionConversionValidationSegment {
  const { rows, days, from, to, actorCount } = params;
  const summary = buildSubscriptionConversionSummary({ rows, days, from, to });
  const featureKey = buildFeatureBreakdown(rows);

  return {
    ...summary,
    eventCount: rows.length,
    actorCount,
    breakdowns: {
      ...summary.breakdowns,
      ...(Object.keys(featureKey).length ? { featureKey } : {}),
    },
    insights: buildSegmentInsights({
      rows,
      breakdowns: summary.breakdowns,
      funnel: summary.funnel,
    }),
  };
}

type ActorStats = {
  actorKey: string;
  rows: ConversionEventRow[];
  targetPlans: Set<string>;
  eventNames: Set<string>;
  email: string | null;
};

function toActorKey(row: ConversionEventRow) {
  if (row.userId) return `user:${row.userId}`;
  if (row.sessionId) return `session:${row.sessionId}`;
  return "unknown";
}

function classifyActor(stats: ActorStats): Exclude<SegmentKey, "all_activity"> {
  if (stats.email && INTERNAL_TEST_EMAILS.has(stats.email)) return "likely_internal_or_test";
  if (stats.actorKey === "unknown") return "likely_internal_or_test";
  if (stats.targetPlans.size >= 3) return "likely_internal_or_test";
  if (stats.targetPlans.size >= 2 && stats.rows.length >= 8) return "likely_internal_or_test";
  if (stats.rows.length >= 12 && stats.eventNames.size >= 5) return "likely_internal_or_test";
  return "likely_external_or_real";
}

function toNormalizedEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

async function loadActorEmails(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const emailByUserId = new Map<string, string | null>();

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const [userSnap, accountSnap] = await Promise.all([
        db.collection("users").doc(userId).get(),
        db.collection("accounts").doc(userId).get(),
      ]);
      const email =
        toNormalizedEmail(userSnap.data()?.email) ||
        toNormalizedEmail(accountSnap.data()?.email) ||
        null;
      emailByUserId.set(userId, email);
    })
  );

  return emailByUserId;
}

async function buildActorStats(rows: ConversionEventRow[]) {
  const emailByUserId = await loadActorEmails(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)));
  const actorMap = new Map<string, ActorStats>();
  for (const row of rows) {
    const actorKey = toActorKey(row);
    const existing = actorMap.get(actorKey) || {
      actorKey,
      rows: [],
      targetPlans: new Set<string>(),
      eventNames: new Set<string>(),
      email: row.userId ? emailByUserId.get(row.userId) || null : null,
    };
    existing.rows.push(row);
    existing.eventNames.add(row.name);
    const targetPlan = toBreakdownKey(row.props.targetPlan);
    if (targetPlan) existing.targetPlans.add(targetPlan);
    actorMap.set(actorKey, existing);
  }
  return Array.from(actorMap.values());
}

function buildRecommendations(payload: {
  segments: Record<SegmentKey, SubscriptionConversionValidationSegment>;
}) {
  const recommendations: string[] = [];
  const internal = payload.segments.likely_internal_or_test;
  const external = payload.segments.likely_external_or_real;
  const all = payload.segments.all_activity;

  if (internal.eventCount > external.eventCount && internal.eventCount > 0) {
    recommendations.push("Current funnel activity is dominated by likely internal or controlled testing traffic.");
  }

  if (
    all.insights.strongestSurface.surface === "billing_page" &&
    external.insights.strongestSurface.surface === "billing_page"
  ) {
    recommendations.push("Billing remains the strongest surface across both all activity and likely external activity.");
  }

  if (external.insights.promptViewCount <= 1) {
    recommendations.push("Prompt usage remains negligible outside likely internal or testing activity.");
  }

  if (external.eventCount > 0 && external.eventCount < 10) {
    recommendations.push("Treat likely external activity as directional until more non-test conversion volume accumulates.");
  }

  if (!recommendations.length) {
    recommendations.push("Use the segment split as a confidence lens, not as authoritative identity truth.");
  }

  return Array.from(new Set(recommendations));
}

export async function loadAdminSubscriptionConversionValidation(params?: {
  days?: number | string;
}): Promise<SubscriptionConversionValidationPayload> {
  const dataset = await loadAdminSubscriptionConversionDataset(params);
  const from = Date.parse(dataset.window.from);
  const to = Date.parse(dataset.window.to);
  const actorStats = await buildActorStats(dataset.rows);

  const segmentedRows: Record<Exclude<SegmentKey, "all_activity">, ConversionEventRow[]> = {
    likely_internal_or_test: [],
    likely_external_or_real: [],
  };
  const actorCounts = {
    likely_internal_or_test: 0,
    likely_external_or_real: 0,
  };

  for (const stats of actorStats) {
    const segment = classifyActor(stats);
    segmentedRows[segment].push(...stats.rows);
    actorCounts[segment] += 1;
  }

  const segments: Record<SegmentKey, SubscriptionConversionValidationSegment> = {
    all_activity: buildSegmentSummary({
      rows: dataset.rows,
      days: dataset.window.days,
      from,
      to,
      actorCount: actorStats.length,
    }),
    likely_internal_or_test: buildSegmentSummary({
      rows: segmentedRows.likely_internal_or_test,
      days: dataset.window.days,
      from,
      to,
      actorCount: actorCounts.likely_internal_or_test,
    }),
    likely_external_or_real: buildSegmentSummary({
      rows: segmentedRows.likely_external_or_real,
      days: dataset.window.days,
      from,
      to,
      actorCount: actorCounts.likely_external_or_real,
    }),
  };

  const dominantSegment =
    segments.likely_internal_or_test.eventCount === segments.likely_external_or_real.eventCount
      ? null
      : segments.likely_internal_or_test.eventCount > segments.likely_external_or_real.eventCount
        ? {
            segment: "likely_internal_or_test" as const,
            eventCount: segments.likely_internal_or_test.eventCount,
          }
        : {
            segment: "likely_external_or_real" as const,
            eventCount: segments.likely_external_or_real.eventCount,
          };

  return {
    window: dataset.window,
    segmentation: {
      strategy: "internal_allowlist_plus_heuristics_v1",
      buckets: {
        all_activity: {
          description: "All Mission 29-style conversion events in the bounded window.",
        },
        likely_internal_or_test: {
          description:
            "Activity from allowlisted internal actors or from actors showing repeated multi-plan or high-volume exploration patterns consistent with testing.",
        },
        likely_external_or_real: {
          description:
            "Remaining activity after explicit internal allowlist checks and conservative internal/testing heuristics are applied. This is directional, not authoritative identity truth.",
        },
      },
      caveats: [
        "Known internal test accounts are classified explicitly through an internal allowlist when their userId resolves to a matching email.",
        "All remaining segmentation is heuristic and actor-pattern based, not verified identity truth.",
        "The model is intentionally conservative and may leave some testing activity in likely_external_or_real.",
        "Output is aggregate only and should be used as a confidence lens before making stronger optimization decisions.",
      ],
    },
    segments,
    comparisons: {
      dominantSegment,
      strongestSurfaceAlignment: {
        allActivity: segments.all_activity.insights.strongestSurface.surface,
        likelyInternalOrTest: segments.likely_internal_or_test.insights.strongestSurface.surface,
        likelyExternalOrReal: segments.likely_external_or_real.insights.strongestSurface.surface,
      },
    },
    recommendations: buildRecommendations({ segments }),
  };
}
