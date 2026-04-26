import { describe, expect, it } from "vitest";
import { buildPropertySummaryMetrics } from "./propertySummaryMetrics";

describe("buildPropertySummaryMetrics", () => {
  it("keeps leased units lease-based while occupancy stays unit-based", () => {
    const metrics = buildPropertySummaryMetrics(
      [
        {
          id: "unit-1",
          unitNumber: "101",
          status: "occupied",
          rent: 1800,
        },
        {
          id: "unit-2",
          unitNumber: "102",
          status: "vacant",
          rent: 1700,
        },
      ],
      [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-2",
          unitNumber: "102",
          monthlyRent: 1900,
          startDate: "2026-01-01",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      2
    );

    expect(metrics.leasedUnits).toHaveLength(1);
    expect(metrics.occupancyRate).toBe(50);
    expect(metrics.activeLeaseRentTotal).toBe(1900);
    expect(metrics.currentOccupiedRentTotal).toBe(1800);
  });
});
