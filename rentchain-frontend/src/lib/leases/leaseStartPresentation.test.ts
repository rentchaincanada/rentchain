import { describe, expect, it } from "vitest";
import { leaseStartMutationErrorMessage, leaseStartOutcomePresentation } from "./leaseStartPresentation";

describe("leaseStartPresentation", () => {
  it("distinguishes a created future lease from current occupancy", () => {
    expect(leaseStartOutcomePresentation("created_without_occupancy", "2026-10-01")).toEqual(
      expect.objectContaining({ title: "Lease created", occupancyLabel: "Pending occupancy" })
    );
    expect(leaseStartOutcomePresentation("created_without_occupancy", "2026-10-01").description).toContain("future-start automation is not enabled");
  });

  it("presents an authoritative occupancy-effective result as current", () => {
    expect(leaseStartOutcomePresentation("occupancy_effective")).toEqual(
      expect.objectContaining({ title: "Lease activated", occupancyLabel: "Current occupancy" })
    );
  });

  it("provides bounded retry, review, End Lease, and restore guidance", () => {
    expect(leaseStartMutationErrorMessage({ body: { error: "lease_start_idempotency_key_reused" } }, "fallback")).toMatch(/new operation/i);
    expect(leaseStartMutationErrorMessage({ body: { error: "occupancy_state_stale" } }, "fallback")).toMatch(/refresh/i);
    expect(leaseStartMutationErrorMessage({ body: { error: "end_lease_workflow_required" } }, "fallback")).toMatch(/End Lease/i);
    expect(leaseStartMutationErrorMessage({ body: { error: "restore_active_workflow_required" } }, "fallback")).toMatch(/explicit restore workflow/i);
    expect(leaseStartMutationErrorMessage({ body: { error: "anonymous_occupied_unit" } }, "fallback")).toMatch(/Review needed/i);
  });

  it("does not expose infrastructure details", () => {
    expect(leaseStartMutationErrorMessage(new Error("Firestore payloadHash stack failure"), "Lease update failed.")).toBe("Lease update failed.");
  });
});
