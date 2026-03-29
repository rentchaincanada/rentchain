import { describe, expect, it } from "vitest";
import { getUnitsNeedingOccupancySetup } from "./occupancyPrompt";

describe("getUnitsNeedingOccupancySetup", () => {
  it("flags units that are not leased and still need occupancy setup", () => {
    const result = getUnitsNeedingOccupancySetup(
      [
        { id: "unit-1", unitNumber: "1", status: "occupied", occupantName: "Alice" },
        { id: "unit-2", unitNumber: "2" },
      ],
      [
        {
          id: "lease-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "1",
          tenantId: "tenant-1",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          status: "active",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ] as any
    );

    expect(result.map((unit) => unit.id)).toEqual(["unit-2"]);
  });

  it("treats leased, explicitly vacant, and fully marked occupied units as complete", () => {
    const result = getUnitsNeedingOccupancySetup(
      [
        { id: "unit-1", unitNumber: "1", status: "occupied", occupantName: "Alice" },
        { id: "unit-2", unitNumber: "2", status: "vacant" },
        { id: "unit-3", unitNumber: "3", status: "occupied", occupantName: "Bob", rent: 2100 },
      ],
      [
        {
          id: "lease-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "1",
          tenantId: "tenant-1",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          status: "active",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ] as any
    );

    expect(result).toEqual([]);
  });
});
