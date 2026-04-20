import { deriveAdminAnalyticsSnapshot } from "./deriveAdminAnalyticsSnapshot";
import type {
  AdminAnalyticsDerivedInput,
  AdminAnalyticsSnapshot,
  LandlordAnalyticsInsight,
  LandlordAnalyticsSnapshot,
} from "./analyticsTypes";

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

function isOccupiedUnit(unit: any) {
  const status = asString(unit?.status, 80).toLowerCase();
  if (status === "occupied" || status === "leased") return true;
  if (status === "vacant" || status === "available") return false;
  return Boolean(asString(unit?.tenantName, 120) || asString(unit?.tenantId, 120));
}

function isActiveLease(lease: any, now: number) {
  const status = asString(lease?.status, 80).toLowerCase();
  if (status === "active" || status === "current") return true;
  const startAt = toMillis(lease?.leaseStartDate) || toMillis(lease?.startDate) || toMillis(lease?.leaseStart);
  const endAt =
    toMillis(lease?.leaseEndDate) || toMillis(lease?.endDate) || toMillis(lease?.leaseEnd) || toMillis(lease?.moveOutDate);
  if (startAt != null && startAt > now) return false;
  if (endAt != null && endAt < now) return false;
  return startAt != null || endAt != null;
}

function numberOrNull(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function monthlyRentCentsFromLease(lease: any): number | null {
  const rentCents = numberOrNull(lease?.baseRentCents, lease?.monthlyRentCents, lease?.rentCents, lease?.scheduledRentCents);
  if (rentCents != null) return Math.round(rentCents);

  const rentDollars = numberOrNull(lease?.monthlyRent, lease?.currentRent, lease?.rent, lease?.scheduledRent);
  return rentDollars != null ? Math.round(rentDollars * 100) : null;
}

function buildPreviousInput(input: AdminAnalyticsDerivedInput): AdminAnalyticsDerivedInput {
  const duration = Math.max(1, input.to - input.from);
  const previousTo = input.from - 1;
  const previousFrom = previousTo - duration;
  return {
    ...input,
    from: previousFrom,
    to: previousTo,
  };
}

function vacancyByProperty(units: any[]) {
  const counts = new Map<string, number>();
  for (const unit of units || []) {
    if (isOccupiedUnit(unit)) continue;
    const propertyId = asString(unit?.propertyId, 120);
    if (!propertyId) continue;
    counts.set(propertyId, (counts.get(propertyId) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([propertyId, vacantUnits]) => ({ propertyId, vacantUnits }))
    .sort((a, b) => {
      if (b.vacantUnits !== a.vacantUnits) return b.vacantUnits - a.vacantUnits;
      return a.propertyId.localeCompare(b.propertyId);
    });
}

function openWorkOrdersByProperty(workOrders: any[]) {
  const activeStatuses = new Set(["open", "invited", "assigned", "accepted", "scheduled", "blocked", "in_progress"]);
  const counts = new Map<string, number>();
  for (const workOrder of workOrders || []) {
    const status = asString(workOrder?.status, 80).toLowerCase();
    if (!activeStatuses.has(status)) continue;
    const propertyId = asString(workOrder?.propertyId, 120);
    if (!propertyId) continue;
    counts.set(propertyId, (counts.get(propertyId) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([propertyId, openWorkOrders]) => ({ propertyId, openWorkOrders }))
    .sort((a, b) => {
      if (b.openWorkOrders !== a.openWorkOrders) return b.openWorkOrders - a.openWorkOrders;
      return a.propertyId.localeCompare(b.propertyId);
    });
}

function deriveInsights(params: {
  current: AdminAnalyticsSnapshot;
  previous: AdminAnalyticsSnapshot;
  units: any[];
  workOrders: any[];
}) {
  const insights: LandlordAnalyticsInsight[] = [];
  const { current, previous, units, workOrders } = params;

  if (current.portfolio.leasesEndingIn30Days > 0) {
    insights.push({
      type: "lease_expiry",
      severity: current.portfolio.leasesEndingIn30Days >= 3 ? "high" : "medium",
      message:
        current.portfolio.leasesEndingIn30Days === 1
          ? "1 lease ends within 30 days."
          : `${current.portfolio.leasesEndingIn30Days} leases end within 30 days.`,
    });
  }

  if (current.portfolio.vacantUnits > 1) {
    const [topVacancy] = vacancyByProperty(units);
    if (topVacancy && topVacancy.vacantUnits >= Math.max(2, Math.ceil(current.portfolio.vacantUnits / 2))) {
      insights.push({
        type: "vacancy_concentration",
        severity: topVacancy.vacantUnits >= 3 ? "high" : "medium",
        propertyId: topVacancy.propertyId,
        message: `Vacancy is concentrated in one property with ${topVacancy.vacantUnits} vacant units.`,
      });
    }
  }

  if (
    current.maintenance.maintenanceCostCents > 0 &&
    previous.maintenance.maintenanceCostCents > 0 &&
    current.maintenance.maintenanceCostCents > previous.maintenance.maintenanceCostCents * 1.25
  ) {
    insights.push({
      type: "maintenance_cost_increase",
      severity: "medium",
      message: "Maintenance costs increased compared with the previous period.",
    });
  }

  if (
    previous.applications.submitted > 0 &&
    current.applications.submitted < previous.applications.submitted
  ) {
    insights.push({
      type: "applications_drop",
      severity: "low",
      message: "Applications dropped compared with the previous period.",
    });
  }

  if (current.maintenance.openWorkOrders > 1) {
    const [topProperty] = openWorkOrdersByProperty(workOrders);
    if (topProperty && topProperty.openWorkOrders >= Math.max(2, Math.ceil(current.maintenance.openWorkOrders / 2))) {
      insights.push({
        type: "work_order_concentration",
        severity: topProperty.openWorkOrders >= 4 ? "high" : "medium",
        propertyId: topProperty.propertyId,
        message: `Most open work orders are tied to one property (${topProperty.openWorkOrders}).`,
      });
    }
  }

  return insights.slice(0, 4);
}

export function deriveLandlordAnalyticsSnapshot(input: AdminAnalyticsDerivedInput & { propertyId?: string | null }): LandlordAnalyticsSnapshot {
  const current = deriveAdminAnalyticsSnapshot(input);
  const previous = deriveAdminAnalyticsSnapshot(buildPreviousInput(input));

  let estimatedScheduledRentCents = 0;
  let occupiedUnitsWithRent = 0;
  for (const lease of input.leases || []) {
    if (!isActiveLease(lease, input.now)) continue;
    const rentCents = monthlyRentCentsFromLease(lease);
    if (rentCents == null || rentCents <= 0) continue;
    estimatedScheduledRentCents += rentCents;
    occupiedUnitsWithRent += 1;
  }

  const activeApplications = current.applications.pendingReviewCount;
  const leasesEndingSoon = current.portfolio.leasesEndingIn30Days;

  return {
    summary: {
      occupiedUnits: current.portfolio.occupiedUnits,
      vacancyRate: current.summary.vacancyRate,
      activeApplications,
      applicationConversionRate: current.applications.conversionRate,
      openWorkOrders: current.maintenance.openWorkOrders,
      maintenanceCostCents: current.maintenance.maintenanceCostCents,
      estimatedScheduledRentCents,
      leasesEndingSoon,
    },
    applications: current.applications,
    leasing: current.portfolio,
    maintenance: current.maintenance,
    revenue: {
      estimatedScheduledRentCents,
      averageRentPerOccupiedUnitCents:
        occupiedUnitsWithRent > 0 ? Math.round(estimatedScheduledRentCents / occupiedUnitsWithRent) : null,
    },
    insights: deriveInsights({
      current,
      previous,
      units: input.units,
      workOrders: input.workOrders,
    }),
    properties: (input.properties || [])
      .map((property: any) => ({
        id: asString(property?.id, 240),
        name: asString(property?.name || property?.address || property?.title, 240) || "Untitled property",
      }))
      .filter((property) => property.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    filters: {
      period: input.period,
      propertyId: input.propertyId ? asString(input.propertyId, 240) : null,
      from: new Date(input.from).toISOString(),
      to: new Date(input.to).toISOString(),
    },
  };
}
