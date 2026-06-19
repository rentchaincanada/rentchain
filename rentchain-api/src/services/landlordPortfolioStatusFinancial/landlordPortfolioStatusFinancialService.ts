import { deriveLeaseLifecycleState } from "../../lib/leases/leaseLifecycle";
import type {
  LandlordPortfolioStatusFinancialInput,
  LandlordPortfolioStatusFinancialSummary,
  PortfolioDataQualityFlag,
  PortfolioFinancialSnapshot,
  PortfolioMetricConfidence,
  PortfolioOccupancySummary,
  PortfolioPaymentRecord,
  PortfolioPaymentSource,
  PortfolioPropertyRecord,
  PortfolioTenantRecord,
  PortfolioUnitRecord,
} from "./landlordPortfolioStatusFinancialTypes";

const VERSION = "landlord_portfolio_status_financial_v1" as const;

type NormalizedUnit = {
  id: string;
  propertyId: string | null;
  unitNumber: string | null;
  status: string;
  occupancyStatus: string;
  currentLeaseId: string | null;
  currentTenantId: string | null;
};

type NormalizedLease = {
  raw: Record<string, unknown>;
  id: string;
  propertyId: string | null;
  unitId: string | null;
  unitNumber: string | null;
  tenantId: string | null;
  tenantIds: string[];
  rentCents: number | null;
  lifecycleState: string;
  isCurrent: boolean;
  isReviewRequired: boolean;
};

type NormalizedPayment = {
  id: string;
  source: PortfolioPaymentSource;
  leaseId: string | null;
  tenantId: string | null;
  propertyId: string | null;
  amountCents: number;
  paidAt: string;
};

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeToken(value: unknown): string {
  return asString(value, 160).toLowerCase().replace(/[\s-]+/g, "_");
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof (value as any)?.toDate === "function") {
    try {
      const date = (value as any).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    } catch {
      return null;
    }
  }
  if (typeof (value as any)?.seconds === "number") {
    const date = new Date((value as any).seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function resolveGeneratedAt(input: LandlordPortfolioStatusFinancialInput): string {
  return normalizeDate(input.generatedAt) || new Date().toISOString();
}

function monthFromGeneratedAt(generatedAt: string): string {
  return generatedAt.slice(0, 7);
}

function monthBounds(month: string): { month: string; startsAt: string; endsAt: string } {
  const normalized = /^\d{4}-\d{2}$/.test(month) ? month : monthFromGeneratedAt(new Date().toISOString());
  const [year, monthNumber] = normalized.split("-").map((part) => Number(part));
  const startsAt = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
  const endsAt = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  return {
    month: normalized,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

function monthMatches(value: string, month: string): boolean {
  return value.slice(0, 7) === month;
}

function centsFromDollarValue(value: unknown): number | null {
  const amount = asNumber(value);
  if (amount == null || amount <= 0) return null;
  return Math.round(amount * 100);
}

function centsFromCentValue(value: unknown): number | null {
  const amount = asNumber(value);
  if (amount == null || amount <= 0) return null;
  return Math.round(amount);
}

function rentCentsFromLease(raw: Record<string, unknown>): number | null {
  return (
    centsFromCentValue(raw.monthlyRentCents) ||
    centsFromCentValue(raw.rentAmountCents) ||
    centsFromCentValue((raw as any).rent?.amountCents) ||
    centsFromDollarValue(raw.monthlyRent) ||
    centsFromDollarValue(raw.rentAmount) ||
    centsFromDollarValue((raw as any).rent?.amount)
  );
}

function amountCentsFromPayment(raw: PortfolioPaymentRecord): number | null {
  return (
    centsFromCentValue(raw.amountCents) ||
    centsFromCentValue((raw as any).paidAmountCents) ||
    centsFromCentValue((raw as any).amountPaidCents) ||
    centsFromDollarValue(raw.amount) ||
    centsFromDollarValue((raw as any).amountPaid)
  );
}

function isHiddenOrArchived(record: Record<string, unknown>): boolean {
  const status = normalizeToken(record.status || record.portfolioStatus || record.lifecycleStatus);
  return (
    record.hiddenFromActiveLists === true ||
    record.isArchived === true ||
    Boolean(record.archivedAt) ||
    status === "archived" ||
    status === "deleted" ||
    status === "removed"
  );
}

function scopedByLandlord(record: Record<string, unknown>, landlordId: string): boolean {
  return asString(record.landlordId, 240) === landlordId;
}

function unitKey(input: { id?: unknown; propertyId?: unknown; unitId?: unknown; unitNumber?: unknown }): string {
  const id = asString(input.id || input.unitId, 240);
  if (id) return `id:${id}`;
  const propertyId = asString(input.propertyId, 240);
  const unitNumber = asString(input.unitNumber, 120).toLowerCase();
  return propertyId || unitNumber ? `property:${propertyId}:unit:${unitNumber || "unknown"}` : "unit:unknown";
}

function unitLookupKeys(unit: NormalizedUnit): string[] {
  const keys = new Set<string>();
  keys.add(unitKey(unit));
  if (unit.propertyId && unit.unitNumber) keys.add(`property:${unit.propertyId}:unit:${unit.unitNumber.toLowerCase()}`);
  return Array.from(keys);
}

function leaseUnitKeys(lease: NormalizedLease): string[] {
  const keys = new Set<string>();
  if (lease.unitId) keys.add(`id:${lease.unitId}`);
  if (lease.propertyId && lease.unitNumber) keys.add(`property:${lease.propertyId}:unit:${lease.unitNumber.toLowerCase()}`);
  return Array.from(keys);
}

function tenantIdsFromLease(raw: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const primary = asString(raw.tenantId || raw.primaryTenantId, 240);
  if (primary) ids.add(primary);
  if (Array.isArray(raw.tenantIds)) {
    for (const id of raw.tenantIds) {
      const next = asString(id, 240);
      if (next) ids.add(next);
    }
  }
  return Array.from(ids);
}

function normalizeProperties(
  landlordId: string,
  properties: PortfolioPropertyRecord[] | null | undefined
): PortfolioPropertyRecord[] {
  return (properties || []).filter((property) => scopedByLandlord(property, landlordId) && !isHiddenOrArchived(property));
}

function normalizeUnits(
  landlordId: string,
  properties: PortfolioPropertyRecord[],
  units: PortfolioUnitRecord[] | null | undefined,
  flags: Set<PortfolioDataQualityFlag>
): NormalizedUnit[] {
  const scopedPropertyIds = new Set(properties.map((property) => asString(property.id, 240)).filter(Boolean));
  const byKey = new Map<string, NormalizedUnit>();

  for (const property of properties) {
    const propertyId = asString(property.id, 240) || null;
    for (const embeddedUnit of property.units || []) {
      if (isHiddenOrArchived(embeddedUnit)) continue;
      const unit = normalizeUnit({ ...embeddedUnit, propertyId: embeddedUnit.propertyId || propertyId });
      byKey.set(unit.key, unit.unit);
    }
  }

  for (const rawUnit of units || []) {
    const propertyId = asString(rawUnit.propertyId, 240);
    const scoped =
      scopedByLandlord(rawUnit, landlordId) ||
      (propertyId && scopedPropertyIds.has(propertyId));
    if (!scoped || isHiddenOrArchived(rawUnit)) continue;
    const unit = normalizeUnit(rawUnit);
    if (byKey.has(unit.key)) flags.add("unit_sources_split");
    byKey.set(unit.key, unit.unit);
  }

  return Array.from(byKey.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeUnit(rawUnit: PortfolioUnitRecord): { key: string; unit: NormalizedUnit } {
  const key = unitKey(rawUnit);
  const id = asString(rawUnit.id || rawUnit.unitId, 240) || key;
  return {
    key,
    unit: {
      id,
      propertyId: asString(rawUnit.propertyId, 240) || null,
      unitNumber: asString(rawUnit.unitNumber, 120) || null,
      status: normalizeToken(rawUnit.status),
      occupancyStatus: normalizeToken(rawUnit.occupancyStatus),
      currentLeaseId: asString(rawUnit.currentLeaseId, 240) || null,
      currentTenantId: asString(rawUnit.currentTenantId, 240) || null,
    },
  };
}

function normalizeLeases(
  landlordId: string,
  leases: Record<string, unknown>[] | null | undefined,
  scopedPropertyIds: Set<string>,
  generatedAt: string
): NormalizedLease[] {
  return (leases || [])
    .filter((lease) => scopedByLandlord(lease, landlordId) || scopedPropertyIds.has(asString(lease.propertyId, 240)))
    .filter((lease) => !isHiddenOrArchived(lease))
    .map((lease) => {
      const lifecycle = deriveLeaseLifecycleState(lease as any, generatedAt);
      const id = asString(lease.id || lease.leaseId, 240);
      return {
        raw: lease,
        id,
        propertyId: asString(lease.propertyId, 240) || null,
        unitId: asString(lease.unitId, 240) || null,
        unitNumber: asString(lease.unitNumber, 120) || null,
        tenantId: asString(lease.tenantId || lease.primaryTenantId, 240) || null,
        tenantIds: tenantIdsFromLease(lease),
        rentCents: rentCentsFromLease(lease),
        lifecycleState: lifecycle.state,
        isCurrent: lifecycle.isCurrent,
        isReviewRequired: lifecycle.requiresReview,
      };
    })
    .filter((lease) => Boolean(lease.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeTenants(
  landlordId: string,
  tenants: PortfolioTenantRecord[] | null | undefined,
  scopedPropertyIds: Set<string>
): PortfolioTenantRecord[] {
  return (tenants || [])
    .filter((tenant) => scopedByLandlord(tenant, landlordId) || scopedPropertyIds.has(asString(tenant.propertyId, 240)))
    .filter((tenant) => !isHiddenOrArchived(tenant));
}

function normalizePayments(
  landlordId: string,
  source: PortfolioPaymentSource,
  records: PortfolioPaymentRecord[] | null | undefined,
  context: {
    leaseIds: Set<string>;
    tenantIds: Set<string>;
    propertyIds: Set<string>;
    month: string;
  }
): NormalizedPayment[] {
  return (records || [])
    .filter((record) => {
      const scoped =
        scopedByLandlord(record, landlordId) ||
        context.leaseIds.has(asString(record.leaseId, 240)) ||
        context.tenantIds.has(asString(record.tenantId, 240)) ||
        context.propertyIds.has(asString(record.propertyId, 240));
      if (!scoped) return false;
      const status = normalizeToken(record.status || record.paymentStatus);
      return !["failed", "void", "voided", "cancelled", "canceled", "refunded"].includes(status);
    })
    .map((record) => {
      const paidAt = normalizeDate(record.paidAt || record.effectiveDate || record.paymentDate || record.createdAt);
      const amountCents = amountCentsFromPayment(record);
      if (!paidAt || !monthMatches(paidAt, context.month) || amountCents == null) return null;
      const id = asString(record.id, 240) || [
        source,
        asString(record.leaseId, 240),
        asString(record.tenantId, 240),
        paidAt.slice(0, 10),
        String(amountCents),
      ].join(":");
      return {
        id,
        source,
        leaseId: asString(record.leaseId, 240) || null,
        tenantId: asString(record.tenantId, 240) || null,
        propertyId: asString(record.propertyId, 240) || null,
        amountCents,
        paidAt,
      };
    })
    .filter((record): record is NormalizedPayment => Boolean(record))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function dedupePayments(payments: NormalizedPayment[]): NormalizedPayment[] {
  const byKey = new Map<string, NormalizedPayment>();
  for (const payment of payments) {
    const key = [
      payment.leaseId || "no_lease",
      payment.tenantId || "no_tenant",
      payment.propertyId || "no_property",
      payment.paidAt.slice(0, 10),
      String(payment.amountCents),
    ].join("|");
    const existing = byKey.get(key);
    if (!existing || payment.source.localeCompare(existing.source) < 0) {
      byKey.set(key, payment);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.id.localeCompare(b.id));
}

function confidenceFromFlags(flags: Set<PortfolioDataQualityFlag>, empty: boolean): PortfolioMetricConfidence {
  if (empty) return "unavailable";
  if (
    flags.has("payment_source_unavailable") ||
    flags.has("ledger_source_unavailable") ||
    flags.has("no_scoped_units") ||
    flags.has("no_scoped_properties")
  ) {
    return "low";
  }
  if (
    flags.has("payment_sources_split") ||
    flags.has("unit_sources_split") ||
    flags.has("unit_lease_occupancy_conflict") ||
    flags.has("tenant_lease_link_conflict") ||
    flags.has("missing_rent_terms")
  ) {
    return "medium";
  }
  return "high";
}

function sortedFlags(flags: Set<PortfolioDataQualityFlag>): PortfolioDataQualityFlag[] {
  return Array.from(flags).sort((a, b) => a.localeCompare(b));
}

export function deriveLandlordPortfolioStatusFinancialSummary(
  input: LandlordPortfolioStatusFinancialInput
): LandlordPortfolioStatusFinancialSummary {
  const landlordId = asString(input.landlordId, 240);
  const generatedAt = resolveGeneratedAt(input);
  const period = monthBounds(asString(input.periodMonth, 20) || monthFromGeneratedAt(generatedAt));
  const globalFlags = new Set<PortfolioDataQualityFlag>();
  const occupancyFlags = new Set<PortfolioDataQualityFlag>();
  const financialFlags = new Set<PortfolioDataQualityFlag>();

  const properties = normalizeProperties(landlordId, input.properties);
  if (properties.length === 0) occupancyFlags.add("no_scoped_properties");
  const scopedPropertyIds = new Set(properties.map((property) => asString(property.id, 240)).filter(Boolean));
  const units = normalizeUnits(landlordId, properties, input.units, occupancyFlags);
  if (units.length === 0) occupancyFlags.add("no_scoped_units");
  const leases = normalizeLeases(landlordId, input.leases as any, scopedPropertyIds, generatedAt);
  if (leases.length === 0) occupancyFlags.add("no_scoped_leases");
  const tenants = normalizeTenants(landlordId, input.tenants, scopedPropertyIds);

  const currentLeases = leases.filter((lease) => lease.lifecycleState === "active" || lease.lifecycleState === "notice_period");
  const signedFutureLeases = leases.filter((lease) => lease.lifecycleState === "signed_future");
  const currentLeaseByUnitKey = new Map<string, NormalizedLease[]>();
  for (const lease of [...currentLeases, ...signedFutureLeases]) {
    for (const key of leaseUnitKeys(lease)) {
      const existing = currentLeaseByUnitKey.get(key) || [];
      existing.push(lease);
      currentLeaseByUnitKey.set(key, existing);
    }
  }

  let occupiedUnits = 0;
  let vacantUnits = 0;
  let upcomingUnits = 0;
  let noticePeriodUnits = 0;
  let reviewRequiredUnits = 0;

  for (const unit of units) {
    const leasesForUnit = Array.from(
      new Map(
        unitLookupKeys(unit)
          .flatMap((key) => currentLeaseByUnitKey.get(key) || [])
          .map((lease) => [lease.id, lease])
      ).values()
    );
    const active = leasesForUnit.filter((lease) => lease.lifecycleState === "active");
    const notice = leasesForUnit.filter((lease) => lease.lifecycleState === "notice_period");
    const upcoming = leasesForUnit.filter((lease) => lease.lifecycleState === "signed_future");
    const unitOccupancy = unit.occupancyStatus || unit.status;

    if (active.length + notice.length + upcoming.length > 1) {
      reviewRequiredUnits += 1;
      occupancyFlags.add("unit_lease_occupancy_conflict");
      continue;
    }
    if ((active.length > 0 || notice.length > 0) && ["vacant", "available"].includes(unitOccupancy)) {
      reviewRequiredUnits += 1;
      occupancyFlags.add("unit_lease_occupancy_conflict");
      continue;
    }
    if (active.length > 0) {
      occupiedUnits += 1;
      continue;
    }
    if (notice.length > 0) {
      noticePeriodUnits += 1;
      continue;
    }
    if (upcoming.length > 0) {
      upcomingUnits += 1;
      continue;
    }
    if (["occupied", "active", "current"].includes(unitOccupancy)) {
      reviewRequiredUnits += 1;
      occupancyFlags.add("unit_lease_occupancy_conflict");
      continue;
    }
    vacantUnits += 1;
  }

  const currentLeaseIds = new Set(currentLeases.map((lease) => lease.id));
  for (const tenant of tenants) {
    const tenantCurrentLeaseId = asString(tenant.currentLeaseId, 240);
    const tenantStatus = normalizeToken(tenant.status);
    if (tenantCurrentLeaseId && !currentLeaseIds.has(tenantCurrentLeaseId) && ["active", "current"].includes(tenantStatus)) {
      occupancyFlags.add("tenant_lease_link_conflict");
    }
  }

  const activeLeaseRentTerms = currentLeases.filter((lease) => lease.rentCents != null);
  const leasesMissingRentTermsCount = currentLeases.length - activeLeaseRentTerms.length;
  if (leasesMissingRentTermsCount > 0) financialFlags.add("missing_rent_terms");

  const scopedLeaseIds = new Set(leases.map((lease) => lease.id));
  const scopedTenantIds = new Set<string>();
  for (const lease of leases) {
    for (const tenantId of lease.tenantIds) scopedTenantIds.add(tenantId);
  }
  for (const tenant of tenants) {
    const tenantId = asString(tenant.id || tenant.tenantId, 240);
    if (tenantId) scopedTenantIds.add(tenantId);
  }

  const paymentGroups: Array<[PortfolioPaymentSource, PortfolioPaymentRecord[] | null | undefined]> = [
    ["ledgerEvents", input.ledgerEvents],
    ["ledgerEntries", input.ledgerEntries],
    ["rentPayments", input.rentPayments],
    ["payments", input.payments],
  ];
  const paymentSourcesIncluded: PortfolioPaymentSource[] = paymentGroups
    .filter(([, records]) => (records || []).length > 0)
    .map(([source]) => source);
  if (paymentSourcesIncluded.length === 0) financialFlags.add("payment_source_unavailable");
  if (!input.ledgerEvents && !input.ledgerEntries) financialFlags.add("ledger_source_unavailable");
  if (paymentSourcesIncluded.length > 1) financialFlags.add("payment_sources_split");

  const payments = dedupePayments(
    paymentGroups.flatMap(([source, records]) =>
      normalizePayments(landlordId, source, records, {
        leaseIds: scopedLeaseIds,
        tenantIds: scopedTenantIds,
        propertyIds: scopedPropertyIds,
        month: period.month,
      })
    )
  );

  const expectedMonthlyRentCents = activeLeaseRentTerms.length > 0
    ? activeLeaseRentTerms.reduce((sum, lease) => sum + (lease.rentCents || 0), 0)
    : currentLeases.length > 0
    ? null
    : 0;
  const rentRollCents = expectedMonthlyRentCents;
  const collectedCurrentMonthCents = payments.length > 0
    ? payments.reduce((sum, payment) => sum + payment.amountCents, 0)
    : paymentSourcesIncluded.length > 0
    ? 0
    : null;
  const outstandingCurrentMonthCents =
    expectedMonthlyRentCents != null && collectedCurrentMonthCents != null
      ? Math.max(expectedMonthlyRentCents - collectedCurrentMonthCents, 0)
      : null;
  const rentCollectionRate =
    expectedMonthlyRentCents && expectedMonthlyRentCents > 0 && collectedCurrentMonthCents != null
      ? Number((collectedCurrentMonthCents / expectedMonthlyRentCents).toFixed(4))
      : null;
  const vacancyImpactCents = vacantUnits > 0 ? null : 0;
  if (vacantUnits > 0) financialFlags.add("vacancy_value_unavailable");

  const dashboardRent = input.dashboardRentSnapshot;
  if (
    dashboardRent &&
    Number(dashboardRent.collectedCents || 0) === 0 &&
    Number(dashboardRent.expectedCents || 0) === 0 &&
    Number(dashboardRent.delinquentCents || 0) === 0
  ) {
    financialFlags.add("dashboard_rent_fields_zeroed");
  }

  for (const flag of occupancyFlags) globalFlags.add(flag);
  for (const flag of financialFlags) globalFlags.add(flag);

  const occupancyConfidence = confidenceFromFlags(occupancyFlags, units.length === 0);
  const financialConfidence = confidenceFromFlags(financialFlags, currentLeases.length === 0 && paymentSourcesIncluded.length === 0);
  const portfolioStatus: PortfolioOccupancySummary = {
    totalProperties: properties.length,
    totalUnits: units.length,
    occupiedUnits,
    vacantUnits,
    upcomingUnits,
    noticePeriodUnits,
    reviewRequiredUnits,
    occupancyRate: units.length > 0 ? Number(((occupiedUnits + noticePeriodUnits) / units.length).toFixed(4)) : null,
    activeLeaseCount: currentLeases.length,
    currentLeaseCount: currentLeases.length,
    signedFutureLeaseCount: signedFutureLeases.length,
    leasesRequiringReview: leases.filter((lease) => lease.isReviewRequired).length,
    criticalOpenIssues: input.operationalIssues?.critical == null ? null : Math.max(0, Math.floor(Number(input.operationalIssues.critical) || 0)),
    openOperationalIssues: input.operationalIssues?.open == null ? null : Math.max(0, Math.floor(Number(input.operationalIssues.open) || 0)),
    confidence: occupancyConfidence,
    dataQualityFlags: sortedFlags(occupancyFlags),
  };

  const financialSnapshot: PortfolioFinancialSnapshot = {
    period,
    expectedMonthlyRentCents,
    collectedCurrentMonthCents,
    outstandingCurrentMonthCents,
    rentCollectionRate,
    rentRollCents,
    vacancyImpactCents,
    activeLeaseRentTermsCount: activeLeaseRentTerms.length,
    leasesMissingRentTermsCount,
    paymentSourcesIncluded: paymentSourcesIncluded.sort((a, b) => a.localeCompare(b)),
    confidence: financialConfidence,
    dataQualityFlags: sortedFlags(financialFlags),
  };

  return {
    version: VERSION,
    landlordId,
    generatedAt,
    portfolioStatus,
    financialSnapshot,
    confidence: {
      occupancy: occupancyConfidence,
      financial: financialConfidence,
    },
    dataQualityFlags: sortedFlags(globalFlags),
  };
}
