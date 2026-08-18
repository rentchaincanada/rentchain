import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, seed, read, list, failAudit, reset } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let rejectAudit = false;
  const collection = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  const doc = (name: string, id: string) => ({
    id,
    get: async () => { const value = collection(name).get(id); return { id, exists: Boolean(value), data: () => value, ref: doc(name, id) }; },
    set: async (value: any, options?: any) => collection(name).set(id, options?.merge ? { ...(collection(name).get(id) || {}), ...value } : value),
    create: async (value: any) => { if (collection(name).has(id)) throw new Error("already_exists"); collection(name).set(id, value); },
  });
  const query = (name: string, filters: any[] = []) => ({
    where: (field: string, op: string, value: any) => query(name, [...filters, { field, op, value }]),
    get: async () => ({ docs: [...collection(name).entries()].filter(([, value]) => filters.every((filter) => filter.op === "==" && value[filter.field] === filter.value)).map(([id, value]) => ({ id, exists: true, data: () => value, ref: doc(name, id) })) }),
  });
  const fakeDb = {
    collection: (name: string) => ({ ...query(name), doc: (id: string) => doc(name, id) }),
    runTransaction: async (callback: any) => {
      const writes: Array<() => Promise<void>> = [];
      const result = await callback({
        get: (target: any) => target.get(),
        set: (ref: any, value: any, options?: any) => writes.push(() => ref.set(value, options)),
        create: (ref: any, value: any) => writes.push(() => {
          if (rejectAudit && String(value?.action) === "occupancy_resolution_recorded") throw new Error("audit_failed");
          return ref.create(value);
        }),
      });
      const snapshot = new Map([...store.entries()].map(([name, values]) => [name, new Map([...values.entries()].map(([id, value]) => [id, structuredClone(value)]))]));
      try {
        for (const write of writes) await write();
      } catch (error) {
        store.clear();
        for (const [name, values] of snapshot) store.set(name, values);
        throw error;
      }
      return result;
    },
  };
  return {
    fakeDb,
    seed: (name: string, id: string, value: any) => collection(name).set(id, value),
    read: (name: string, id: string) => collection(name).get(id),
    list: (name: string) => [...collection(name).values()],
    failAudit: (value: boolean) => { rejectAudit = value; },
    reset: () => { store.clear(); rejectAudit = false; },
  };
});

vi.mock("../../firebase", () => ({ db: fakeDb }));

import { getOccupancyResolutionContext, resolveOccupancy } from "../occupancyResolutionService";

const base = { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1" };

function seedExpiredReview() {
  seed("properties", "property-1", { landlordId: "landlord-1", name: "Harbour House", units: [{ id: "unit-1", unitNumber: "1A", status: "occupied", occupancyStatus: "occupied", currentLeaseId: "lease-past", currentTenantId: "tenant-1" }] });
  seed("units", "unit-1", { landlordId: "landlord-1", propertyId: "property-1", unitNumber: "1A", status: "occupied", occupancyStatus: "occupied", currentLeaseId: "lease-past", currentTenantId: "tenant-1" });
  seed("tenants", "tenant-1", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", status: "Current", currentLeaseId: "lease-past" });
  seed("tenancies", "tenancy-1", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "active" });
  seed("leases", "lease-past", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "active", executionStatus: "fully_executed", startDate: "2025-05-01", endDate: "2026-04-30" });
}

describe("occupancyResolutionService", () => {
  beforeEach(() => reset());

  it("keeps passive expiry unresolved until an explicit move-out is committed atomically", async () => {
    seedExpiredReview();
    const context = await getOccupancyResolutionContext(base);
    expect(context.canonicalState).toMatchObject({ leaseTermState: "past", occupancyState: "review_needed", tenantRelationshipState: "occupancy_unresolved", supportingLeaseId: null });
    const result = await resolveOccupancy({ ...base, actorId: "landlord-1", type: "record_operational_move_out", expectedStateToken: context.expectedStateToken, idempotencyKey: "move-out-1", confirmation: true, effectiveDate: "2026-08-18" });
    expect(result.context.canonicalState).toMatchObject({ occupancyState: "vacant", tenantRelationshipState: "past_tenant" });
    expect(read("leases", "lease-past")).toMatchObject({ status: "active", endDate: "2026-04-30" });
    expect(read("units", "unit-1")).toMatchObject({ occupancyStatus: "vacant", currentLeaseId: null, currentTenantId: null });
    expect(read("tenants", "tenant-1")).toMatchObject({ status: "Past", currentLeaseId: null });
    expect(read("tenancies", "tenancy-1")).toMatchObject({ status: "inactive", moveOutReason: "OTHER" });
    expect(read("canonicalEvents", result.auditEventId)).toMatchObject({ action: "occupancy_resolution_recorded", immutable: true });
  });

  it("returns the committed result for an identical idempotent retry and rejects changed payload", async () => {
    seedExpiredReview();
    const context = await getOccupancyResolutionContext(base);
    const input = { ...base, actorId: "landlord-1", type: "clear_stale_occupancy_record" as const, expectedStateToken: context.expectedStateToken, idempotencyKey: "retry-1", confirmation: true };
    const first = await resolveOccupancy(input);
    const second = await resolveOccupancy(input);
    expect(second.idempotent).toBe(true);
    expect(second.auditEventId).toBe(first.auditEventId);
    await expect(resolveOccupancy({ ...input, type: "record_operational_move_out", effectiveDate: "2026-08-18" })).rejects.toMatchObject({ code: "idempotency_key_reused" });
  });

  it("rolls back operational writes when immutable audit creation fails", async () => {
    seedExpiredReview();
    const context = await getOccupancyResolutionContext(base);
    failAudit(true);
    await expect(resolveOccupancy({ ...base, actorId: "landlord-1", type: "clear_stale_occupancy_record", expectedStateToken: context.expectedStateToken, idempotencyKey: "audit-fail", confirmation: true })).rejects.toThrow("audit_failed");
    expect(read("units", "unit-1")).toMatchObject({ occupancyStatus: "occupied", currentLeaseId: "lease-past" });
    expect(read("occupancyResolutionRequests", "6f04eb5f")).toBeUndefined();
  });

  it("fails closed for multiple current leases and cross-landlord context", async () => {
    seedExpiredReview();
    seed("leases", "lease-active-1", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "active", executionStatus: "fully_executed", startDate: "2026-05-01", endDate: "2027-04-30" });
    seed("leases", "lease-active-2", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "active", executionStatus: "fully_executed", startDate: "2026-05-01", endDate: "2027-04-30" });
    const context = await getOccupancyResolutionContext(base);
    expect(context.canonicalState.reasons).toContain("MULTIPLE_CURRENT_LEASES");
    expect(context.eligibleResolutionTypes).toEqual([]);
    await expect(getOccupancyResolutionContext({ ...base, landlordId: "landlord-2" })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("links one explicitly selected eligible lease and rejects a stale token", async () => {
    seedExpiredReview();
    seed("leases", "lease-current", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "active", executionStatus: "fully_executed", startDate: "2026-05-01", endDate: "2027-04-30" });
    const context = await getOccupancyResolutionContext(base);
    expect(context.eligibleResolutionTypes).toContain("link_existing_lease");
    seed("units", "unit-1", { ...read("units", "unit-1"), notes: "concurrent change" });
    await expect(resolveOccupancy({ ...base, actorId: "landlord-1", type: "link_existing_lease", selectedLeaseId: "lease-current", expectedStateToken: context.expectedStateToken, idempotencyKey: "link-stale", confirmation: true })).rejects.toMatchObject({ code: "occupancy_state_stale" });

    const fresh = await getOccupancyResolutionContext(base);
    const result = await resolveOccupancy({ ...base, actorId: "landlord-1", type: "link_existing_lease", selectedLeaseId: "lease-current", expectedStateToken: fresh.expectedStateToken, idempotencyKey: "link-current", confirmation: true });
    expect(result.context.canonicalState).toMatchObject({ occupancyState: "occupied", tenantRelationshipState: "current_occupant", supportingLeaseId: "lease-current" });
    expect(read("units", "unit-1")).toMatchObject({ occupancyStatus: "occupied", currentLeaseId: "lease-current" });
    expect(read("properties", "property-1").units[0]).toMatchObject({ occupancyStatus: "occupied", currentTenantId: "tenant-1", currentLeaseId: "lease-current" });
    expect(read("tenants", "tenant-1")).toMatchObject({ status: "Current", currentLeaseId: "lease-current" });
    expect(read("tenancies", "tenancy-1")).toMatchObject({ status: "active" });
    expect(read("leases", "lease-current")).toMatchObject({ status: "active", executionStatus: "fully_executed", startDate: "2026-05-01", endDate: "2027-04-30" });
  });

  it("rejects a draft link candidate with zero operational or audit writes", async () => {
    seedExpiredReview();
    seed("leases", "lease-draft", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "draft", executionStatus: "draft", startDate: "2026-05-01", endDate: "2027-04-30" });
    const context = await getOccupancyResolutionContext(base);
    expect(context.existingLeaseCandidates.map((lease) => lease.id)).not.toContain("lease-draft");

    await expect(resolveOccupancy({ ...base, actorId: "landlord-1", type: "link_existing_lease", selectedLeaseId: "lease-draft", expectedStateToken: context.expectedStateToken, idempotencyKey: "draft-link", confirmation: true })).rejects.toMatchObject({ code: "resolution_not_applicable" });

    expect(read("units", "unit-1")).toMatchObject({ occupancyStatus: "occupied", currentLeaseId: "lease-past" });
    expect(list("canonicalEvents")).toEqual([]);
    expect(list("occupancyResolutionRequests")).toEqual([]);
  });
});
