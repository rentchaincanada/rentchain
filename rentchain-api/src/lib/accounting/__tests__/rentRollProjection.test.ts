import { describe, expect, it } from "vitest";
import { projectRentRoll, type RentRollLeaseInput } from "../rentRollProjection";

const lease = (overrides: Partial<RentRollLeaseInput> = {}): RentRollLeaseInput => ({
  propertyId: "property-1",
  propertyDisplay: "10 Harbour Street",
  unitId: "unit-1",
  unitDisplay: "Unit 2",
  leaseId: "lease-1",
  tenantDisplayName: "Example Tenant",
  leaseStatus: "active",
  scheduledRentCents: 100_000,
  currency: "cad",
  nextDueDate: "2026-02-01",
  transactions: [
    {
      transactionId: "charge-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      type: "scheduled_rent_charge",
      amountCents: 100_000,
      currency: "cad",
      effectiveDate: "2026-01-01",
      dueDate: "2026-01-01",
    },
  ],
  ...overrides,
});

describe("projectRentRoll", () => {
  it("projects deterministic lease, property, and portfolio summaries", () => {
    const leases = [
      lease(),
      lease({
        propertyId: "property-2",
        propertyDisplay: "20 Shore Road",
        unitId: "unit-2",
        unitDisplay: "Unit 4",
        leaseId: "lease-2",
        scheduledRentCents: 120_000,
        transactions: [],
      }),
    ];
    const result = projectRentRoll({ leases: [...leases].reverse(), asOfDate: "2026-01-31" });

    expect(result.rows.map((row) => row.leaseId)).toEqual(["lease-1", "lease-2"]);
    expect(result.portfolioSummary).toEqual({
      scheduledRentCents: 220_000,
      currentBalanceCents: 100_000,
      outstandingCents: 100_000,
      overpaymentCents: 0,
      leaseCount: 2,
    });
    expect(result.propertySummaries).toHaveLength(2);
  });

  it("uses null safe-display fields instead of internal identifier fallbacks", () => {
    const result = projectRentRoll({
      leases: [lease({ propertyDisplay: null, unitDisplay: null, tenantDisplayName: null })],
      asOfDate: "2026-01-31",
    });

    expect(result.rows[0]).toMatchObject({
      propertyDisplay: null,
      unitDisplay: null,
      tenantDisplayName: null,
    });
    expect(result.findings.map((finding) => finding.code)).toEqual([
      "property_display_not_provided",
      "tenant_display_not_provided",
      "unit_display_not_provided",
    ]);
  });

  it("fails closed for invalid required lease inputs", () => {
    const invalid = lease({ leaseId: "", scheduledRentCents: -1 });
    const result = projectRentRoll({ leases: [invalid], asOfDate: "2026-01-31" });

    expect(result.rows).toEqual([]);
    expect(result.portfolioSummary.leaseCount).toBe(0);
    expect(result.findings.map((finding) => finding.code)).toContain("required_field_missing");
  });
});
