import { deriveAdminAnalyticsSnapshot } from "./deriveAdminAnalyticsSnapshot";
import { deriveAnalyticsDelta, derivePropertyMetricDeltas } from "./deriveAnalyticsDeltas";
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
    now: previousTo,
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
  const previousInput = buildPreviousInput(input);
  const previous = deriveAdminAnalyticsSnapshot(previousInput);
  const revenue = deriveEstimatedRent(input.leases || [], input.now);
  const previousRevenue = deriveEstimatedRent(input.leases || [], previousInput.to);
  const propertyMetrics = derivePropertyMetrics(input);
  const previousPropertyMetrics = derivePropertyMetrics(previousInput);
  const propertyMetricsWithDeltas = derivePropertyMetricDeltas({
    current: propertyMetrics,
    previous: previousPropertyMetrics,
  });

  const activeApplications = current.applications.pendingReviewCount;
  const leasesEndingSoon = current.portfolio.leasesEndingIn30Days;
  const previousActiveApplications = previous.applications.pendingReviewCount;
  const previousLeasesEndingSoon = previous.portfolio.leasesEndingIn30Days;

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
        summary: {
          occupiedUnits: previous.portfolio.occupiedUnits,
          vacancyRate: previous.summary.vacancyRate,
          activeApplications: previousActiveApplications,
          applicationConversionRate: previous.applications.conversionRate,
          openWorkOrders: previous.maintenance.openWorkOrders,
          maintenanceCostCents: previous.maintenance.maintenanceCostCents,
          estimatedScheduledRentCents: previousRevenue.estimatedScheduledRentCents,
          leasesEndingSoon: previousLeasesEndingSoon,
        },
        applications: previous.applications,
        leasing: previous.portfolio,
        maintenance: previous.maintenance,
        revenue: previousRevenue,
      },
      deltas: {
        summary: {
          occupiedUnits: deriveAnalyticsDelta({
            current: current.portfolio.occupiedUnits,
            prior: previous.portfolio.occupiedUnits,
            preference: "higher_better",
          }),
          vacancyRate: deriveAnalyticsDelta({
            current: current.summary.vacancyRate,
            prior: previous.summary.vacancyRate,
            preference: "lower_better",
          }),
          activeApplications: deriveAnalyticsDelta({
            current: activeApplications,
            prior: previousActiveApplications,
            preference: "higher_better",
          }),
          applicationConversionRate: deriveAnalyticsDelta({
            current: current.applications.conversionRate,
            prior: previous.applications.conversionRate,
            preference: "higher_better",
          }),
          openWorkOrders: deriveAnalyticsDelta({
            current: current.maintenance.openWorkOrders,
            prior: previous.maintenance.openWorkOrders,
            preference: "lower_better",
          }),
          maintenanceCostCents: deriveAnalyticsDelta({
            current: current.maintenance.maintenanceCostCents,
            prior: previous.maintenance.maintenanceCostCents,
            preference: "lower_better",
          }),
          estimatedScheduledRentCents: deriveAnalyticsDelta({
            current: revenue.estimatedScheduledRentCents,
            prior: previousRevenue.estimatedScheduledRentCents,
            preference: "higher_better",
          }),
          leasesEndingSoon: deriveAnalyticsDelta({
            current: leasesEndingSoon,
            prior: previousLeasesEndingSoon,
            preference: "lower_better",
          }),
        },
        applications: {
          started: deriveAnalyticsDelta({
            current: current.applications.started,
            prior: previous.applications.started,
            preference: "higher_better",
          }),
          submitted: deriveAnalyticsDelta({
            current: current.applications.submitted,
            prior: previous.applications.submitted,
            preference: "higher_better",
          }),
          approved: deriveAnalyticsDelta({
            current: current.applications.approved,
            prior: previous.applications.approved,
            preference: "higher_better",
          }),
          rejected: deriveAnalyticsDelta({
            current: current.applications.rejected,
            prior: previous.applications.rejected,
            preference: "lower_better",
          }),
          declined: deriveAnalyticsDelta({
            current: current.applications.declined,
            prior: previous.applications.declined,
            preference: "lower_better",
          }),
          pendingReviewCount: deriveAnalyticsDelta({
            current: current.applications.pendingReviewCount,
            prior: previous.applications.pendingReviewCount,
            preference: "lower_better",
          }),
          conversionRate: deriveAnalyticsDelta({
            current: current.applications.conversionRate,
            prior: previous.applications.conversionRate,
            preference: "higher_better",
          }),
        },
        leasing: {
          occupiedUnits: deriveAnalyticsDelta({
            current: current.portfolio.occupiedUnits,
            prior: previous.portfolio.occupiedUnits,
            preference: "higher_better",
          }),
          vacantUnits: deriveAnalyticsDelta({
            current: current.portfolio.vacantUnits,
            prior: previous.portfolio.vacantUnits,
            preference: "lower_better",
          }),
          occupancyRate: deriveAnalyticsDelta({
            current: current.portfolio.occupancyRate,
            prior: previous.portfolio.occupancyRate,
            preference: "higher_better",
          }),
          leasesEndingIn30Days: deriveAnalyticsDelta({
            current: current.portfolio.leasesEndingIn30Days,
            prior: previous.portfolio.leasesEndingIn30Days,
            preference: "lower_better",
          }),
          leasesEndingIn60Days: deriveAnalyticsDelta({
            current: current.portfolio.leasesEndingIn60Days,
            prior: previous.portfolio.leasesEndingIn60Days,
            preference: "lower_better",
          }),
          leasesEndingIn90Days: deriveAnalyticsDelta({
            current: current.portfolio.leasesEndingIn90Days,
            prior: previous.portfolio.leasesEndingIn90Days,
            preference: "lower_better",
          }),
        },
        maintenance: {
          openWorkOrders: deriveAnalyticsDelta({
            current: current.maintenance.openWorkOrders,
            prior: previous.maintenance.openWorkOrders,
            preference: "lower_better",
          }),
          completedWorkOrders: deriveAnalyticsDelta({
            current: current.maintenance.completedWorkOrders,
            prior: previous.maintenance.completedWorkOrders,
            preference: "higher_better",
          }),
          reopenedWorkOrders: deriveAnalyticsDelta({
            current: current.maintenance.reopenedWorkOrders,
            prior: previous.maintenance.reopenedWorkOrders,
            preference: "lower_better",
          }),
          maintenanceCostCents: deriveAnalyticsDelta({
            current: current.maintenance.maintenanceCostCents,
            prior: previous.maintenance.maintenanceCostCents,
            preference: "lower_better",
          }),
          averageCostPerCompletedWorkOrderCents: deriveAnalyticsDelta({
            current: current.maintenance.averageCostPerCompletedWorkOrderCents,
            prior: previous.maintenance.averageCostPerCompletedWorkOrderCents,
            preference: "lower_better",
          }),
        },
        revenue: {
          estimatedScheduledRentCents: deriveAnalyticsDelta({
            current: revenue.estimatedScheduledRentCents,
            prior: previousRevenue.estimatedScheduledRentCents,
            preference: "higher_better",
          }),
          averageRentPerOccupiedUnitCents: deriveAnalyticsDelta({
            current: revenue.averageRentPerOccupiedUnitCents,
            prior: previousRevenue.averageRentPerOccupiedUnitCents,
            preference: "higher_better",
          }),
        },
      },
    },
    properties: (input.properties || [])
      .map((property: any) => ({
        id: asString(property?.id, 240),
        name: asString(property?.name || property?.address || property?.title, 240) || "Untitled property",
      }))
      .filter((property) => property.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    propertyMetrics: propertyMetricsWithDeltas,
    filters: {
      period: input.period,
      propertyId: input.propertyId ? asString(input.propertyId, 240) : null,
      from: new Date(input.from).toISOString(),
      to: new Date(input.to).toISOString(),
    },
  };
}
