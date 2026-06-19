import { describe, expect, it } from "vitest";
import { deriveLandlordPortfolioStatusFinancialSummary } from "../landlordPortfolioStatusFinancialService";

const generatedAt = "2026-06-19T12:00:00.000Z";

function baseProperties() {
  return [
    {
      id: "property-1",
      landlordId: "landlord-1",
      units: [
        { id: "unit-1", unitNumber: "1", status: "occupied" },
        { id: "unit-2", unitNumber: "2", status: "vacant" },
      ],
    },
  ];
}

describe("landlordPortfolioStatusFinancialService", () => {
  it("normalizes portfolio status and financial snapshot from active leases and current month payments", () => {
    const summary = deriveLandlordPortfolioStatusFinancialSummary({
      landlordId: "landlord-1",
      generatedAt,
      properties: baseProperties(),
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitId: "unit-1",
          tenantId: "tenant-1",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          monthlyRent: 1800,
        },
      ],
      tenants: [{ id: "tenant-1", landlordId: "landlord-1", propertyId: "property-1", currentLeaseId: "lease-1", status: "active" }],
      ledgerEntries: [
        {
          id: "ledger-payment-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          leaseId: "lease-1",
          tenantId: "tenant-1",
          amountCents: 120000,
          effectiveDate: "2026-06-02T10:00:00.000Z",
        },
      ],
      rentPayments: [
        {
          id: "rent-payment-duplicate",
          landlordId: "landlord-1",
          propertyId: "property-1",
          leaseId: "lease-1",
          tenantId: "tenant-1",
          amountCents: 120000,
          paidAt: "2026-06-02T10:00:00.000Z",
        },
      ],
      operationalIssues: { critical: 2, open: 4 },
    });

    expect(summary.version).toBe("landlord_portfolio_status_financial_v1");
    expect(summary.portfolioStatus).toEqual(
      expect.objectContaining({
        totalProperties: 1,
        totalUnits: 2,
        occupiedUnits: 1,
        vacantUnits: 1,
        occupancyRate: 0.5,
        activeLeaseCount: 1,
        criticalOpenIssues: 2,
        openOperationalIssues: 4,
      })
    );
    expect(summary.financialSnapshot).toEqual(
      expect.objectContaining({
        expectedMonthlyRentCents: 180000,
        rentRollCents: 180000,
        collectedCurrentMonthCents: 120000,
        outstandingCurrentMonthCents: 60000,
        rentCollectionRate: 0.6667,
        activeLeaseRentTermsCount: 1,
        leasesMissingRentTermsCount: 0,
      })
    );
    expect(summary.financialSnapshot.paymentSourcesIncluded).toEqual(["ledgerEntries", "rentPayments"]);
    expect(summary.dataQualityFlags).toEqual(["payment_sources_split", "vacancy_value_unavailable"]);
  });

  it("flags missing rent terms and avoids false zeroes when expected rent is unavailable", () => {
    const summary = deriveLandlordPortfolioStatusFinancialSummary({
      landlordId: "landlord-1",
      generatedAt,
      properties: baseProperties(),
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitId: "unit-1",
          tenantId: "tenant-1",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
        },
      ],
      ledgerEntries: [
        {
          id: "ledger-payment-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          leaseId: "lease-1",
          tenantId: "tenant-1",
          amountCents: 50000,
          effectiveDate: "2026-06-02T10:00:00.000Z",
        },
      ],
      dashboardRentSnapshot: {
        collectedCents: 0,
        expectedCents: 0,
        delinquentCents: 0,
      },
    });

    expect(summary.financialSnapshot.expectedMonthlyRentCents).toBeNull();
    expect(summary.financialSnapshot.outstandingCurrentMonthCents).toBeNull();
    expect(summary.financialSnapshot.collectedCurrentMonthCents).toBe(50000);
    expect(summary.financialSnapshot.dataQualityFlags).toEqual([
      "dashboard_rent_fields_zeroed",
      "missing_rent_terms",
      "vacancy_value_unavailable",
    ]);
    expect(summary.financialSnapshot.confidence).toBe("medium");
  });

  it("detects vacancy and occupancy conflicts without trusting stale unit status alone", () => {
    const summary = deriveLandlordPortfolioStatusFinancialSummary({
      landlordId: "landlord-1",
      generatedAt,
      properties: [
        {
          id: "property-1",
          landlordId: "landlord-1",
          units: [
            { id: "unit-1", status: "vacant" },
            { id: "unit-2", status: "occupied" },
            { id: "unit-3", status: "vacant" },
          ],
        },
      ],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitId: "unit-1",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          monthlyRent: 1200,
        },
      ],
      ledgerEntries: [],
    });

    expect(summary.portfolioStatus).toEqual(
      expect.objectContaining({
        occupiedUnits: 1,
        vacantUnits: 1,
        reviewRequiredUnits: 2,
      })
    );
    expect(summary.portfolioStatus.dataQualityFlags).toContain("unit_lease_occupancy_conflict");
    expect(summary.portfolioStatus.confidence).toBe("medium");
  });

  it("keeps signed future leases out of occupied unit counts", () => {
    const summary = deriveLandlordPortfolioStatusFinancialSummary({
      landlordId: "landlord-1",
      generatedAt,
      properties: [{ id: "property-1", landlordId: "landlord-1", units: [{ id: "unit-1", status: "vacant" }] }],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitId: "unit-1",
          status: "signed",
          signedAt: "2026-06-19T10:00:00.000Z",
          startDate: "2026-07-01",
          endDate: "2027-06-30",
          monthlyRent: 1500,
        },
      ],
      ledgerEntries: [],
    });

    expect(summary.portfolioStatus.occupiedUnits).toBe(0);
    expect(summary.portfolioStatus.upcomingUnits).toBe(1);
    expect(summary.portfolioStatus.signedFutureLeaseCount).toBe(1);
  });

  it("matches leases to units by property and unit number when the lease has no unit document id", () => {
    const summary = deriveLandlordPortfolioStatusFinancialSummary({
      landlordId: "landlord-1",
      generatedAt,
      properties: [
        {
          id: "property-1",
          landlordId: "landlord-1",
          units: [{ id: "unit-doc-1", unitNumber: "6", status: "vacant" }],
        },
      ],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitNumber: "6",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          monthlyRent: 1600,
        },
      ],
      ledgerEntries: [],
    });

    expect(summary.portfolioStatus.occupiedUnits).toBe(1);
    expect(summary.portfolioStatus.reviewRequiredUnits).toBe(1);
    expect(summary.portfolioStatus.leasesRequiringReview).toBe(0);
    expect(summary.portfolioStatus.dataQualityFlags).toContain("unit_lease_occupancy_conflict");
  });

  it("fails closed on explicit landlord mismatches before related-entity fallback", () => {
    const summary = deriveLandlordPortfolioStatusFinancialSummary({
      landlordId: "landlord-1",
      generatedAt,
      properties: [
        {
          id: "property-1",
          landlordId: "landlord-1",
          units: [
            { id: "unit-1", status: "occupied" },
            { id: "unit-2", status: "occupied" },
          ],
        },
      ],
      units: [
        { id: "unit-3", landlordId: "landlord-2", propertyId: "property-1", status: "vacant" },
      ],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitId: "unit-1",
          tenantId: "tenant-1",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          monthlyRent: 1000,
        },
        {
          id: "lease-2",
          landlordId: "landlord-2",
          propertyId: "property-1",
          unitId: "unit-2",
          tenantId: "tenant-2",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          monthlyRent: 2000,
        },
      ],
      tenants: [
        { id: "tenant-1", landlordId: "landlord-1", currentLeaseId: "lease-1", status: "active" },
        { id: "tenant-2", landlordId: "landlord-2", propertyId: "property-1", currentLeaseId: "lease-1", status: "active" },
      ],
      ledgerEntries: [
        { id: "payment-1", landlordId: "landlord-2", leaseId: "lease-1", tenantId: "tenant-1", amountCents: 100000, effectiveDate: "2026-06-02" },
        { id: "payment-2", leaseId: "lease-1", tenantId: "tenant-1", amountCents: 25000, effectiveDate: "2026-06-03" },
      ],
    });

    expect(summary.portfolioStatus.totalUnits).toBe(2);
    expect(summary.portfolioStatus.activeLeaseCount).toBe(1);
    expect(summary.financialSnapshot.expectedMonthlyRentCents).toBe(100000);
    expect(summary.financialSnapshot.collectedCurrentMonthCents).toBe(25000);
    expect(summary.portfolioStatus.dataQualityFlags).not.toContain("tenant_lease_link_conflict");
  });

  it("filters cross-landlord properties, leases, tenants, and payments", () => {
    const summary = deriveLandlordPortfolioStatusFinancialSummary({
      landlordId: "landlord-1",
      generatedAt,
      properties: [
        { id: "property-1", landlordId: "landlord-1", units: [{ id: "unit-1", status: "occupied" }] },
        { id: "property-2", landlordId: "landlord-2", units: [{ id: "unit-2", status: "occupied" }] },
      ],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitId: "unit-1",
          tenantId: "tenant-1",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          monthlyRent: 1800,
        },
        {
          id: "lease-2",
          landlordId: "landlord-2",
          propertyId: "property-2",
          unitId: "unit-2",
          tenantId: "tenant-2",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          monthlyRent: 2200,
        },
      ],
      tenants: [
        { id: "tenant-1", landlordId: "landlord-1", currentLeaseId: "lease-1", status: "active" },
        { id: "tenant-2", landlordId: "landlord-2", currentLeaseId: "lease-2", status: "active" },
      ],
      ledgerEntries: [
        { id: "payment-1", landlordId: "landlord-1", leaseId: "lease-1", tenantId: "tenant-1", amountCents: 180000, effectiveDate: "2026-06-02" },
        { id: "payment-2", landlordId: "landlord-2", leaseId: "lease-2", tenantId: "tenant-2", amountCents: 220000, effectiveDate: "2026-06-02" },
      ],
    });

    expect(summary.portfolioStatus.totalProperties).toBe(1);
    expect(summary.portfolioStatus.totalUnits).toBe(1);
    expect(summary.portfolioStatus.activeLeaseCount).toBe(1);
    expect(summary.financialSnapshot.expectedMonthlyRentCents).toBe(180000);
    expect(summary.financialSnapshot.collectedCurrentMonthCents).toBe(180000);
  });

  it("returns deterministic output independent of input order", () => {
    const first = deriveLandlordPortfolioStatusFinancialSummary({
      landlordId: "landlord-1",
      generatedAt,
      properties: [
        { id: "property-2", landlordId: "landlord-1", units: [{ id: "unit-2", status: "vacant" }] },
        { id: "property-1", landlordId: "landlord-1", units: [{ id: "unit-1", status: "occupied" }] },
      ],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitId: "unit-1",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          monthlyRent: 1000,
        },
      ],
      ledgerEntries: [
        { id: "payment-b", landlordId: "landlord-1", leaseId: "lease-1", amountCents: 30000, effectiveDate: "2026-06-05" },
        { id: "payment-a", landlordId: "landlord-1", leaseId: "lease-1", amountCents: 20000, effectiveDate: "2026-06-03" },
      ],
    });
    const second = deriveLandlordPortfolioStatusFinancialSummary({
      landlordId: "landlord-1",
      generatedAt,
      properties: [
        { id: "property-1", landlordId: "landlord-1", units: [{ id: "unit-1", status: "occupied" }] },
        { id: "property-2", landlordId: "landlord-1", units: [{ id: "unit-2", status: "vacant" }] },
      ],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitId: "unit-1",
          status: "active",
          signedAt: "2026-05-15T12:00:00.000Z",
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          monthlyRent: 1000,
        },
      ],
      ledgerEntries: [
        { id: "payment-a", landlordId: "landlord-1", leaseId: "lease-1", amountCents: 20000, effectiveDate: "2026-06-03" },
        { id: "payment-b", landlordId: "landlord-1", leaseId: "lease-1", amountCents: 30000, effectiveDate: "2026-06-05" },
      ],
    });

    expect(second).toEqual(first);
  });
});
