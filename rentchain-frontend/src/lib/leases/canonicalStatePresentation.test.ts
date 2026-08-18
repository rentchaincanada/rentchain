import { describe, expect, it } from "vitest";
import {
  canonicalLeaseTermLabel,
  canonicalOccupancyLabel,
  canonicalTenantRelationshipLabel,
} from "./canonicalStatePresentation";

describe("canonical state presentation", () => {
  it("keeps lease term, occupancy, and relationship as separate labels", () => {
    expect(canonicalLeaseTermLabel("past")).toBe("Expired");
    expect(canonicalOccupancyLabel("review_needed")).toBe("Review needed");
    expect(canonicalTenantRelationshipLabel("occupancy_unresolved")).toBe("Review needed");
  });

  it("presents active canonical state without consulting legacy status", () => {
    expect(canonicalLeaseTermLabel("active")).toBe("Active");
    expect(canonicalOccupancyLabel("occupied")).toBe("Occupied");
    expect(canonicalTenantRelationshipLabel("current_occupant")).toBe("Current occupant");
  });
});
