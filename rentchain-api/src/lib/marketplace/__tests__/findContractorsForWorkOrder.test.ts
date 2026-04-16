import { describe, expect, it } from "vitest";
import { findContractorsForWorkOrder, normalizeServiceCategory } from "../findContractorsForWorkOrder";

describe("findContractorsForWorkOrder", () => {
  const contractors = [
    {
      version: "v1" as const,
      id: "c-1",
      displayName: "Active Halifax Plumber",
      serviceCategories: ["plumbing"] as const,
      serviceAreas: ["Halifax"],
      availabilityStatus: "active" as const,
      contact: {},
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
    },
    {
      version: "v1" as const,
      id: "c-2",
      displayName: "Limited Halifax Plumber",
      serviceCategories: ["plumbing"] as const,
      serviceAreas: ["Halifax"],
      availabilityStatus: "limited" as const,
      contact: {},
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
    },
    {
      version: "v1" as const,
      id: "c-3",
      displayName: "Active Dartmouth Electrician",
      serviceCategories: ["electrical"] as const,
      serviceAreas: ["Dartmouth"],
      availabilityStatus: "active" as const,
      contact: {},
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
    },
  ];

  it("normalizes category aliases safely", () => {
    expect(normalizeServiceCategory("HVAC")).toBe("hvac");
    expect(normalizeServiceCategory("general maintenance")).toBe("general_maintenance");
    expect(normalizeServiceCategory("unknown")).toBeNull();
  });

  it("matches by service category and prefers area and active availability", () => {
    const result = findContractorsForWorkOrder({
      contractors: contractors as any,
      serviceCategory: "plumbing",
      serviceArea: "Halifax",
    });
    expect(result.map((item) => item.id)).toEqual(["c-1", "c-2"]);
  });

  it("returns a stable empty result when no category match exists", () => {
    const result = findContractorsForWorkOrder({
      contractors: contractors as any,
      serviceCategory: "locksmith",
      serviceArea: "Halifax",
    });
    expect(result).toEqual([]);
  });
});
