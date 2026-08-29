import { describe, expect, it } from "vitest";
import type { CanonicalLeaseConflictReason } from "../../lib/leases/canonicalLeaseOccupancyState";
import { aggregateOccupancyReviewWorkspace, classifyOccupancyReviewAction, type OccupancyReviewRecords } from "../occupancyReviewWorkspaceService";

const landlordId = "landlord-1";
const baseRecords = (): OccupancyReviewRecords => ({
  properties: [{ id: "property-1", landlordId, name: "Harbour House" }],
  units: [{ id: "unit-1", landlordId, propertyId: "property-1", unitNumber: "1", status: "occupied", currentTenantId: "tenant-1" }],
  tenants: [{ id: "tenant-1", landlordId, name: "Taylor Tenant", status: "current" }],
  leases: [], tenancies: [],
});
const activeLease = (id: string, overrides: Record<string, unknown> = {}) => ({ id, landlordId, propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "active", startDate: "2026-01-01", endDate: "2027-01-01", executionStatus: "fully_executed", ...overrides });
const safeStatusOnlyRecords = (): OccupancyReviewRecords => {
  const records = baseRecords();
  records.units[0] = { ...records.units[0], status: "vacant", occupancyStatus: "vacant", currentTenantId: null, currentLeaseId: null, tenantId: null, leaseId: null };
  records.properties[0].units = [{ id: "unit-1", status: "vacant", occupancyStatus: "vacant", currentTenantId: null, currentLeaseId: null, tenantId: null, leaseId: null }];
  records.tenants[0] = { ...records.tenants[0], status: "current", currentLeaseId: null };
  records.tenancies = [{ id: "tenancy-ended", landlordId, propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "inactive", moveOutAt: "2026-08-01T00:00:00.000Z", moveOutReason: "LEASE_TERM_END" }];
  return records;
};

describe("occupancyReviewWorkspaceService", () => {
  it("returns one stable, high-priority item for a multiple-current unit", () => {
    const records = baseRecords(); records.leases = [activeLease("lease-a"), activeLease("lease-b")];
    const first = aggregateOccupancyReviewWorkspace(landlordId, records);
    const second = aggregateOccupancyReviewWorkspace(landlordId, records);
    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({ reasons: expect.arrayContaining(["MULTIPLE_CURRENT_LEASES"]), action: "resolve_multiple_current", candidateLeaseIds: ["lease-a", "lease-b"] });
    expect(first.items[0].id).toBe(second.items[0].id);
  });

  it("does not report a resolved PR E excluded competing lease", () => {
    const records = baseRecords();
    records.units[0].currentLeaseId = "lease-a";
    records.leases = [activeLease("lease-a", { occupancyEffective: true }), activeLease("lease-b", { occupancyEffective: false, occupancyDisposition: { status: "excluded_from_current_occupancy_by_resolution", reason: "multiple_current_resolution", selectedLeaseId: "lease-a", resolutionEventId: "occupancy_resolution:event", excludedAt: "2026-08-20" } })];
    records.tenancies = [{ id: "tenancy-a", landlordId, propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "lease-a", status: "active" }];
    expect(aggregateOccupancyReviewWorkspace(landlordId, records).items).toEqual([]);
  });

  it("reports occupied without current lease", () => {
    const result = aggregateOccupancyReviewWorkspace(landlordId, baseRecords());
    expect(result.items[0].reasons).toContain("OCCUPIED_WITHOUT_CURRENT_LEASE");
  });

  it("reports vacant with a current lease", () => {
    const records = baseRecords(); records.units[0].status = "vacant"; records.units[0].currentLeaseId = "lease-a"; records.leases = [activeLease("lease-a")];
    expect(aggregateOccupancyReviewWorkspace(landlordId, records).items[0].reasons).toContain("VACANT_WITH_CURRENT_LEASE");
  });

  it("reports stale pointers", () => {
    const records = baseRecords(); records.units[0].currentLeaseId = "stale"; records.leases = [activeLease("lease-a")];
    expect(aggregateOccupancyReviewWorkspace(landlordId, records).items[0].reasons).toContain("STALE_CURRENT_LEASE_POINTER");
  });

  it("reports a current lease pointer whose lease belongs to another unit as a context mismatch", () => {
    const records = baseRecords(); records.units[0].currentLeaseId = "lease-other";
    records.units.push({ id: "unit-2", landlordId, propertyId: "property-1", unitNumber: "2", status: "vacant" });
    records.leases = [activeLease("lease-other", { unitId: "unit-2" })];
    expect(aggregateOccupancyReviewWorkspace(landlordId, records).items[0].reasons).toContain("CURRENT_LEASE_CONTEXT_MISMATCH");
  });

  it("reports lifecycle and execution conflicts through canonical evaluation", () => {
    const cases: Array<[Record<string, unknown>, CanonicalLeaseConflictReason]> = [
      [{ startDate: "2027-01-01", endDate: "2026-01-01" }, "INVALID_LEASE_DATE_RANGE"],
      [{ status: "draft", executionStatus: "draft" }, "DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY"],
      [{ startDate: "2099-01-01", endDate: "2100-01-01" }, "UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY"],
      [{ startDate: "2020-01-01", endDate: "2021-01-01" }, "PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY"],
      [{ status: "ended", endedAt: "2026-01-01" }, "ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY"],
      [{ executionStatus: "tenant_signed" }, "LEASE_EXECUTION_INCOMPLETE"],
    ];
    for (const [overrides, reason] of cases) {
      const records = baseRecords(); records.leases = [activeLease(`lease-${reason}`, overrides)];
      expect(aggregateOccupancyReviewWorkspace(landlordId, records).items[0].reasons).toContain(reason);
    }
  });

  it("reports a unitless current tenant without a current lease once", () => {
    const records = baseRecords(); records.units[0].status = "vacant"; records.units[0].currentTenantId = null;
    const result = aggregateOccupancyReviewWorkspace(landlordId, records);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ scope: "tenant", reasons: expect.arrayContaining(["TENANT_CURRENT_WITHOUT_CURRENT_LEASE"]), action: "review_tenant_relationship" });
  });

  it("classifies a current tenant without a current lease without repairing authoritative state", () => {
    const authoritative: OccupancyReviewRecords & { canonicalEvents: Array<Record<string, unknown>> } = {
      ...baseRecords(),
      canonicalEvents: [],
    };
    authoritative.units[0] = { ...authoritative.units[0], status: "vacant", currentTenantId: null, currentLeaseId: null };
    authoritative.tenants[0] = { ...authoritative.tenants[0], status: "current", currentLeaseId: null };
    authoritative.leases = [];
    authoritative.tenancies = [];
    const before = structuredClone(authoritative);

    const result = aggregateOccupancyReviewWorkspace(landlordId, authoritative);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      scope: "tenant",
      canonicalState: { tenantRelationshipState: "occupancy_unresolved" },
      reasons: expect.arrayContaining(["TENANT_CURRENT_WITHOUT_CURRENT_LEASE"]),
    });
    expect(authoritative).toEqual(before);
    expect(authoritative.tenants[0].status).toBe(before.tenants[0].status);
    expect(authoritative.leases).toHaveLength(before.leases.length);
    expect(authoritative.tenancies).toEqual(before.tenancies);
    expect(authoritative.units[0].status).toBe(before.units[0].status);
    expect(authoritative.canonicalEvents).toHaveLength(before.canonicalEvents.length);
    expect(result.items[0]).toMatchObject({ resolutionAvailable: false, diagnosticCategory: "explicit_end_evidence_missing", supportingEvidence: [] });
  });

  it("exposes only server-authoritative safe metadata for the strict status-only subtype", () => {
    const records = safeStatusOnlyRecords();
    const before = structuredClone(records);
    const result = aggregateOccupancyReviewWorkspace(landlordId, records);
    expect(result.items[0]).toMatchObject({ resolutionAvailable: true, remediationSubtype: "status_only_stale_after_explicit_ended_occupancy", resolutionType: "reconcile_stale_tenant_relationship_status", expectedStateToken: expect.any(String), supportingEvidence: [expect.objectContaining({ evidenceType: "explicit_inactive_tenancy", attributionStatus: "attributed" })] });
    expect(JSON.stringify(result.items[0].supportingEvidence)).not.toContain("moveOutReason");
    expect(records).toEqual(before);
    records.tenants[0].status = "Past";
    expect(aggregateOccupancyReviewWorkspace(landlordId, records).items).toEqual([]);
  });

  it("fails closed when authoritative context contains a foreign active tenancy for the tenant", () => {
    const records = safeStatusOnlyRecords();
    records.tenancies.push({ id: "foreign-active", landlordId: "landlord-2", propertyId: "foreign-property", unitId: "foreign-unit", tenantId: "tenant-1", status: "active" });

    const result = aggregateOccupancyReviewWorkspace(landlordId, records);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ scope: "tenant", resolutionAvailable: false, diagnosticCategory: "ownership_mismatch", supportingEvidence: [] });
    expect(JSON.stringify(result)).not.toContain("foreign-active");
    expect(JSON.stringify(result)).not.toContain("landlord-2");
  });

  it("fails closed when authoritative context contains a foreign inactive tenancy", () => {
    const records = safeStatusOnlyRecords();
    records.tenancies.push({ id: "foreign-inactive", landlordId: "landlord-2", propertyId: "foreign-property", unitId: "foreign-unit", tenantId: "tenant-1", status: "inactive", moveOutAt: "2026-07-01T00:00:00.000Z", moveOutReason: "LEASE_TERM_END" });

    const result = aggregateOccupancyReviewWorkspace(landlordId, records);

    expect(result.items[0]).toMatchObject({ resolutionAvailable: false, diagnosticCategory: "ownership_mismatch", supportingEvidence: [] });
    expect(JSON.stringify(result)).not.toContain("foreign-inactive");
  });

  it("fails closed when authoritative context contains a foreign unit linkage for the tenant", () => {
    const records = safeStatusOnlyRecords();
    records.properties.push({ id: "foreign-property", landlordId: "landlord-2", name: "Foreign Property" });
    records.units.push({ id: "foreign-unit", landlordId: "landlord-2", propertyId: "foreign-property", status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1", currentTenantId: "tenant-1" });

    const result = aggregateOccupancyReviewWorkspace(landlordId, records);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ scope: "tenant", resolutionAvailable: false, diagnosticCategory: "ownership_mismatch", supportingEvidence: [] });
    expect(JSON.stringify(result)).not.toContain("foreign-unit");
    expect(JSON.stringify(result)).not.toContain("Foreign Property");
  });

  it("keeps participant ambiguity visible to the eligibility classifier at the aggregation boundary", () => {
    const records = safeStatusOnlyRecords();
    records.leases.push({ id: "ambiguous-lease", landlordId, propertyId: "missing-property", unitId: "missing-unit", tenantId: "tenant-1", tenantIds: ["tenant-1", "tenant-2"], status: "ended", endedAt: "2026-08-01T00:00:00.000Z" });

    const result = aggregateOccupancyReviewWorkspace(landlordId, records);

    expect(result.items[0]).toMatchObject({ resolutionAvailable: false, diagnosticCategory: "participant_ambiguous", supportingEvidence: [] });
  });

  it("omits coherent occupied and vacant units", () => {
    const occupied = baseRecords(); occupied.units[0].currentLeaseId = "lease-a"; occupied.leases = [activeLease("lease-a")]; occupied.tenancies = [{ id: "t", landlordId, propertyId: "property-1", unitId: "unit-1", leaseId: "lease-a", tenantId: "tenant-1", status: "active" }]; occupied.tenants[0].currentLeaseId = "lease-a";
    expect(aggregateOccupancyReviewWorkspace(landlordId, occupied).items).toEqual([]);
    const vacant = baseRecords(); vacant.units[0] = { ...vacant.units[0], status: "vacant", currentTenantId: null }; vacant.tenants[0].status = "former";
    expect(aggregateOccupancyReviewWorkspace(landlordId, vacant).items).toEqual([]);
  });

  it("excludes every cross-landlord record", () => {
    const records = baseRecords(); records.properties.push({ id: "other-property", landlordId: "other", name: "Other" }); records.units.push({ id: "other-unit", landlordId: "other", propertyId: "other-property", status: "occupied" });
    expect(aggregateOccupancyReviewWorkspace(landlordId, records).items.every((item) => item.landlordId === landlordId)).toBe(true);
  });

  it("uses deterministic precedence and safely classifies every canonical reason", () => {
    const reasons: CanonicalLeaseConflictReason[] = ["MULTIPLE_CURRENT_LEASES", "INVALID_LEASE_DATE_RANGE", "CURRENT_LEASE_CONTEXT_MISMATCH", "DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY", "UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY", "PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY", "ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY", "LEASE_EXECUTION_INCOMPLETE", "OCCUPIED_WITHOUT_CURRENT_LEASE", "VACANT_WITH_CURRENT_LEASE", "STALE_CURRENT_LEASE_POINTER", "TENANT_CURRENT_WITHOUT_CURRENT_LEASE"];
    for (const reason of reasons) expect(classifyOccupancyReviewAction([reason], { propertyId: "p", unitId: "u", tenantId: "t", supportingLeaseId: "l" }).action).toBeTruthy();
    expect(classifyOccupancyReviewAction(["LEASE_EXECUTION_INCOMPLETE", "MULTIPLE_CURRENT_LEASES"], { propertyId: "p", unitId: "u", supportingLeaseId: "l" }).action).toBe("resolve_multiple_current");
  });

  it("sorts deterministically by severity and stable property context", () => {
    const records = baseRecords(); records.properties.push({ id: "property-2", landlordId, name: "Alpha House" }); records.units.push({ id: "unit-2", landlordId, propertyId: "property-2", unitNumber: "2", status: "occupied" }); records.tenants[0].status = "former";
    const first = aggregateOccupancyReviewWorkspace(landlordId, records).items.map((row) => row.id);
    const second = aggregateOccupancyReviewWorkspace(landlordId, { ...records, units: [...records.units].reverse() }).items.map((row) => row.id);
    expect(second).toEqual(first);
  });
});
