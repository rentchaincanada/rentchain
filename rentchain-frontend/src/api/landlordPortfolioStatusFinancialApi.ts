import { apiFetch } from "./apiFetch";

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
  paymentSourcesIncluded: Array<"ledgerEvents" | "ledgerEntries" | "rentPayments" | "payments">;
  confidence: PortfolioMetricConfidence;
  dataQualityFlags: PortfolioDataQualityFlag[];
};

export type LandlordPortfolioStatusFinancialResponse = {
  ok: true;
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

export async function fetchLandlordPortfolioStatusFinancial(params?: {
  periodMonth?: string;
}): Promise<LandlordPortfolioStatusFinancialResponse> {
  const search = new URLSearchParams();
  if (params?.periodMonth) search.set("periodMonth", params.periodMonth);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<LandlordPortfolioStatusFinancialResponse>(`/landlord/portfolio-status-financial${suffix}`);
}
