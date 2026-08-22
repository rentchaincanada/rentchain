import { describe, expect, it } from "vitest";
import {
  deriveCanonicalLeaseTermState,
  evaluateCanonicalOccupancy,
  evaluateCanonicalTenantRelationship,
  selectCanonicalCurrentLease,
  type CanonicalLeaseStateInput,
} from "../canonicalLeaseOccupancyState";

const asOfDate = "2026-05-01T18:00:00-03:00";
const activeLease: CanonicalLeaseStateInput = {
  id: "lease-active",
  landlordId: "landlord-1",
  propertyId: "property-1",
  unitId: "unit-1",
  tenantId: "tenant-1",
  status: "active",
  executionState: "executed",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

describe("canonical lease and occupancy state", () => {
  it("keeps an inclusive end date active through that UTC calendar day", () => {
    const lease = { ...activeLease, endDate: "2026-04-30" };
    expect(deriveCanonicalLeaseTermState(lease, "2026-04-30T23:59:59Z").state).toBe("active");
    expect(deriveCanonicalLeaseTermState(lease, "2026-05-01T00:00:00Z").state).toBe("past");
  });

  it("treats a date-only end consistently across offset instants", () => {
    const lease = { ...activeLease, endDate: "2026-04-30" };
    expect(deriveCanonicalLeaseTermState(lease, "2026-05-01T00:30:00+14:00").state).toBe("active");
    expect(deriveCanonicalLeaseTermState(lease, "2026-05-01T00:30:00Z").state).toBe("past");
  });

  it("gives explicit terminal state precedence over dates", () => {
    expect(deriveCanonicalLeaseTermState({ ...activeLease, status: "ended" }, asOfDate).state).toBe("ended");
    expect(deriveCanonicalLeaseTermState({ ...activeLease, status: "terminated" }, asOfDate).state).toBe("terminated");
  });

  it("keeps draft execution separate from an overlapping term", () => {
    const result = deriveCanonicalLeaseTermState({ ...activeLease, executionState: "not_started" }, asOfDate);
    expect(result).toMatchObject({ state: "draft", supportsCurrentOccupancy: false });
  });

  it("derives upcoming and rejects invalid date ranges", () => {
    expect(deriveCanonicalLeaseTermState({ ...activeLease, startDate: "2026-06-01" }, asOfDate).state).toBe("upcoming");
    expect(deriveCanonicalLeaseTermState({ ...activeLease, startDate: "2027-01-01", endDate: "2026-12-31" }, asOfDate)).toMatchObject({
      state: "unknown",
      reasons: ["INVALID_LEASE_DATE_RANGE"],
    });
  });

  it("selects only a context-matched current occupancy-supporting lease", () => {
    const selection = selectCanonicalCurrentLease(
      [
        { ...activeLease, id: "past", endDate: "2026-04-30" },
        { ...activeLease, id: "draft", executionState: "not_started" },
        activeLease,
        { ...activeLease, id: "foreign", landlordId: "landlord-2" },
      ],
      { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", asOfDate }
    );
    expect(selection.lease?.id).toBe("lease-active");
  });

  it("fails closed when multiple leases currently support the same context", () => {
    const selection = selectCanonicalCurrentLease(
      [activeLease, { ...activeLease, id: "lease-active-2" }],
      { propertyId: "property-1", unitId: "unit-1", asOfDate }
    );
    expect(selection).toMatchObject({ lease: null, reasons: ["MULTIPLE_CURRENT_LEASES"] });
  });

  it("narrowly excludes a resolved conflicting lease without changing its contractual lifecycle", () => {
    const excluded = {
      ...activeLease,
      id: "lease-excluded",
      occupancyDisposition: {
        status: "excluded_from_current_occupancy_by_resolution",
        reason: "multiple_current_resolution",
        resolutionEventId: "occupancy_resolution:event-1",
        selectedLeaseId: "lease-active",
        excludedAt: "2026-05-01T12:00:00.000Z",
      },
    };
    expect(deriveCanonicalLeaseTermState(excluded, asOfDate)).toMatchObject({ state: "active", supportsCurrentOccupancy: false });
    expect(selectCanonicalCurrentLease([activeLease, excluded], { propertyId: "property-1", unitId: "unit-1", asOfDate }).lease?.id).toBe("lease-active");
  });

  it("fails safely when every otherwise-current lease is excluded", () => {
    const exclusion = { status: "excluded_from_current_occupancy_by_resolution", reason: "multiple_current_resolution", resolutionEventId: "occupancy_resolution:event-1", selectedLeaseId: "other", excludedAt: "2026-05-01T12:00:00.000Z" };
    const selection = selectCanonicalCurrentLease([
      { ...activeLease, occupancyDisposition: exclusion },
      { ...activeLease, id: "lease-active-2", occupancyDisposition: exclusion },
    ], { propertyId: "property-1", unitId: "unit-1", asOfDate });
    expect(selection.lease).toBeNull();
    expect(evaluateCanonicalOccupancy({ persistedUnitOccupancy: "occupied", selection })).toMatchObject({ occupancyState: "review_needed", supportingLeaseId: null });
  });

  it.each([
    { status: "excluded_from_current_occupancy_by_resolution" },
    { status: "excluded_from_current_occupancy_by_resolution", reason: "multiple_current_resolution", resolutionEventId: "occupancy_resolution:event-1", selectedLeaseId: "lease-active", excludedAt: "not-a-date" },
    { status: "excluded_from_current_occupancy_by_resolution", reason: "multiple_current_resolution", resolutionEventId: "occupancy_resolution:event-1", selectedLeaseId: "lease-active-2", excludedAt: "2026-05-01T12:00:00.000Z" },
  ])("does not silently honor malformed exclusion metadata", (occupancyDisposition) => {
    const selection = selectCanonicalCurrentLease([
      activeLease,
      { ...activeLease, id: "lease-active-2", occupancyDisposition },
    ], { propertyId: "property-1", unitId: "unit-1", asOfDate });
    expect(selection).toMatchObject({ lease: null, reasons: ["MULTIPLE_CURRENT_LEASES"] });
  });

  it("keeps excluded future and ended leases non-current", () => {
    const occupancyDisposition = { status: "excluded_from_current_occupancy_by_resolution", reason: "multiple_current_resolution", resolutionEventId: "occupancy_resolution:event-1", selectedLeaseId: "lease-active", excludedAt: "2026-05-01T12:00:00.000Z" };
    expect(deriveCanonicalLeaseTermState({ ...activeLease, startDate: "2027-01-01", endDate: "2027-12-31", occupancyDisposition }, asOfDate).supportsCurrentOccupancy).toBe(false);
    expect(deriveCanonicalLeaseTermState({ ...activeLease, status: "ended", occupancyDisposition }, asOfDate).supportsCurrentOccupancy).toBe(false);
  });

  it("matches a non-primary participant in canonical tenant context", () => {
    const selection = selectCanonicalCurrentLease([{ ...activeLease, primaryTenantId: "tenant-1", tenantIds: ["tenant-1", "tenant-2"] }], { tenantId: "tenant-2", asOfDate });
    expect(selection.lease?.id).toBe("lease-active");
  });

  it("does not treat an expired lease with stale occupied state as vacant", () => {
    const selection = selectCanonicalCurrentLease(
      [{ ...activeLease, endDate: "2026-04-30" }],
      { propertyId: "property-1", unitId: "unit-1", asOfDate }
    );
    const occupancy = evaluateCanonicalOccupancy({
      persistedUnitOccupancy: "occupied",
      persistedTenancyStatus: "active",
      currentLeasePointerId: "lease-active",
      selection,
    });
    expect(occupancy.occupancyState).toBe("review_needed");
    expect(occupancy.reasons).toEqual(expect.arrayContaining(["STALE_CURRENT_LEASE_POINTER", "OCCUPIED_WITHOUT_CURRENT_LEASE"]));
  });

  it("reports vacancy only when no current lease conflicts with explicit vacancy", () => {
    const selection = selectCanonicalCurrentLease([], { propertyId: "property-1", unitId: "unit-1", asOfDate });
    expect(evaluateCanonicalOccupancy({ persistedUnitOccupancy: "vacant", selection })).toMatchObject({
      occupancyState: "vacant",
      supportingLeaseId: null,
    });
  });

  it("flags an active lease on an explicitly vacant projection", () => {
    const selection = selectCanonicalCurrentLease([activeLease], { propertyId: "property-1", unitId: "unit-1", asOfDate });
    expect(evaluateCanonicalOccupancy({ persistedUnitOccupancy: "vacant", selection })).toMatchObject({
      occupancyState: "review_needed",
      reasons: ["VACANT_WITH_CURRENT_LEASE"],
    });
  });

  it("derives current, past, and unresolved tenant relationships from canonical occupancy", () => {
    const currentSelection = selectCanonicalCurrentLease([activeLease], { tenantId: "tenant-1", asOfDate });
    const occupied = evaluateCanonicalOccupancy({ persistedUnitOccupancy: "occupied", currentLeasePointerId: "lease-active", selection: currentSelection });
    expect(evaluateCanonicalTenantRelationship({ tenantId: "tenant-1", persistedTenantStatus: "current", currentLeasePointerId: "lease-active", selection: currentSelection, occupancy: occupied }).relationshipState).toBe("current_occupant");

    const noLease = selectCanonicalCurrentLease([], { tenantId: "tenant-1", asOfDate });
    const vacant = evaluateCanonicalOccupancy({ persistedUnitOccupancy: "vacant", selection: noLease });
    expect(evaluateCanonicalTenantRelationship({ tenantId: "tenant-1", persistedTenantStatus: "past", selection: noLease, occupancy: vacant }).relationshipState).toBe("past_tenant");
    expect(evaluateCanonicalTenantRelationship({ tenantId: "tenant-1", persistedTenantStatus: "current", selection: noLease, occupancy: vacant })).toMatchObject({
      relationshipState: "occupancy_unresolved",
      reasons: ["TENANT_CURRENT_WITHOUT_CURRENT_LEASE"],
    });
  });

  it("keeps a coherent past tenant past when the only lease is expired", () => {
    const selection = selectCanonicalCurrentLease(
      [{ ...activeLease, endDate: "2026-04-30" }],
      { tenantId: "tenant-1", asOfDate }
    );
    const occupancy = evaluateCanonicalOccupancy({ persistedUnitOccupancy: "vacant", selection });

    expect(evaluateCanonicalTenantRelationship({
      tenantId: "tenant-1",
      persistedTenantStatus: "past",
      selection,
      occupancy,
    })).toMatchObject({
      relationshipState: "past_tenant",
      reasons: ["PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY"],
    });
  });

  it("does not use renewal linkage to make a past predecessor current", () => {
    const predecessor = { ...activeLease, id: "old", endDate: "2026-04-30", successorLeaseId: "next" };
    const successor = { ...activeLease, id: "next", startDate: "2026-05-01", endDate: "2027-04-30" };
    const selection = selectCanonicalCurrentLease([predecessor, successor], { propertyId: "property-1", unitId: "unit-1", asOfDate });
    expect(selection.lease?.id).toBe("next");
  });
});
