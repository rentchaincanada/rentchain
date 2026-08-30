import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, seed, read, list, reset, failAudit } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let rejectAudit = false;
  const collection = (name: string) => { if (!store.has(name)) store.set(name, new Map()); return store.get(name)!; };
  const doc = (name: string, id: string): any => ({ id, get: async () => { const value = collection(name).get(id); return { id, exists: value !== undefined, data: () => value, ref: doc(name, id) }; }, set: async (value: any, options?: any) => collection(name).set(id, options?.merge ? { ...(collection(name).get(id) || {}), ...value } : value), create: async (value: any) => { if (rejectAudit && value?.action === "stale_tenant_relationship_status_reconciled") throw new Error("audit_failed"); if (collection(name).has(id)) throw new Error("already_exists"); collection(name).set(id, value); } });
  const query = (name: string) => ({ get: async () => ({ docs: [...collection(name)].map(([id, value]) => ({ id, exists: true, data: () => value, ref: doc(name, id) })) }) });
  const fakeDb = { collection: (name: string) => ({ ...query(name), doc: (id: string) => doc(name, id) }), runTransaction: async (callback: any) => {
    const writes: Array<() => Promise<void>> = [];
    const result = await callback({ get: (target: any) => target.get(), set: (ref: any, value: any, options?: any) => writes.push(() => ref.set(value, options)), create: (ref: any, value: any) => writes.push(() => ref.create(value)) });
    const snapshot = new Map([...store].map(([name, values]) => [name, new Map([...values].map(([id, value]) => [id, structuredClone(value)]))]));
    try { for (const write of writes) await write(); } catch (error) { store.clear(); for (const [name, values] of snapshot) store.set(name, values); throw error; }
    return result;
  } };
  return { fakeDb, seed: (name: string, id: string, value: any) => collection(name).set(id, value), read: (name: string, id: string) => collection(name).get(id), list: (name: string) => [...collection(name).values()], reset: () => { store.clear(); rejectAudit = false; }, failAudit: () => { rejectAudit = true; } };
});

vi.mock("../../firebase", () => ({ db: fakeDb }));

import { classifyStaleTenantRelationship, getTenantRelationshipResolutionContext, resolveStaleTenantRelationshipStatus, type TenantRelationshipResolutionRecords } from "../tenantRelationshipStatusResolutionService";
import { leaseStartDeterministicId } from "../leaseStart/leaseStartExpectedState";
import type { CanonicalLeaseConflictReason } from "../../lib/leases/canonicalLeaseOccupancyState";

const landlordId = "landlord-1";
const tenantId = "tenant-1";
const baseRecords = (): TenantRelationshipResolutionRecords => ({
  tenant: { id: tenantId, landlordId, status: "current", currentLeaseId: null, updatedAt: "2026-08-29T00:00:00.000Z" },
  leases: [],
  tenancies: [{ id: "tenancy-1", landlordId, tenantId, propertyId: "property-1", unitId: "unit-1", status: "inactive", moveOutAt: "2026-08-01T00:00:00.000Z", moveOutReason: "LEASE_TERM_END" }],
  units: [{ id: "unit-1", landlordId, propertyId: "property-1", status: "vacant", occupancyStatus: "vacant", currentTenantId: null, currentLeaseId: null, tenantId: null, leaseId: null }],
  properties: [{ id: "property-1", landlordId, units: [{ id: "unit-1", status: "vacant", occupancyStatus: "vacant", currentTenantId: null, currentLeaseId: null, tenantId: null, leaseId: null }] }],
  canonicalEvents: [],
});
const classify = (mutate?: (records: TenantRelationshipResolutionRecords) => void) => { const records = baseRecords(); mutate?.(records); return classifyStaleTenantRelationship({ landlordId, tenantId, records }); };
const activeLease = (id = "lease-current", extra: Record<string, any> = {}) => ({ id, landlordId, tenantId, propertyId: "property-1", unitId: "unit-1", status: "active", startDate: "2026-01-01", endDate: "2027-01-01", executionStatus: "fully_executed", ...extra });

function seedSafe() {
  const records = baseRecords();
  seed("tenants", tenantId, records.tenant);
  records.tenancies.forEach((row) => seed("tenancies", row.id, row));
  records.units.forEach((row) => seed("units", row.id, row));
  records.properties.forEach((row) => seed("properties", row.id, row));
}

describe("status-only stale tenant relationship remediation", () => {
  beforeEach(reset);

  it("classifies the exact safe subtype and requires explicit evidence", () => {
    expect(classify()).toMatchObject({ eligible: true, resolutionAvailable: true, remediationSubtype: "status_only_stale_after_explicit_ended_occupancy", resolutionType: "reconcile_stale_tenant_relationship_status", diagnosticCategory: "status_only_reconciliation_available" });
    expect(classify((records) => { records.tenancies[0].moveOutAt = null; })).toMatchObject({ eligible: false, diagnosticCategory: "explicit_end_evidence_missing" });
  });

  it("rejects passive expiry and missing lease without explicit evidence", () => {
    expect(classify((records) => { records.tenancies = []; records.leases = [activeLease("lease-past", { endDate: "2025-01-01" })]; })).toMatchObject({ eligible: false });
    expect(classify((records) => { records.tenancies = []; })).toMatchObject({ eligible: false, diagnosticCategory: "explicit_end_evidence_missing" });
  });

  it("accepts a missing lease when independent explicit inactive-tenancy evidence is valid", () => {
    expect(classify()).toMatchObject({ eligible: true, supportingEvidence: [expect.objectContaining({ evidenceType: "explicit_inactive_tenancy", attributionStatus: "attributed" })] });
  });

  it("accepts a missing lease when an attributable canonical End Lease event is independently present", () => {
    const result = classify((records) => {
      records.tenancies = [];
      records.canonicalEvents = [{ id: "end-event", type: "lease.occupancy_ended", action: "occupancy_ended", status: "succeeded", occurredAt: "2026-08-01T00:00:00.000Z", appendOnly: true, immutable: true, metadata: { landlordRef: leaseStartDeterministicId("landlord", [landlordId]), tenantRef: leaseStartDeterministicId("tenant", [tenantId]), unitRef: leaseStartDeterministicId("unit", ["unit-1"]), effectiveDate: "2026-08-01T00:00:00.000Z" } }];
    });
    expect(result).toMatchObject({ eligible: true, supportingEvidence: [expect.objectContaining({ evidenceType: "canonical_end_lease" })] });
  });

  it.each([
    ["active tenancy", (r: TenantRelationshipResolutionRecords) => { r.tenancies[0].status = "active"; r.tenancies[0].moveOutAt = null; }, "active_tenancy_present"],
    ["occupied unit", (r: TenantRelationshipResolutionRecords) => { r.units[0].status = "occupied"; }, "active_occupancy_present"],
    ["stale unit linkage", (r: TenantRelationshipResolutionRecords) => { r.units[0].tenantId = tenantId; }, "unit_occupancy_linkage_present"],
    ["valid current lease", (r: TenantRelationshipResolutionRecords) => { r.leases = [activeLease()]; }, "current_lease_present"],
    ["upcoming lease", (r: TenantRelationshipResolutionRecords) => { r.leases = [activeLease("lease-upcoming", { startDate: "2099-01-01", endDate: "2100-01-01" })]; }, "upcoming_relationship_present"],
    ["multiple current leases", (r: TenantRelationshipResolutionRecords) => { r.leases = [activeLease("a"), activeLease("b")]; }, "multiple_current_ambiguity"],
    ["context mismatch", (r: TenantRelationshipResolutionRecords) => { r.leases = [activeLease("foreign", { landlordId: "landlord-2" })]; }, "current_lease_context_mismatch"],
    ["foreign tenancy", (r: TenantRelationshipResolutionRecords) => { r.tenancies[0].landlordId = "landlord-2"; }, "ownership_mismatch"],
    ["ambiguous ownership", (r: TenantRelationshipResolutionRecords) => { delete r.tenancies[0].landlordId; }, "ownership_ambiguous"],
    ["non-null tenant pointer", (r: TenantRelationshipResolutionRecords) => { r.tenant.currentLeaseId = "stale"; }, "tenant_current_lease_pointer_present"],
    ["inactive without moveOutAt", (r: TenantRelationshipResolutionRecords) => { r.tenancies[0].moveOutAt = null; }, "explicit_end_evidence_missing"],
    ["inactive without moveOutReason", (r: TenantRelationshipResolutionRecords) => { r.tenancies[0].moveOutReason = null; }, "explicit_end_evidence_missing"],
    ["ambiguous end contexts", (r: TenantRelationshipResolutionRecords) => { r.tenancies.push({ ...r.tenancies[0], id: "tenancy-2", propertyId: "property-2", unitId: "unit-2" }); }, "explicit_end_evidence_ambiguous"],
  ])("fails closed for %s", (_name, mutate, reason) => expect(classify(mutate)).toMatchObject({ eligible: false, diagnosticCategory: reason }));

  it("does not accept endedAt without canonical transaction evidence", () => {
    expect(classify((records) => { records.tenancies = []; records.leases = [activeLease("ended", { status: "ended", endedAt: "2026-08-01" })]; })).toMatchObject({ eligible: false, diagnosticCategory: "explicit_end_evidence_missing" });
  });

  it("rejects foreign and participant-ambiguous end evidence contexts", () => {
    const foreign = classify((records) => { records.tenancies[0].landlordId = "landlord-2"; });
    expect(foreign).toMatchObject({ eligible: false, diagnosticCategory: "ownership_mismatch" });
    const participants = classify((records) => { records.leases = [activeLease("lease-ended", { status: "ended", tenantIds: [tenantId, "tenant-2"], endedAt: "2026-08-01" })]; });
    expect(participants).toMatchObject({ eligible: false, diagnosticCategory: "participant_ambiguous" });
  });

  it("reconciles only tenant relationship fields, emits one audit, and projects Past without Archive", async () => {
    seedSafe();
    const beforeUnit = structuredClone(read("units", "unit-1"));
    const beforeTenancy = structuredClone(read("tenancies", "tenancy-1"));
    const context = await getTenantRelationshipResolutionContext({ landlordId, tenantId });
    const input = { landlordId, tenantId, actorId: landlordId, expectedStateToken: context.expectedStateToken, idempotencyKey: "status-only-1", confirmation: true };
    const result = await resolveStaleTenantRelationshipStatus(input);
    expect(result).toMatchObject({ outcome: "resolved", idempotent: false, context: { postRepairLifecycle: "Past" } });
    expect(read("tenants", tenantId)).toMatchObject({ status: "Past", currentLeaseId: null });
    expect(read("tenants", tenantId)).not.toHaveProperty("archivedAt");
    expect(read("units", "unit-1")).toEqual(beforeUnit);
    expect(read("tenancies", "tenancy-1")).toEqual(beforeTenancy);
    expect(list("canonicalEvents").filter((event: any) => event.action === "stale_tenant_relationship_status_reconciled")).toHaveLength(1);
    const retry = await resolveStaleTenantRelationshipStatus(input);
    expect(retry).toMatchObject({ idempotent: true, auditEventId: result.auditEventId });
    expect(list("canonicalEvents")).toHaveLength(1);
    await expect(resolveStaleTenantRelationshipStatus({ ...input, expectedStateToken: "different" })).rejects.toMatchObject({ code: "idempotency_key_reused", status: 409 });
  });

  it("rejects stale expected state without mutation or audit", async () => {
    seedSafe();
    const context = await getTenantRelationshipResolutionContext({ landlordId, tenantId });
    seed("tenants", tenantId, { ...read("tenants", tenantId), updatedAt: "changed" });
    await expect(resolveStaleTenantRelationshipStatus({ landlordId, tenantId, actorId: landlordId, expectedStateToken: context.expectedStateToken, idempotencyKey: "stale", confirmation: true })).rejects.toMatchObject({ code: "state_changed", status: 409 });
    expect(read("tenants", tenantId).status).toBe("current");
    expect(list("canonicalEvents")).toEqual([]);
  });

  it("rolls back tenant mutation when atomic audit creation fails", async () => {
    seedSafe();
    const context = await getTenantRelationshipResolutionContext({ landlordId, tenantId });
    failAudit();
    await expect(resolveStaleTenantRelationshipStatus({ landlordId, tenantId, actorId: landlordId, expectedStateToken: context.expectedStateToken, idempotencyKey: "audit-fail", confirmation: true })).rejects.toThrow("audit_failed");
    expect(read("tenants", tenantId).status).toBe("current");
  });

  it("returns deterministic already_resolved for a new key without audit", async () => {
    seedSafe(); seed("tenants", tenantId, { ...read("tenants", tenantId), status: "Past" });
    const result = await resolveStaleTenantRelationshipStatus({ landlordId, tenantId, actorId: landlordId, expectedStateToken: "old-token", idempotencyKey: "already", confirmation: true });
    expect(result).toMatchObject({ outcome: "already_resolved", auditEventId: null });
    expect(list("canonicalEvents")).toEqual([]);
  });

  it("preserves the canonical 12-reason catalog", () => {
    const reasons: CanonicalLeaseConflictReason[] = ["MULTIPLE_CURRENT_LEASES", "INVALID_LEASE_DATE_RANGE", "CURRENT_LEASE_CONTEXT_MISMATCH", "DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY", "UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY", "PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY", "ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY", "LEASE_EXECUTION_INCOMPLETE", "OCCUPIED_WITHOUT_CURRENT_LEASE", "VACANT_WITH_CURRENT_LEASE", "STALE_CURRENT_LEASE_POINTER", "TENANT_CURRENT_WITHOUT_CURRENT_LEASE"];
    expect(new Set(reasons).size).toBe(12);
  });
});
