import { describe, expect, it } from "vitest";
import { evaluateCanonicalLeaseStart, type CanonicalLeaseStartInput } from "../canonicalLeaseStart";

const instant = "2026-05-01T12:00:00.000Z";

function baseInput(): CanonicalLeaseStartInput {
  return {
    landlordId: "landlord-1",
    propertyId: "property-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    evaluationInstant: instant,
    candidateLease: {
      id: "lease-1",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      tenantId: "tenant-1",
      status: "active",
      executionStatus: "fully_executed",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    },
    contextLeases: [],
    standaloneUnits: [{ id: "unit-1", landlordId: "landlord-1", propertyId: "property-1", status: "vacant", occupancyStatus: "vacant" }],
    embeddedUnits: [{ id: "unit-1", landlordId: "landlord-1", propertyId: "property-1", status: "vacant", occupancyStatus: "vacant" }],
    tenant: { id: "tenant-1", landlordId: "landlord-1", status: "past" },
    tenancies: [],
  };
}

function coherentInput(): CanonicalLeaseStartInput {
  const input = baseInput();
  const unit = {
    id: "unit-1",
    landlordId: "landlord-1",
    propertyId: "property-1",
    status: "occupied",
    occupancyStatus: "occupied",
    tenantId: "tenant-1",
    currentTenantId: "tenant-1",
    leaseId: "lease-1",
    currentLeaseId: "lease-1",
  };
  input.standaloneUnits = [{ ...unit }];
  input.embeddedUnits = [{ ...unit }];
  input.tenant = { id: "tenant-1", landlordId: "landlord-1", status: "current", currentLeaseId: "lease-1" };
  input.tenancies = [{
    id: "tenancy-1",
    landlordId: "landlord-1",
    propertyId: "property-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    leaseId: "lease-1",
    status: "active",
    moveInAt: "2026-04-01T12:00:00.000Z",
  }];
  return input;
}

describe("canonical lease start", () => {
  it("makes a fully executed current lease occupancy-effective", () => {
    expect(evaluateCanonicalLeaseStart(baseInput())).toMatchObject({ outcome: "occupancy_effective", occupancyEffective: true, reasons: [] });
  });

  it("keeps a fully executed future lease without current occupancy", () => {
    const input = baseInput();
    input.candidateLease.startDate = "2026-06-01";
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "created_without_occupancy", occupancyEffective: false, reasons: ["UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY"], postcondition: null });
  });

  it("keeps a draft current lease without current occupancy", () => {
    const input = baseInput();
    input.candidateLease.status = "draft";
    input.candidateLease.executionStatus = "draft";
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "created_without_occupancy", reasons: ["DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY"] });
  });

  it("keeps execution-incomplete current leases without occupancy", () => {
    const input = baseInput();
    input.candidateLease.executionStatus = "tenant_signed";
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "created_without_occupancy", reasons: ["LEASE_EXECUTION_INCOMPLETE"] });
  });

  it("requires affirmative execution evidence even for legacy active status", () => {
    const input = baseInput();
    delete input.candidateLease.executionStatus;
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "created_without_occupancy", reasons: ["LEASE_EXECUTION_INCOMPLETE"], postcondition: null });
  });

  it("does not create occupancy for a past lease", () => {
    const input = baseInput();
    input.candidateLease.endDate = "2026-04-30";
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "created_without_occupancy", reasons: ["PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY"] });
  });

  it("does not create occupancy for an ended lease", () => {
    const input = baseInput();
    input.candidateLease.status = "ended";
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "created_without_occupancy", reasons: ["ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY"] });
  });

  it("rejects an invalid date range", () => {
    const input = baseInput();
    input.candidateLease.startDate = "2027-01-01";
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "rejected", reasons: ["INVALID_LEASE_DATE_RANGE"] });
  });

  it("fails closed for multiple eligible current leases", () => {
    const input = baseInput();
    input.contextLeases = [{ ...input.candidateLease, id: "lease-2" }];
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "rejected", reasons: ["MULTIPLE_CURRENT_LEASES"], postcondition: null });
  });

  it("rejects standalone and embedded unit identity mismatch", () => {
    const input = baseInput();
    input.embeddedUnits[0].id = "unit-2";
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "rejected", reasons: ["CURRENT_LEASE_CONTEXT_MISMATCH"] });
  });

  it("rejects a tenant who is not the canonical lease party", () => {
    const input = baseInput();
    input.candidateLease.tenantId = "tenant-2";
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "rejected", reasons: ["CURRENT_LEASE_CONTEXT_MISMATCH"] });
  });

  it("builds the complete pure postcondition for a vacant unit", () => {
    const result = evaluateCanonicalLeaseStart(baseInput());
    expect(result.postcondition).toMatchObject({
      lease: { id: "lease-1", occupancyEffective: true },
      standaloneUnit: { status: "occupied", currentTenantId: "tenant-1", currentLeaseId: "lease-1" },
      embeddedPropertyUnit: { status: "occupied", currentTenantId: "tenant-1", currentLeaseId: "lease-1" },
      tenant: { currentLeaseId: "lease-1" },
      tenancy: { action: "create", moveInAt: instant },
      canonicalEvent: { type: "lease.occupancy_started" },
      idempotencyResult: { operation: "canonical_lease_start" },
    });
  });

  it("rejects an occupied unit with an unrelated tenant", () => {
    const input = baseInput();
    input.standaloneUnits[0] = { ...input.standaloneUnits[0], status: "occupied", tenantId: "tenant-2" };
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "rejected", reasons: ["OCCUPIED_WITHOUT_CURRENT_LEASE", "STALE_CURRENT_LEASE_POINTER"] });
  });

  it("rejects stale unit and tenant lease pointers", () => {
    const unitInput = baseInput();
    unitInput.standaloneUnits[0].currentLeaseId = "lease-stale";
    expect(evaluateCanonicalLeaseStart(unitInput)).toMatchObject({ outcome: "rejected", reasons: ["STALE_CURRENT_LEASE_POINTER"] });
    const tenantInput = baseInput();
    tenantInput.tenant!.currentLeaseId = "lease-stale";
    expect(evaluateCanonicalLeaseStart(tenantInput)).toMatchObject({ outcome: "rejected", reasons: ["STALE_CURRENT_LEASE_POINTER"] });
  });

  it("recognizes already coherent occupancy", () => {
    expect(evaluateCanonicalLeaseStart(coherentInput())).toMatchObject({ outcome: "already_coherent", occupancyEffective: true, reasons: [], postcondition: null });
  });

  it("returns zero required writes on an already coherent replay", () => {
    const first = evaluateCanonicalLeaseStart(coherentInput());
    const replay = evaluateCanonicalLeaseStart(coherentInput());
    expect(replay).toEqual(first);
    expect(replay.postcondition).toBeNull();
  });

  it("keeps a future successor non-current while its predecessor is active", () => {
    const input = baseInput();
    const predecessor = { ...input.candidateLease, id: "lease-predecessor", startDate: "2025-06-01", endDate: "2026-05-31" };
    input.candidateLease.startDate = "2026-06-01";
    input.candidateLease.endDate = "2027-05-31";
    input.contextLeases = [predecessor];
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "created_without_occupancy", postcondition: null });
  });

  it("reconciles same-tenant occupied state with safely missing pointers", () => {
    const input = baseInput();
    input.standaloneUnits[0] = { ...input.standaloneUnits[0], status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1" };
    input.embeddedUnits[0] = { ...input.embeddedUnits[0], status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1" };
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "occupancy_effective" });
  });

  it("rejects ambiguous matching tenancies", () => {
    const input = baseInput();
    const tenancy = { id: "tenancy-1", landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "inactive" };
    input.tenancies = [tenancy, { ...tenancy, id: "tenancy-2" }];
    expect(evaluateCanonicalLeaseStart(input)).toMatchObject({ outcome: "rejected", reasons: ["CURRENT_LEASE_CONTEXT_MISMATCH"] });
  });

  it("carries legacy occupancy booleans only when already present", () => {
    const absent = evaluateCanonicalLeaseStart(baseInput()).postcondition!;
    expect(absent.standaloneUnit).not.toHaveProperty("occupied");
    expect(absent.standaloneUnit).not.toHaveProperty("isOccupied");
    const presentInput = baseInput();
    presentInput.standaloneUnits[0].occupied = false;
    presentInput.embeddedUnits[0].isOccupied = false;
    const present = evaluateCanonicalLeaseStart(presentInput).postcondition!;
    expect(present.standaloneUnit.occupied).toBe(true);
    expect(present.embeddedPropertyUnit.isOccupied).toBe(true);
  });

  it("uses UTC calendar boundaries independent of offset spelling", () => {
    const before = baseInput();
    before.candidateLease.startDate = "2026-05-01";
    before.evaluationInstant = "2026-05-01T00:30:00+14:00";
    expect(evaluateCanonicalLeaseStart(before).outcome).toBe("created_without_occupancy");
    const atBoundary = baseInput();
    atBoundary.candidateLease.startDate = "2026-05-01";
    atBoundary.evaluationInstant = "2026-05-01T00:00:00Z";
    expect(evaluateCanonicalLeaseStart(atBoundary).outcome).toBe("occupancy_effective");
  });

  it("is invariant to context lease and tenancy input ordering", () => {
    const left = baseInput();
    left.contextLeases = [
      { ...left.candidateLease, id: "past-z", endDate: "2025-12-31" },
      { ...left.candidateLease, id: "future-a", startDate: "2027-01-01", endDate: "2027-12-31" },
    ];
    left.tenancies = [{ id: "foreign-z", landlordId: "landlord-1", propertyId: "property-2", unitId: "unit-2", tenantId: "tenant-2", status: "inactive" }];
    const right = { ...left, contextLeases: [...left.contextLeases].reverse(), tenancies: [...left.tenancies].reverse() };
    expect(evaluateCanonicalLeaseStart(right)).toEqual(evaluateCanonicalLeaseStart(left));
  });

  it("preserves a verified earlier move-in instant and reconciles a unique inactive tenancy", () => {
    const input = baseInput();
    input.tenancies = [{ id: "tenancy-1", landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "inactive", moveInAt: "2026-04-01T12:00:00Z" }];
    expect(evaluateCanonicalLeaseStart(input).postcondition?.tenancy).toMatchObject({ action: "reconcile", moveInAt: "2026-04-01T12:00:00.000Z" });
  });
});
