import type { LandlordActiveLease, LeaseAutomationTask } from "@/api/leasesApi";

export type RenewalPipelineTimingBucketKey =
  | "past_due"
  | "next_30"
  | "next_60"
  | "next_90"
  | "later"
  | "missing_date";

export type RenewalPipelineCategory =
  | "Ending soon"
  | "Renewal review"
  | "Rent increase review"
  | "Notice timing review"
  | "Move-out preparation"
  | "Execution/signing review"
  | "Healthy/no immediate action";

export type RenewalPipelineRouteKind = "summary" | "renewal" | "rent-increase" | "notice" | "move-out";

export type RenewalPipelineItem = {
  leaseId: string;
  propertyLabel: string;
  unitLabel: string;
  tenantLabel: string;
  endDateLabel: string;
  daysUntilEnd: number | null;
  timingBucket: RenewalPipelineTimingBucketKey;
  timingLabel: string;
  category: RenewalPipelineCategory;
  statusLabel: string;
  nextActionLabel: string;
  href: string;
  routeKind: RenewalPipelineRouteKind;
  detail: string;
  sortRank: number;
};

export const RENEWAL_PIPELINE_BUCKETS: Array<{
  key: RenewalPipelineTimingBucketKey;
  label: string;
}> = [
  { key: "past_due", label: "Past due / needs immediate review" },
  { key: "next_30", label: "Next 30 days" },
  { key: "next_60", label: "Next 60 days" },
  { key: "next_90", label: "Next 90 days" },
  { key: "later", label: "Later" },
  { key: "missing_date", label: "Missing date / needs review" },
];

const BUCKET_RANK: Record<RenewalPipelineTimingBucketKey, number> = {
  past_due: 0,
  missing_date: 1,
  next_30: 2,
  next_60: 3,
  next_90: 4,
  later: 5,
};

function workflowHref(leaseId: string, routeKind: RenewalPipelineRouteKind) {
  const base = `/leases/${encodeURIComponent(leaseId)}`;
  if (routeKind === "summary") return `${base}/summary`;
  return `${base}/workflows/${routeKind}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date needs review";
  return parsed.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function daysUntilDate(value: string | null | undefined, now: Date) {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const todayDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.ceil((endDay - todayDay) / 86_400_000);
}

function timingBucket(daysUntilEnd: number | null): RenewalPipelineTimingBucketKey {
  if (daysUntilEnd == null) return "missing_date";
  if (daysUntilEnd < 0) return "past_due";
  if (daysUntilEnd <= 30) return "next_30";
  if (daysUntilEnd <= 60) return "next_60";
  if (daysUntilEnd <= 90) return "next_90";
  return "later";
}

function timingLabel(daysUntilEnd: number | null, bucket: RenewalPipelineTimingBucketKey) {
  if (daysUntilEnd == null) return "Lease end date needs review";
  if (daysUntilEnd < 0) return "Lease end date has passed";
  if (daysUntilEnd === 0) return "Lease ends today";
  if (daysUntilEnd === 1) return "1 day to lease end";
  if (bucket === "later") return `${daysUntilEnd} days to lease end`;
  return `${daysUntilEnd} days to lease end`;
}

function taskKinds(lease: LandlordActiveLease) {
  return (lease.automationTasks || [])
    .map((task: LeaseAutomationTask) => String(task.kind || "").trim())
    .filter(Boolean);
}

function hasReviewPolicy(lease: LandlordActiveLease, pattern: RegExp) {
  return (lease.jurisdictionPolicies || []).some((policy) => {
    return policy.status === "review" && pattern.test(String(policy.policyKey || ""));
  });
}

function deriveCategory(lease: LandlordActiveLease, bucket: RenewalPipelineTimingBucketKey): {
  category: RenewalPipelineCategory;
  routeKind: RenewalPipelineRouteKind;
  nextActionLabel: string;
  statusLabel: string;
  detail: string;
} {
  const lifecycle = lease.leaseLifecycleSummary;
  const requiredAction = String(lifecycle?.requiredNextAction || "").trim();
  const lifecycleStatus = String(lifecycle?.lifecycleStatus || "").trim();
  const tasks = taskKinds(lease);
  const executionStatus = String(lease.leaseExecution?.executionStatus || "").trim();
  const signatureStatus = String(lease.signatureStatus || "").trim();

  if (
    String(lease.status || "") === "move_out_pending" ||
    lifecycleStatus === "ending" ||
    requiredAction === "review_move_out" ||
    tasks.some((kind) => kind.startsWith("move_out_"))
  ) {
    return {
      category: "Move-out preparation",
      routeKind: "move-out",
      nextActionLabel: "Review move-out preparation",
      statusLabel: lifecycle?.lifecycleLabel || "Move-out preparation",
      detail: "Review move-out preparation and check jurisdiction requirements before taking action.",
    };
  }

  if (
    tasks.includes("rent_increase_eligibility_check") ||
    hasReviewPolicy(lease, /rent_increase/)
  ) {
    return {
      category: "Rent increase review",
      routeKind: "rent-increase",
      nextActionLabel: "Review rent increase workflow",
      statusLabel: "Rent increase review",
      detail: "Review rent increase context and check jurisdiction requirements before preparing any notice.",
    };
  }

  if (hasReviewPolicy(lease, /notice/)) {
    return {
      category: "Notice timing review",
      routeKind: "notice",
      nextActionLabel: "Review notice timing",
      statusLabel: "Notice timing review",
      detail: "Review notice timing context and check jurisdiction requirements before preparing notices.",
    };
  }

  if (
    requiredAction === "prepare_renewal_notice" ||
    requiredAction === "follow_up_response" ||
    requiredAction === "review_renewal_outcome" ||
    lifecycleStatus === "renewal_pending" ||
    lifecycleStatus === "no_response" ||
    tasks.includes("renewal_reminder") ||
    tasks.includes("renewal_offer_draft") ||
    hasReviewPolicy(lease, /renewal/)
  ) {
    return {
      category: "Renewal review",
      routeKind: "renewal",
      nextActionLabel: "Review renewal workflow",
      statusLabel: lifecycle?.lifecycleLabel || "Renewal planning",
      detail: "Review the renewal planning window and check jurisdiction requirements before preparing next steps.",
    };
  }

  if (
    executionStatus &&
    executionStatus !== "fully_executed" &&
    executionStatus !== "landlord_signed"
  ) {
    return {
      category: "Execution/signing review",
      routeKind: "summary",
      nextActionLabel: "Open lease summary",
      statusLabel: lease.leaseExecution?.executionLabel || "Execution review",
      detail: "Review signing and document readiness before relying on renewal planning.",
    };
  }

  if (signatureStatus && signatureStatus !== "signed" && signatureStatus !== "unavailable") {
    return {
      category: "Execution/signing review",
      routeKind: "summary",
      nextActionLabel: "Open lease summary",
      statusLabel: lease.signatureReadinessLabel || "Signature review",
      detail: "Review signing and document readiness before relying on renewal planning.",
    };
  }

  if (bucket === "missing_date") {
    return {
      category: "Renewal review",
      routeKind: "summary",
      nextActionLabel: "Confirm lease end date",
      statusLabel: "Missing lease end date",
      detail: "Confirm the lease end date before renewal planning or notice timing review.",
    };
  }

  if (bucket === "past_due" || bucket === "next_30" || bucket === "next_60" || bucket === "next_90") {
    return {
      category: "Ending soon",
      routeKind: "renewal",
      nextActionLabel: "Review renewal workflow",
      statusLabel: lifecycle?.lifecycleLabel || "Review window",
      detail: "Review renewal planning, notice timing, and move-out preparation options; check jurisdiction requirements.",
    };
  }

  return {
    category: "Healthy/no immediate action",
    routeKind: "summary",
    nextActionLabel: "Open lease summary",
    statusLabel: lifecycle?.lifecycleLabel || "No immediate review",
    detail: "No immediate renewal pipeline action is visible from current lease dates.",
  };
}

function actionRank(category: RenewalPipelineCategory) {
  switch (category) {
    case "Rent increase review":
    case "Notice timing review":
    case "Move-out preparation":
    case "Renewal review":
      return 0;
    case "Execution/signing review":
    case "Ending soon":
      return 1;
    default:
      return 2;
  }
}

function leaseLabels(lease: LandlordActiveLease) {
  const propertyLabel = lease.propertyName || lease.propertyLabel || lease.propertyAddress || "Property";
  const unitLabel = lease.unitLabel || lease.unitNumber || "Unit not set";
  const tenantLabel = lease.tenantName || "Tenant not linked";
  return { propertyLabel, unitLabel, tenantLabel };
}

export function deriveRenewalPipelineItems(
  leases: LandlordActiveLease[],
  now = new Date()
): RenewalPipelineItem[] {
  return leases
    .map((lease) => {
      const summaryDays = lease.leaseLifecycleSummary?.daysUntilExpiry;
      const daysUntilEnd = typeof summaryDays === "number" ? summaryDays : daysUntilDate(lease.endDate, now);
      const bucket = timingBucket(daysUntilEnd);
      const categoryMeta = deriveCategory(lease, bucket);
      const labels = leaseLabels(lease);
      return {
        leaseId: lease.id,
        ...labels,
        endDateLabel: formatDate(lease.endDate),
        daysUntilEnd,
        timingBucket: bucket,
        timingLabel: timingLabel(daysUntilEnd, bucket),
        ...categoryMeta,
        href: workflowHref(lease.id, categoryMeta.routeKind),
        sortRank: BUCKET_RANK[bucket] * 10 + actionRank(categoryMeta.category),
      };
    })
    .sort((a, b) => {
      return (
        a.sortRank - b.sortRank ||
        (a.daysUntilEnd ?? Number.POSITIVE_INFINITY) - (b.daysUntilEnd ?? Number.POSITIVE_INFINITY) ||
        a.propertyLabel.localeCompare(b.propertyLabel) ||
        a.unitLabel.localeCompare(b.unitLabel)
      );
    });
}

export function countRenewalPipelineBuckets(items: RenewalPipelineItem[]) {
  return RENEWAL_PIPELINE_BUCKETS.map((bucket) => ({
    ...bucket,
    count: items.filter((item) => item.timingBucket === bucket.key).length,
  }));
}

export function isRenewalPipelineActionable(item: RenewalPipelineItem) {
  return item.category !== "Healthy/no immediate action" || item.timingBucket !== "later";
}
