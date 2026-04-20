import type {
  AdminAnalyticsDerivedInput,
  AdminAnalyticsSnapshot,
  AdminApplicationsAnalytics,
  AdminScreeningAnalytics,
  AdminMaintenanceAnalytics,
  AdminPortfolioAnalytics,
  AdminActivityAnalytics,
} from "./analyticsTypes";
import type { ScreeningReconciliationStatus } from "../reconciliation/reconciliationTypes";

const SCREENING_STATUS_KEYS: ScreeningReconciliationStatus[] = [
  "not_started",
  "quoted",
  "checkout_created",
  "payment_pending",
  "paid_not_fulfilled",
  "fulfilled",
  "blocked",
  "expired",
  "abandoned",
  "mismatch",
  "duplicate_risk",
  "needs_review",
];

const ACTIVE_WORK_ORDER_STATUSES = new Set([
  "open",
  "invited",
  "assigned",
  "accepted",
  "scheduled",
  "blocked",
  "in_progress",
]);

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function toMillis(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
  if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
  return null;
}

function isWithinRange(value: unknown, from: number, to: number) {
  const timestamp = toMillis(value);
  return timestamp != null && timestamp >= from && timestamp <= to;
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function incrementBucket(bucket: Record<string, number>, key: string | null) {
  if (!key) return;
  bucket[key] = (bucket[key] || 0) + 1;
}

function deriveApplicationsAnalytics(applications: any[], from: number, to: number): AdminApplicationsAnalytics {
  let started = 0;
  let submitted = 0;
  let approved = 0;
  let rejected = 0;
  let declined = 0;
  let pendingReviewCount = 0;

  for (const application of applications || []) {
    const status = asString(application?.status, 80).toLowerCase();

    if (status === "new" || status === "submitted" || status === "in_review") {
      pendingReviewCount += 1;
    }

    if (isWithinRange(application?.createdAt, from, to)) {
      started += 1;
    }

    if (
      isWithinRange(application?.submittedAt, from, to) ||
      (!application?.submittedAt && isWithinRange(application?.createdAt, from, to))
    ) {
      submitted += 1;
    }

    if (
      isWithinRange(application?.approvedAt, from, to) ||
      (status === "approved" && !application?.approvedAt && isWithinRange(application?.updatedAt || application?.createdAt, from, to))
    ) {
      approved += 1;
    }

    const rejectedInWindow =
      isWithinRange(application?.rejectedAt, from, to) ||
      ((status === "rejected" || status === "declined") &&
        !application?.rejectedAt &&
        isWithinRange(application?.updatedAt || application?.createdAt, from, to));

    if (rejectedInWindow) {
      if (status === "declined") declined += 1;
      else rejected += 1;
    }
  }

  return {
    started,
    submitted,
    approved,
    rejected,
    declined,
    pendingReviewCount,
    conversionRate: safeRate(approved, submitted),
  };
}

function deriveScreeningAnalytics(
  screeningReconciliations: AdminAnalyticsDerivedInput["screeningReconciliations"],
  financialTransactions: any[],
  from: number,
  to: number
): AdminScreeningAnalytics {
  const statusCounts = SCREENING_STATUS_KEYS.reduce<Record<ScreeningReconciliationStatus, number>>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<ScreeningReconciliationStatus, number>);

  let initiated = 0;
  let checkoutCreated = 0;
  let paid = 0;
  let fulfilled = 0;
  let blocked = 0;
  let expired = 0;
  let abandoned = 0;
  let needsReview = 0;

  for (const reconciliation of screeningReconciliations || []) {
    const lastActivityAt = reconciliation?.summary?.lastMeaningfulEventAt;
    if (!isWithinRange(lastActivityAt, from, to)) continue;

    const status = reconciliation.status;
    statusCounts[status] += 1;

    if (
      reconciliation.summary?.hasQuote ||
      reconciliation.summary?.hasCheckout ||
      reconciliation.summary?.hasPaidEvent ||
      reconciliation.summary?.hasFulfillment
    ) {
      initiated += 1;
    }

    if (reconciliation.summary?.hasCheckout) {
      checkoutCreated += 1;
    }

    if (reconciliation.summary?.hasPaidEvent) {
      paid += 1;
    }

    if (status === "fulfilled") fulfilled += 1;
    if (status === "blocked") blocked += 1;
    if (status === "expired") expired += 1;
    if (status === "abandoned") abandoned += 1;
    if (status === "needs_review" || status === "mismatch" || status === "duplicate_risk") {
      needsReview += 1;
    }
  }

  let totalRevenueCents = 0;
  let completedRevenueCount = 0;
  for (const transaction of financialTransactions || []) {
    if (asString(transaction?.type, 80).toLowerCase() !== "payment_succeeded") continue;
    if (!isWithinRange(transaction?.createdAt || transaction?.updatedAt, from, to)) continue;
    const amount = Number(transaction?.amountCents || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totalRevenueCents += Math.round(amount);
    completedRevenueCount += 1;
  }

  return {
    initiated,
    checkoutCreated,
    paid,
    fulfilled,
    blocked,
    expired,
    abandoned,
    needsReview,
    totalRevenueCents,
    averageRevenuePerPaidScreeningCents:
      completedRevenueCount > 0 ? Math.round(totalRevenueCents / completedRevenueCount) : null,
    statusCounts,
  };
}

function deriveMaintenanceAnalytics(workOrders: any[], from: number, to: number): AdminMaintenanceAnalytics {
  let openWorkOrders = 0;
  let completedWorkOrders = 0;
  let reopenedWorkOrders = 0;
  let maintenanceCostCents = 0;
  let completedWithCostCount = 0;
  const byPropertyCost: Record<string, { workOrderCount: number; totalCostCents: number }> = {};

  for (const workOrder of workOrders || []) {
    const status = asString(workOrder?.status, 80).toLowerCase();
    if (ACTIVE_WORK_ORDER_STATUSES.has(status)) {
      openWorkOrders += 1;
    }

    if (
      isWithinRange(workOrder?.serviceCompletedAt, from, to) ||
      (status === "completed" && !workOrder?.serviceCompletedAt && isWithinRange(workOrder?.updatedAt || workOrder?.createdAt, from, to))
    ) {
      completedWorkOrders += 1;
    }

    if (isWithinRange(workOrder?.reopenedAt, from, to)) {
      reopenedWorkOrders += 1;
    }

    const actualCostCents = Number(workOrder?.cost?.actualCostCents || workOrder?.actualCostCents || 0);
    if (!Number.isFinite(actualCostCents) || actualCostCents <= 0) continue;

    const costTimestamp =
      workOrder?.cost?.submittedAt ||
      workOrder?.cost?.reviewedAt ||
      workOrder?.serviceCompletedAt ||
      workOrder?.updatedAt ||
      workOrder?.createdAt;
    if (!isWithinRange(costTimestamp, from, to)) continue;

    const roundedCost = Math.round(actualCostCents);
    maintenanceCostCents += roundedCost;
    completedWithCostCount += 1;

    const propertyId = asString(workOrder?.propertyId, 120);
    if (propertyId) {
      byPropertyCost[propertyId] = byPropertyCost[propertyId] || { workOrderCount: 0, totalCostCents: 0 };
      byPropertyCost[propertyId].workOrderCount += 1;
      byPropertyCost[propertyId].totalCostCents += roundedCost;
    }
  }

  const costConcentrationByProperty = Object.entries(byPropertyCost)
    .map(([propertyId, metrics]) => ({
      propertyId,
      workOrderCount: metrics.workOrderCount,
      totalCostCents: metrics.totalCostCents,
    }))
    .sort((a, b) => {
      if (b.totalCostCents !== a.totalCostCents) return b.totalCostCents - a.totalCostCents;
      return a.propertyId.localeCompare(b.propertyId);
    })
    .slice(0, 5);

  return {
    openWorkOrders,
    completedWorkOrders,
    reopenedWorkOrders,
    maintenanceCostCents,
    averageCostPerCompletedWorkOrderCents:
      completedWithCostCount > 0 ? Math.round(maintenanceCostCents / completedWithCostCount) : null,
    costConcentrationByProperty,
  };
}

function isOccupiedUnit(unit: any) {
  const status = asString(unit?.status, 80).toLowerCase();
  if (status === "occupied" || status === "leased") return true;
  if (status === "vacant" || status === "available") return false;
  return Boolean(asString(unit?.tenantName, 120) || asString(unit?.tenantId, 120));
}

function derivePortfolioAnalytics(
  properties: any[],
  units: any[],
  leases: any[],
  now: number,
  from: number,
  to: number
): AdminPortfolioAnalytics {
  const totalProperties = (properties || []).length;
  const totalUnits = (units || []).length;
  const occupiedUnits = (units || []).filter(isOccupiedUnit).length;
  const vacantUnits = Math.max(0, totalUnits - occupiedUnits);

  let leasesEndingIn30Days = 0;
  let leasesEndingIn60Days = 0;
  let leasesEndingIn90Days = 0;
  let turnoverCount = 0;

  for (const lease of leases || []) {
    const endAt =
      toMillis(lease?.leaseEndDate) ||
      toMillis(lease?.endDate) ||
      toMillis(lease?.leaseEnd) ||
      toMillis(lease?.moveOutDate);
    if (endAt != null) {
      const deltaDays = Math.floor((endAt - now) / (24 * 60 * 60 * 1000));
      if (deltaDays >= 0 && deltaDays <= 30) leasesEndingIn30Days += 1;
      if (deltaDays >= 0 && deltaDays <= 60) leasesEndingIn60Days += 1;
      if (deltaDays >= 0 && deltaDays <= 90) leasesEndingIn90Days += 1;
      if (endAt >= from && endAt <= to) turnoverCount += 1;
    }
  }

  return {
    totalProperties,
    totalUnits,
    occupiedUnits,
    vacantUnits,
    occupancyRate: safeRate(occupiedUnits, totalUnits),
    leasesEndingIn30Days,
    leasesEndingIn60Days,
    leasesEndingIn90Days,
    turnoverCount,
  };
}

function deriveActivityAnalytics(events: any[], canonicalEvents: any[], from: number, to: number): AdminActivityAnalytics {
  let trackedEvents = 0;
  let canonicalTracked = 0;
  const activeActors = new Set<string>();

  for (const event of events || []) {
    if (!isWithinRange(event?.ts || event?.createdAt, from, to)) continue;
    trackedEvents += 1;
    const userId = asString(event?.userId, 120);
    const sessionId = asString(event?.sessionId, 120);
    if (userId) activeActors.add(`user:${userId}`);
    else if (sessionId) activeActors.add(`session:${sessionId}`);
  }

  for (const event of canonicalEvents || []) {
    if (!isWithinRange(event?.occurredAt || event?.recordedAt, from, to)) continue;
    canonicalTracked += 1;
  }

  return {
    trackedEvents,
    canonicalEvents: canonicalTracked,
    activeActors: activeActors.size,
  };
}

export function deriveAdminAnalyticsSnapshot(input: AdminAnalyticsDerivedInput): AdminAnalyticsSnapshot {
  const applications = deriveApplicationsAnalytics(input.applications, input.from, input.to);
  const screening = deriveScreeningAnalytics(input.screeningReconciliations, input.financialTransactions, input.from, input.to);
  const maintenance = deriveMaintenanceAnalytics(input.workOrders, input.from, input.to);
  const portfolio = derivePortfolioAnalytics(input.properties, input.units, input.leases, input.now, input.from, input.to);
  const activity = deriveActivityAnalytics(input.events, input.canonicalEvents, input.from, input.to);

  return {
    summary: {
      applicationsStarted: applications.started,
      applicationsSubmitted: applications.submitted,
      applicationConversionRate: applications.conversionRate,
      screeningsPaid: screening.paid,
      screeningRevenueCents: screening.totalRevenueCents,
      openWorkOrders: maintenance.openWorkOrders,
      maintenanceCostCents: maintenance.maintenanceCostCents,
      occupiedUnits: portfolio.occupiedUnits,
      vacancyRate: portfolio.totalUnits > 0 ? portfolio.vacantUnits / portfolio.totalUnits : null,
    },
    applications,
    screening,
    maintenance,
    portfolio,
    activity,
    filters: {
      period: input.period,
      granularity: input.granularity,
      from: new Date(input.from).toISOString(),
      to: new Date(input.to).toISOString(),
    },
  };
}
