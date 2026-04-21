import { deriveAdminAnalyticsSnapshot } from "./deriveAdminAnalyticsSnapshot";
import type {
  AdminAnalyticsDerivedInput,
  AdminAnalyticsSnapshot,
  LandlordAnalyticsInsight,
  LandlordPropertyAnalytics,
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

function docPropertyId(doc: any) {
  return asString(doc?.propertyId || doc?.property?.id, 240);
}

function deriveEstimatedRent(leases: any[], now: number) {
  let estimatedScheduledRentCents = 0;
  let occupiedUnitsWithRent = 0;

  for (const lease of leases || []) {
    if (!isActiveLease(lease, now)) continue;
    const rentCents = monthlyRentCentsFromLease(lease);
    if (rentCents == null || rentCents <= 0) continue;
    estimatedScheduledRentCents += rentCents;
    occupiedUnitsWithRent += 1;
  }

  return {
    estimatedScheduledRentCents,
    averageRentPerOccupiedUnitCents:
      occupiedUnitsWithRent > 0 ? Math.round(estimatedScheduledRentCents / occupiedUnitsWithRent) : null,
  };
}

function derivePropertyMetrics(input: AdminAnalyticsDerivedInput): LandlordPropertyAnalytics[] {
  return (input.properties || [])
    .map((property: any) => {
      const propertyId = asString(property?.id, 240);
      if (!propertyId) return null;

      const propertyApplications = (input.applications || []).filter((doc) => docPropertyId(doc) === propertyId);
      const applicationIds = new Set(propertyApplications.map((doc: any) => asString(doc?.id, 240)).filter(Boolean));
      const propertyWorkOrders = (input.workOrders || []).filter((doc) => docPropertyId(doc) === propertyId);
      const propertyUnits = (input.units || []).filter((doc) => docPropertyId(doc) === propertyId);
      const propertyLeases = (input.leases || []).filter((doc) => docPropertyId(doc) === propertyId);
      const leaseIds = new Set(propertyLeases.map((doc: any) => asString(doc?.id, 240)).filter(Boolean));
      const workOrderIds = new Set(propertyWorkOrders.map((doc: any) => asString(doc?.id, 240)).filter(Boolean));

      const propertyEvents = (input.events || []).filter((doc) => {
        if (docPropertyId(doc) === propertyId) return true;
        if (applicationIds.has(asString(doc?.applicationId, 240))) return true;
        if (leaseIds.has(asString(doc?.leaseId, 240))) return true;
        return false;
      });

      const propertyCanonicalEvents = (input.canonicalEvents || []).filter((event: any) => {
        if (asString((event as any)?.propertyId, 240) === propertyId) return true;
        if (asString(event?.metadata?.propertyId, 240) === propertyId) return true;
        if (asString(event?.resource?.type, 80) === "property" && asString(event?.resource?.id, 240) === propertyId) {
          return true;
        }
        if (applicationIds.has(asString(event?.metadata?.applicationId, 240))) return true;
        if (asString(event?.resource?.type, 80) === "rental_application" && applicationIds.has(asString(event?.resource?.id, 240))) {
          return true;
        }
        if (leaseIds.has(asString(event?.metadata?.leaseId, 240))) return true;
        if (asString(event?.resource?.type, 80) === "lease" && leaseIds.has(asString(event?.resource?.id, 240))) return true;
        if (workOrderIds.has(asString(event?.metadata?.workOrderId, 240))) return true;
        if (
          ["maintenance_request", "work_order"].includes(asString(event?.resource?.type, 80)) &&
          workOrderIds.has(asString(event?.resource?.id, 240))
        ) {
          return true;
        }
        return false;
      });

      const propertyFinancialTransactions = (input.financialTransactions || []).filter((doc) =>
        applicationIds.has(asString(doc?.applicationId, 240))
      );

      const propertyScreeningReconciliations = (input.screeningReconciliations || []).filter((reconciliation: any) =>
        applicationIds.has(asString(reconciliation?.applicationId, 240))
      );

      const snapshot = deriveAdminAnalyticsSnapshot({
        ...input,
        applications: propertyApplications,
        screeningReconciliations: propertyScreeningReconciliations,
        financialTransactions: propertyFinancialTransactions,
        workOrders: propertyWorkOrders,
        properties: [{ id: propertyId, ...property }],
        units: propertyUnits,
        leases: propertyLeases,
        events: propertyEvents,
        canonicalEvents: propertyCanonicalEvents,
      });

      const revenue = deriveEstimatedRent(propertyLeases, input.now);

      return {
        propertyId,
        propertyName:
          asString(property?.name || property?.address || property?.title, 240) || "Untitled property",
        metrics: {
          vacancyRate: snapshot.summary.vacancyRate,
          occupancyRate: snapshot.portfolio.occupancyRate,
          applicationVolume: snapshot.applications.submitted,
          applicationConversionRate: snapshot.applications.conversionRate,
          openWorkOrders: snapshot.maintenance.openWorkOrders,
          maintenanceCostCents: snapshot.maintenance.maintenanceCostCents,
          maintenanceCostPerUnitCents:
            snapshot.portfolio.totalUnits > 0
              ? Math.round(snapshot.maintenance.maintenanceCostCents / snapshot.portfolio.totalUnits)
              : null,
          leasesEndingSoon: snapshot.portfolio.leasesEndingIn30Days,
          estimatedScheduledRentCents: revenue.estimatedScheduledRentCents,
          estimatedRentPerOccupiedUnitCents: revenue.averageRentPerOccupiedUnitCents,
          totalUnits: snapshot.portfolio.totalUnits,
          occupiedUnits: snapshot.portfolio.occupiedUnits,
          vacantUnits: snapshot.portfolio.vacantUnits,
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.propertyName.localeCompare(b!.propertyName)) as LandlordPropertyAnalytics[];
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
  const revenue = deriveEstimatedRent(input.leases || [], input.now);
  const propertyMetrics = derivePropertyMetrics(input);

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
      estimatedScheduledRentCents: revenue.estimatedScheduledRentCents,
      leasesEndingSoon,
    },
    applications: current.applications,
    leasing: current.portfolio,
    maintenance: current.maintenance,
    revenue: {
      estimatedScheduledRentCents: revenue.estimatedScheduledRentCents,
      averageRentPerOccupiedUnitCents: revenue.averageRentPerOccupiedUnitCents,
    },
    insights: deriveInsights({
      current,
      previous,
      units: input.units,
      workOrders: input.workOrders,
    }),
    comparisons: {
      previousPeriod: {
        vacancyRate: previous.summary.vacancyRate,
        applicationConversionRate: previous.applications.conversionRate,
        applicationsStarted: previous.applications.started,
        applicationsSubmitted: previous.applications.submitted,
        maintenanceCostCents: previous.maintenance.maintenanceCostCents,
        openWorkOrders: previous.maintenance.openWorkOrders,
      },
    },
    properties: (input.properties || [])
      .map((property: any) => ({
        id: asString(property?.id, 240),
        name: asString(property?.name || property?.address || property?.title, 240) || "Untitled property",
      }))
      .filter((property) => property.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    propertyMetrics,
    filters: {
      period: input.period,
      propertyId: input.propertyId ? asString(input.propertyId, 240) : null,
      from: new Date(input.from).toISOString(),
      to: new Date(input.to).toISOString(),
    },
  };
}
