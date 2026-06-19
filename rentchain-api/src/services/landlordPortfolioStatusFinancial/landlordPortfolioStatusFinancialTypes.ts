export type PortfolioMetricConfidence = "high" | "medium" | "low" | "unavailable";

export type PortfolioDataQualityFlag =
  | "dashboard_rent_fields_zeroed"
  | "payment_sources_split"
  | "payment_source_unavailable"
  | "ledger_source_unavailable"
  | "unit_sources_split"
  | "unit_lease_occupancy_conflict"
  | "tenant_lease_link_conflict"
  | "missing_rent_terms"
  | "stale_lifecycle_projection"
  | "vacancy_value_unavailable"
  | "no_scoped_properties"
  | "no_scoped_units"
  | "no_scoped_leases";

export type PortfolioPaymentSource = "ledgerEvents" | "ledgerEntries" | "rentPayments" | "payments";

export type PortfolioRecord = Record<string, unknown> & {
  id?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
};

export type PortfolioPropertyRecord = PortfolioRecord & {
  units?: PortfolioUnitRecord[] | null;
};

export type PortfolioUnitRecord = PortfolioRecord & {
  unitNumber?: string | number | null;
  status?: string | null;
  occupancyStatus?: string | null;
  currentLeaseId?: string | null;
  currentTenantId?: string | null;
};

export type PortfolioLeaseRecord = PortfolioRecord & {
  status?: string | null;
  monthlyRent?: number | string | null;
  monthlyRentCents?: number | string | null;
  rentAmount?: number | string | null;
  rentAmountCents?: number | string | null;
  tenantIds?: string[] | null;
  primaryTenantId?: string | null;
};

export type PortfolioTenantRecord = PortfolioRecord & {
  currentLeaseId?: string | null;
  status?: string | null;
};

export type PortfolioPaymentRecord = PortfolioRecord & {
  amount?: number | string | null;
  amountCents?: number | string | null;
  paidAt?: unknown;
  effectiveDate?: unknown;
  paymentDate?: unknown;
  createdAt?: unknown;
  status?: string | null;
  paymentStatus?: string | null;
};

export type PortfolioOperationalIssueSummary = {
  critical?: number | null;
  open?: number | null;
};

export type LandlordPortfolioStatusFinancialInput = {
  landlordId: string;
  generatedAt?: string | null;
  periodMonth?: string | null;
  properties?: PortfolioPropertyRecord[] | null;
  units?: PortfolioUnitRecord[] | null;
  leases?: PortfolioLeaseRecord[] | null;
  tenants?: PortfolioTenantRecord[] | null;
  payments?: PortfolioPaymentRecord[] | null;
  ledgerEntries?: PortfolioPaymentRecord[] | null;
  ledgerEvents?: PortfolioPaymentRecord[] | null;
  rentPayments?: PortfolioPaymentRecord[] | null;
  operationalIssues?: PortfolioOperationalIssueSummary | null;
  dashboardRentSnapshot?: {
    collectedCents?: number | null;
    expectedCents?: number | null;
    delinquentCents?: number | null;
  } | null;
};

export type PortfolioOccupancySummary = {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  upcomingUnits: number;
  noticePeriodUnits: number;
  reviewRequiredUnits: number;
  occupancyRate: number | null;
  activeLeaseCount: number;
  currentLeaseCount: number;
  signedFutureLeaseCount: number;
  leasesRequiringReview: number;
  criticalOpenIssues: number | null;
  openOperationalIssues: number | null;
  confidence: PortfolioMetricConfidence;
  dataQualityFlags: PortfolioDataQualityFlag[];
};

export type PortfolioFinancialSnapshot = {
  period: {
    month: string;
    startsAt: string;
    endsAt: string;
  };
  expectedMonthlyRentCents: number | null;
  collectedCurrentMonthCents: number | null;
  outstandingCurrentMonthCents: number | null;
  rentCollectionRate: number | null;
  rentRollCents: number | null;
  vacancyImpactCents: number | null;
  activeLeaseRentTermsCount: number;
  leasesMissingRentTermsCount: number;
  paymentSourcesIncluded: PortfolioPaymentSource[];
  confidence: PortfolioMetricConfidence;
  dataQualityFlags: PortfolioDataQualityFlag[];
};

export type LandlordPortfolioStatusFinancialSummary = {
  version: "landlord_portfolio_status_financial_v1";
  landlordId: string;
  generatedAt: string;
  portfolioStatus: PortfolioOccupancySummary;
  financialSnapshot: PortfolioFinancialSnapshot;
  confidence: {
    occupancy: PortfolioMetricConfidence;
    financial: PortfolioMetricConfidence;
  };
  dataQualityFlags: PortfolioDataQualityFlag[];
};
