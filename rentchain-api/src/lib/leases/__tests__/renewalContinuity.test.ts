import { describe, expect, it } from "vitest";
import { evaluateRenewalContinuity, type RenewalContinuityLease } from "../renewalContinuity";

const instant = "2027-01-01T12:00:00.000Z";

function lease(id: string, overrides: Partial<RenewalContinuityLease> = {}): RenewalContinuityLease {
  return {
    id,
    landlordId: "landlord-1",
    propertyId: "property-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    tenantIds: ["tenant-1"],
    status: "active",
    executionStatus: "fully_executed",
    startDate: id === "predecessor" ? "2026-01-01" : "2027-01-01",
    endDate: id === "predecessor" ? "2026-12-31" : "2027-12-31",
    ...(id === "predecessor" ? { renewedByLeaseId: "successor", occupancyEffective: true } : { predecessorLeaseId: "predecessor" }),
    ...overrides,
  };
}

function evaluate(overrides: {
  predecessor?: Partial<RenewalContinuityLease>;
  successor?: Partial<RenewalContinuityLease>;
  contextLeases?: RenewalContinuityLease[];
  evaluationInstant?: string;
  unit?: Record<string, unknown>;
  embedded?: Record<string, unknown>;
  tenant?: Record<string, unknown>;
} = {}) {
  return evaluateRenewalContinuity({
    predecessor: lease("predecessor", overrides.predecessor),
    successor: lease("successor", overrides.successor),
    contextLeases: overrides.contextLeases || [],
    evaluationInstant: overrides.evaluationInstant || instant,
    standaloneUnit: { currentLeaseId: "predecessor", leaseId: "predecessor", currentTenantId: "tenant-1", ...(overrides.unit || {}) },
    embeddedUnit: { currentLeaseId: "predecessor", leaseId: "predecessor", currentTenantId: "tenant-1", ...(overrides.embedded || {}) },
    tenant: { currentLeaseId: "predecessor", ...(overrides.tenant || {}) },
  });
}

describe("renewal continuity contract", () => {
  it("accepts an effective fully executed contiguous linked renewal", () => {
    expect(evaluate()).toMatchObject({ eligible: true, reasons: [], contiguous: true, participantIds: ["tenant-1"] });
  });

  it("keeps a fully executed future renewal ineligible and non-current", () => {
    const result = evaluate({ evaluationInstant: "2026-12-15T12:00:00.000Z" });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("RENEWAL_TOO_EARLY");
  });

  it.each([
    ["missing linkage", { predecessor: { renewedByLeaseId: null } }, "RENEWAL_LINK_MISSING"],
    ["conflicting linkage", { predecessor: { renewalLeaseId: "other" } }, "RENEWAL_LINK_CONFLICT"],
    ["wrong landlord", { successor: { landlordId: "landlord-2" } }, "RENEWAL_CONTEXT_MISMATCH"],
    ["wrong property", { successor: { propertyId: "property-2" } }, "RENEWAL_CONTEXT_MISMATCH"],
    ["wrong unit", { successor: { unitId: "unit-2" } }, "RENEWAL_CONTEXT_MISMATCH"],
    ["gap", { successor: { startDate: "2027-01-02" } }, "RENEWAL_TERM_NOT_CONTIGUOUS"],
    ["incomplete execution", { successor: { executionStatus: "tenant_signed" } }, "RENEWAL_EXECUTION_INCOMPLETE"],
    ["draft successor", { successor: { status: "draft" } }, "RENEWAL_SUCCESSOR_INELIGIBLE"],
    ["ended successor", { successor: { status: "ended" } }, "RENEWAL_SUCCESSOR_INELIGIBLE"],
    ["invalid dates", { successor: { startDate: "2027-12-31", endDate: "2027-01-01" } }, "RENEWAL_SUCCESSOR_INELIGIBLE"],
    ["participant mismatch", { successor: { tenantId: "tenant-2", tenantIds: ["tenant-2"] } }, "RENEWAL_PARTICIPANTS_MISMATCH"],
    ["superseded successor", { successor: { renewedByLeaseId: "successor-2" } }, "RENEWAL_SUCCESSOR_SUPERSEDED"],
    ["occupancy-excluded successor", { successor: { occupancyDisposition: { status: "excluded_from_current_occupancy_by_resolution" } } }, "RENEWAL_SUCCESSOR_INELIGIBLE"],
    ["stale unit pointer", { unit: { currentLeaseId: "other", leaseId: "other" } }, "RENEWAL_PROJECTION_MISMATCH"],
    ["stale tenant pointer", { tenant: { currentLeaseId: "other" } }, "RENEWAL_PROJECTION_MISMATCH"],
  ] as const)("fails closed for %s", (_label, input, reason) => {
    const result = evaluate(input as Parameters<typeof evaluate>[0]);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(reason);
  });

  it("fails closed for overlapping current terms without choosing the linked renewal", () => {
    const result = evaluate({ predecessor: { endDate: "2027-01-31" } });
    expect(result.reasons).toContain("MULTIPLE_CURRENT_LEASES");
    expect(result.eligible).toBe(false);
  });

  it("fails closed when a predecessor has multiple explicit successors", () => {
    const result = evaluate({ contextLeases: [lease("successor-2", { predecessorLeaseId: "predecessor" })] });
    expect(result.reasons).toContain("MULTIPLE_RENEWAL_SUCCESSORS");
  });

  it("normalizes participant sets by canonical ID rather than ordering", () => {
    const result = evaluate({
      predecessor: { tenantId: "tenant-1", tenantIds: ["tenant-2", "tenant-1"] },
      successor: { tenantId: "tenant-2", tenantIds: ["tenant-1", "tenant-2"] },
    });
    expect(result.reasons).not.toContain("RENEWAL_PARTICIPANTS_MISMATCH");
  });
});
