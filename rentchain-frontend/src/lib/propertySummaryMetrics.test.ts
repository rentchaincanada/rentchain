import { describe, expect, it } from "vitest";
import { buildPropertySummaryMetrics } from "./propertySummaryMetrics";

describe("buildPropertySummaryMetrics", () => {
  it("derives occupancy and rent from active lease lifecycle instead of stale unit status", () => {
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
      2,
      "2026-05-04"
    );

    expect(metrics.leasedUnits).toHaveLength(1);
    expect(metrics.occupancyRate).toBe(50);
    expect(metrics.activeLeaseRentTotal).toBe(1900);
    expect(metrics.currentOccupiedRentTotal).toBe(1900);
  });

  it("does not count expired leases or stale occupied flags as occupied", () => {
    const metrics = buildPropertySummaryMetrics(
      [
        {
          id: "unit-1",
          unitNumber: "101",
          status: "occupied",
          rent: 1800,
        },
      ],
      [
        {
          id: "lease-expired",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "101",
          monthlyRent: 1800,
          startDate: "2025-01-01",
          endDate: "2025-12-31",
          status: "active",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      1,
      "2026-05-04"
    );

    expect(metrics.leasedUnits).toHaveLength(0);
    expect(metrics.occupancyRate).toBe(0);
    expect(metrics.activeLeaseRentTotal).toBe(0);
    expect(metrics.currentOccupiedRentTotal).toBe(0);
  });

  it("counts valid manual occupancy when expired leases are the only lease records", () => {
    const metrics = buildPropertySummaryMetrics(
      [
        {
          id: "unit-1",
          unitNumber: "101",
          status: "occupied",
          occupantName: "Leen Bakri-Kasbah and Patricia Emeline Krisinta",
          leaseEndDate: "2027-04-30",
          rent: 1800,
        },
      ],
      [
        {
          id: "lease-expired",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "101",
          monthlyRent: 1800,
          startDate: "2025-01-01",
          endDate: "2026-04-30",
          status: "active",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      1,
      "2026-05-04"
    );

    expect(metrics.leasedUnits).toHaveLength(1);
    expect(metrics.occupancyRate).toBe(100);
    expect(metrics.activeLeaseRentTotal).toBe(0);
    expect(metrics.currentOccupiedRentTotal).toBe(1800);
  });

  it("keeps signed future leases as upcoming instead of manual occupied", () => {
    const metrics = buildPropertySummaryMetrics(
      [
        {
          id: "unit-1",
          unitNumber: "101",
          status: "occupied",
          occupantName: "Future Tenant",
          leaseEndDate: "2027-04-30",
          rent: 1800,
        },
      ],
      [
        {
          id: "lease-future",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "101",
          monthlyRent: 1800,
          startDate: "2026-06-01",
          endDate: "2027-05-31",
          status: "active",
          signatureStatus: "signed",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      1,
      "2026-05-04"
    );

    expect(metrics.leasedUnits).toHaveLength(0);
    expect(metrics.occupancyRate).toBe(0);
    expect(metrics.currentOccupiedRentTotal).toBe(0);
  });

  it("uses backend derived lifecycle state for occupancy when present", () => {
    const metrics = buildPropertySummaryMetrics(
      [
        {
          id: "unit-1",
          unitNumber: "101",
          status: "vacant",
          rent: 1800,
        },
      ],
      [
        {
          id: "lease-derived",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "101",
          monthlyRent: 1800,
          status: "active",
          derivedLifecycleState: "signed_future",
        },
      ],
      1,
      "2026-05-04"
    );

    expect(metrics.leasedUnits).toHaveLength(0);
    expect(metrics.occupancyRate).toBe(0);
    expect(metrics.currentOccupiedRentTotal).toBe(0);
  });
});
