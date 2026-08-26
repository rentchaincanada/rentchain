import { describe, expect, it } from "vitest";
import { buildCanonicalLeaseOccupancyProjection } from "../../leases/canonicalLeaseOccupancyProjection";
import { deriveTenantWorkspaceLifecycle } from "../deriveTenantWorkspaceLifecycle";

const context = { landlordId: "landlord-1", tenantId: "tenant-1", asOfDate: "2026-08-26" };

function project(leases: any[], persisted: any = {}) {
  const canonicalState = buildCanonicalLeaseOccupancyProjection({
    leases,
    context,
    tenantId: "tenant-1",
    ...persisted,
  });
  return deriveTenantWorkspaceLifecycle({ canonicalState, leases, asOfDate: context.asOfDate, archivedAt: persisted.archivedAt });
}

describe("deriveTenantWorkspaceLifecycle", () => {
  it("classifies explicit current occupancy as Current", () => {
    const result = project([
      { id: "lease-current", landlordId: "landlord-1", tenantId: "tenant-1", status: "active", executionStatus: "fully_executed", startDate: "2026-01-01", endDate: "2026-12-31" },
    ], { persistedUnitOccupancy: "occupied", currentLeasePointerId: "lease-current", persistedTenantStatus: "current" });
    expect(result).toMatchObject({ category: "current", hasCanonicalCurrentLease: true, archiveEligibility: { allowed: false, reason: "current_relationship" } });
  });

  it("gives Upcoming precedence over past history without creating current occupancy", () => {
    const result = project([
      { id: "lease-past", landlordId: "landlord-1", tenantId: "tenant-1", status: "ended", endedAt: "2026-06-01T00:00:00.000Z" },
      { id: "lease-upcoming", landlordId: "landlord-1", tenantId: "tenant-1", status: "signed", executionStatus: "fully_executed", startDate: "2026-10-01", endDate: "2027-09-30" },
    ], { persistedUnitOccupancy: "vacant", persistedTenantStatus: "past" });
    expect(result).toMatchObject({ category: "upcoming", hasCanonicalCurrentLease: false, hasUpcomingLease: true, archiveEligibility: { allowed: false, reason: "upcoming_relationship" } });
    expect(result.actualEndDate).toBe("2026-06-01T00:00:00.000Z");
  });

  it("keeps ended tenants Past and archive-eligible without an unresolved conflict", () => {
    const result = project([
      { id: "lease-ended", landlordId: "landlord-1", tenantId: "tenant-1", status: "ended", endedAt: "2026-08-20T12:00:00.000Z", endDate: "2026-12-31" },
    ], { persistedUnitOccupancy: "vacant", persistedTenantStatus: "past" });
    expect(result).toMatchObject({ category: "past", actualEndDate: "2026-08-20T12:00:00.000Z", archiveEligibility: { allowed: true, reason: null } });
  });

  it("uses the archive overlay without changing canonical relationship facts", () => {
    const result = project([], { archivedAt: "2026-08-25T00:00:00.000Z", persistedUnitOccupancy: "vacant", persistedTenantStatus: "past" });
    expect(result).toMatchObject({ category: "archived", isArchived: true, hasCanonicalCurrentLease: false, archiveEligibility: { allowed: false, reason: "already_archived" } });
  });

  it("rejects archive for unresolved canonical occupancy conflicts", () => {
    const leases = [
      { id: "lease-a", landlordId: "landlord-1", tenantId: "tenant-1", status: "active", executionStatus: "fully_executed", startDate: "2026-01-01", endDate: "2026-12-31" },
      { id: "lease-b", landlordId: "landlord-1", tenantId: "tenant-1", status: "active", executionStatus: "fully_executed", startDate: "2026-02-01", endDate: "2027-01-31" },
    ];
    const result = project(leases, { persistedUnitOccupancy: "occupied", persistedTenantStatus: "current" });
    expect(result).toMatchObject({ hasUnresolvedOccupancyConflict: true, archiveEligibility: { allowed: false, reason: "occupancy_conflict" } });
  });
});
