import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, seed, read, list, failAudit, reset } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let rejectAudit = false;
  let transactionTail = Promise.resolve();
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
      const execute = async () => {
      const writes: Array<() => Promise<void>> = [];
      const result = await callback({
        get: (target: any) => target.get(),
        set: (ref: any, value: any, options?: any) => writes.push(() => ref.set(value, options)),
        create: (ref: any, value: any) => writes.push(() => {
          if (rejectAudit && ["occupancy_resolution_recorded", "multiple_current_resolved"].includes(String(value?.action))) throw new Error("audit_failed");
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
      };
      const result = transactionTail.then(execute);
      transactionTail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  return {
    fakeDb,
    seed: (name: string, id: string, value: any) => collection(name).set(id, value),
    read: (name: string, id: string) => collection(name).get(id),
    list: (name: string) => [...collection(name).values()],
    failAudit: (value: boolean) => { rejectAudit = value; },
    reset: () => { store.clear(); rejectAudit = false; transactionTail = Promise.resolve(); },
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

function seedMultipleCurrent() {
  seed("properties", "property-1", { landlordId: "landlord-1", name: "Harbour House", units: [{ id: "unit-1", unitNumber: "1A", status: "occupied", occupancyStatus: "occupied", currentLeaseId: "lease-a", currentTenantId: "tenant-1" }] });
  seed("units", "unit-1", { landlordId: "landlord-1", propertyId: "property-1", unitNumber: "1A", status: "occupied", occupancyStatus: "occupied", currentLeaseId: "lease-a", currentTenantId: "tenant-1" });
  seed("tenants", "tenant-1", { landlordId: "landlord-1", name: "Tenant One", status: "Current", currentLeaseId: "lease-a" });
  seed("tenants", "tenant-2", { landlordId: "landlord-1", name: "Tenant Two", status: "Current", currentLeaseId: "lease-b" });
  seed("leases", "lease-a", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", tenantIds: ["tenant-1"], status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-01-01", endDate: "2027-01-01" });
  seed("leases", "lease-b", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-2", tenantIds: ["tenant-2"], status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-02-01", endDate: "2027-02-01" });
  seed("tenancies", "tenancy-a", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "lease-a", status: "active" });
  seed("tenancies", "tenancy-b", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-2", leaseId: "lease-b", status: "active" });
  seed("tenancies", "unrelated", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-2", tenantId: "tenant-3", leaseId: "lease-other", status: "active" });
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

  it("preserves stale occupied-without-lease recovery for a requested tenant", async () => {
    seed("properties", "property-1", { landlordId: "landlord-1", name: "Harbour House", units: [{ id: "unit-1", unitNumber: "1A", status: "occupied", currentTenantId: "tenant-1" }] });
    seed("units", "unit-1", { landlordId: "landlord-1", propertyId: "property-1", unitNumber: "1A", status: "occupied", currentTenantId: "tenant-1" });
    seed("tenants", "tenant-1", { landlordId: "landlord-1", status: "Current", currentLeaseId: null });
    const context = await getOccupancyResolutionContext(base);
    expect(context.canonicalState.reasons).toContain("OCCUPIED_WITHOUT_CURRENT_LEASE");
    expect(context.eligibleResolutionTypes).toEqual(expect.arrayContaining(["record_operational_move_out", "clear_stale_occupancy_record"]));
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
    expect(context.eligibleResolutionTypes).toEqual(["resolve_multiple_current_leases"]);
    await expect(getOccupancyResolutionContext({ ...base, landlordId: "landlord-2" })).rejects.toMatchObject({ code: "forbidden" });
  });

  it.each(["lease-a", "lease-b"])("preserves the selected lease's pre-existing active tenancy when resolving %s", async (selectedLeaseId) => {
    seedMultipleCurrent();
    const context = await getOccupancyResolutionContext({ ...base, tenantId: null });
    expect(context.canonicalState).toMatchObject({ occupancyState: "review_needed", supportingLeaseId: null });
    expect(context.existingLeaseCandidates.map((lease) => lease.id).sort()).toEqual(["lease-a", "lease-b"]);
    const beforeA = structuredClone(read("leases", "lease-a"));
    const beforeB = structuredClone(read("leases", "lease-b"));
    const result = await resolveOccupancy({ ...base, tenantId: null, actorId: "landlord-1", type: "resolve_multiple_current_leases", selectedLeaseId, expectedStateToken: context.expectedStateToken, idempotencyKey: `resolve-${selectedLeaseId}`, confirmation: true });
    const excludedLeaseId = selectedLeaseId === "lease-a" ? "lease-b" : "lease-a";
    expect(result.context.canonicalState).toMatchObject({ occupancyState: "occupied", supportingLeaseId: selectedLeaseId });
    expect(result.context.canonicalState.reasons).not.toContain("MULTIPLE_CURRENT_LEASES");
    expect(read("leases", selectedLeaseId)).toMatchObject({ status: "active", executionStatus: "fully_executed", occupancyEffective: true });
    expect(read("leases", excludedLeaseId)).toMatchObject({ status: "active", executionStatus: "fully_executed", occupancyEffective: false, occupancyDisposition: { status: "excluded_from_current_occupancy_by_resolution", reason: "multiple_current_resolution", selectedLeaseId } });
    expect(read("leases", "lease-a")).toMatchObject({ startDate: beforeA.startDate, endDate: beforeA.endDate });
    expect(read("leases", "lease-b")).toMatchObject({ startDate: beforeB.startDate, endDate: beforeB.endDate });
    expect(read("units", "unit-1")).toMatchObject({ occupancyStatus: "occupied", currentLeaseId: selectedLeaseId });
    expect(read("tenancies", selectedLeaseId === "lease-a" ? "tenancy-a" : "tenancy-b")).toMatchObject({ status: "active", leaseId: selectedLeaseId });
    expect(read("tenancies", selectedLeaseId === "lease-a" ? "tenancy-b" : "tenancy-a")).toMatchObject({ status: "inactive", moveOutReason: "OCCUPANCY_RECONCILIATION" });
    expect(read("tenancies", "unrelated")).toMatchObject({ status: "active", leaseId: "lease-other" });
    expect(read("canonicalEvents", result.auditEventId)).toMatchObject({ action: "multiple_current_resolved", metadata: { legalDetermination: false, contractualLeaseStatusChanged: false } });
  });

  it("does not mutate an unrelated active tenancy loaded for the same unit", async () => {
    seedMultipleCurrent();
    seed("tenancies", "same-unit-unrelated", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-unrelated", leaseId: "lease-unrelated", status: "active", createdAt: "2026-01-01T00:00:00.000Z" });
    const unrelatedBefore = structuredClone(read("tenancies", "same-unit-unrelated"));
    const context = await getOccupancyResolutionContext({ ...base, tenantId: null });
    await resolveOccupancy({ ...base, tenantId: null, actorId: "landlord-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-a", expectedStateToken: context.expectedStateToken, idempotencyKey: "same-unit-unrelated", confirmation: true });
    expect(read("tenancies", "same-unit-unrelated")).toEqual(unrelatedBefore);
  });

  it("evaluates the multiple-current postcondition from the final planned tenancy state", async () => {
    seedMultipleCurrent();
    const context = await getOccupancyResolutionContext({ ...base, tenantId: null });
    const result = await resolveOccupancy({ ...base, tenantId: null, actorId: "landlord-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-a", expectedStateToken: context.expectedStateToken, idempotencyKey: "planned-tenancy-postcondition", confirmation: true });
    expect(read("tenancies", "tenancy-a")).toMatchObject({ status: "active", leaseId: "lease-a" });
    expect(read("tenancies", "tenancy-b")).toMatchObject({ status: "inactive", leaseId: "lease-b" });
    expect(result.context.canonicalState).toMatchObject({ occupancyState: "occupied", supportingLeaseId: "lease-a" });
  });

  it("supports a non-primary selected participant pointer and clears excluded-only pointers", async () => {
    seedMultipleCurrent();
    seed("tenants", "tenant-3", { landlordId: "landlord-1", name: "Tenant Three", status: "Current", currentLeaseId: "lease-a" });
    seed("leases", "lease-a", { ...read("leases", "lease-a"), primaryTenantId: "tenant-1", tenantIds: ["tenant-1", "tenant-3"] });
    seed("units", "unit-1", { ...read("units", "unit-1"), tenantId: "tenant-3", currentTenantId: "tenant-3" });
    seed("properties", "property-1", { ...read("properties", "property-1"), units: [{ ...read("properties", "property-1").units[0], tenantId: "tenant-3", currentTenantId: "tenant-3" }] });
    const context = await getOccupancyResolutionContext({ ...base, tenantId: "tenant-3" });
    const result = await resolveOccupancy({ ...base, tenantId: "tenant-3", actorId: "landlord-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-a", expectedStateToken: context.expectedStateToken, idempotencyKey: "non-primary", confirmation: true });
    expect(result.context.tenantId).toBe("tenant-3");
    expect(read("units", "unit-1")).toMatchObject({ currentTenantId: "tenant-3", currentLeaseId: "lease-a" });
    expect(read("tenants", "tenant-3")).toMatchObject({ currentLeaseId: "lease-a" });
    expect(read("tenants", "tenant-2")).toMatchObject({ currentLeaseId: null });
  });

  it("can explicitly select the other conflicting tenant from a tenant-scoped entry point", async () => {
    seedMultipleCurrent();
    const context = await getOccupancyResolutionContext(base);
    const result = await resolveOccupancy({ ...base, actorId: "landlord-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-b", expectedStateToken: context.expectedStateToken, idempotencyKey: "select-other-tenant", confirmation: true });
    expect(result.context).toMatchObject({ tenantId: "tenant-2", canonicalState: { occupancyState: "occupied", supportingLeaseId: "lease-b", tenantRelationshipState: "current_occupant" } });
    expect(read("tenants", "tenant-1")).toMatchObject({ currentLeaseId: null });
    expect(read("tenants", "tenant-2")).toMatchObject({ currentLeaseId: "lease-b" });
  });

  it("deactivates only active tenancies belonging to non-selected conflicting leases", async () => {
    seedMultipleCurrent();
    seed("tenants", "tenant-3", { landlordId: "landlord-1", name: "Tenant Three", status: "Current", currentLeaseId: "lease-c" });
    seed("leases", "lease-c", { ...read("leases", "lease-b"), tenantId: "tenant-3", tenantIds: ["tenant-3"] });
    seed("tenancies", "same-unit-unrelated", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-unrelated", leaseId: "lease-unrelated", status: "active" });
    const unrelatedBefore = structuredClone(read("tenancies", "same-unit-unrelated"));
    const context = await getOccupancyResolutionContext({ ...base, tenantId: null });
    expect(context.existingLeaseCandidates).toHaveLength(3);
    const result = await resolveOccupancy({ ...base, tenantId: null, actorId: "landlord-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-c", expectedStateToken: context.expectedStateToken, idempotencyKey: "three-candidates", confirmation: true });
    expect(result.context.canonicalState).toMatchObject({ occupancyState: "occupied", supportingLeaseId: "lease-c" });
    expect(read("leases", "lease-a")).toMatchObject({ occupancyEffective: false, occupancyDisposition: { selectedLeaseId: "lease-c" } });
    expect(read("leases", "lease-b")).toMatchObject({ occupancyEffective: false, occupancyDisposition: { selectedLeaseId: "lease-c" } });
    expect(read("tenancies", "tenancy-a")).toMatchObject({ status: "inactive", moveOutReason: "OCCUPANCY_RECONCILIATION" });
    expect(read("tenancies", "tenancy-b")).toMatchObject({ status: "inactive", moveOutReason: "OCCUPANCY_RECONCILIATION" });
    expect(list("tenancies").filter((tenancy: any) => tenancy.status === "active" && tenancy.leaseId === "lease-c")).toHaveLength(1);
    expect(read("tenancies", "same-unit-unrelated")).toEqual(unrelatedBefore);
  });

  it("allows only one winner for concurrent different selections", async () => {
    seedMultipleCurrent();
    const context = await getOccupancyResolutionContext({ ...base, tenantId: null });
    const common = { ...base, tenantId: null, actorId: "landlord-1", type: "resolve_multiple_current_leases" as const, expectedStateToken: context.expectedStateToken, confirmation: true };
    const outcomes = await Promise.allSettled([
      resolveOccupancy({ ...common, selectedLeaseId: "lease-a", idempotencyKey: "concurrent-a" }),
      resolveOccupancy({ ...common, selectedLeaseId: "lease-b", idempotencyKey: "concurrent-b" }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "occupancy_state_stale" });
    expect(list("canonicalEvents")).toHaveLength(1);
  });

  it("allows only one authoritative commit for concurrent same-lease selections", async () => {
    seedMultipleCurrent();
    const context = await getOccupancyResolutionContext({ ...base, tenantId: null });
    const common = { ...base, tenantId: null, actorId: "landlord-1", type: "resolve_multiple_current_leases" as const, selectedLeaseId: "lease-a", expectedStateToken: context.expectedStateToken, confirmation: true };
    const outcomes = await Promise.allSettled([
      resolveOccupancy({ ...common, idempotencyKey: "concurrent-same-a" }),
      resolveOccupancy({ ...common, idempotencyKey: "concurrent-same-b" }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(list("canonicalEvents")).toHaveLength(1);
  });

  it("rolls back the complete multiple-current recovery when the canonical event cannot append", async () => {
    seedMultipleCurrent();
    const context = await getOccupancyResolutionContext({ ...base, tenantId: null });
    failAudit(true);
    await expect(resolveOccupancy({ ...base, tenantId: null, actorId: "landlord-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-a", expectedStateToken: context.expectedStateToken, idempotencyKey: "multiple-audit-fail", confirmation: true })).rejects.toThrow("audit_failed");
    expect(read("leases", "lease-b")).not.toHaveProperty("occupancyDisposition");
    expect(read("units", "unit-1")).toMatchObject({ currentLeaseId: "lease-a", currentTenantId: "tenant-1" });
    expect(read("tenancies", "tenancy-b")).toMatchObject({ status: "active" });
    expect(list("occupancyResolutionRequests")).toEqual([]);
  });

  it("replays the same recovery safely and rejects changed selection or stale state", async () => {
    seedMultipleCurrent();
    const context = await getOccupancyResolutionContext({ ...base, tenantId: null });
    const input = { ...base, tenantId: null, actorId: "landlord-1", type: "resolve_multiple_current_leases" as const, selectedLeaseId: "lease-a", expectedStateToken: context.expectedStateToken, idempotencyKey: "replay-resolution", confirmation: true };
    const first = await resolveOccupancy(input);
    expect((await resolveOccupancy(input))).toMatchObject({ idempotent: true, auditEventId: first.auditEventId });
    await expect(resolveOccupancy({ ...input, selectedLeaseId: "lease-b" })).rejects.toMatchObject({ code: "idempotency_key_reused" });
    const fresh = await getOccupancyResolutionContext({ ...base, tenantId: null });
    await expect(resolveOccupancy({ ...input, idempotencyKey: "stale-resolution", expectedStateToken: context.expectedStateToken })).rejects.toMatchObject({ code: "occupancy_state_stale", freshContext: fresh });
  });

  it("rejects foreign projection pointers with zero writes", async () => {
    seedMultipleCurrent();
    seed("units", "unit-1", { ...read("units", "unit-1"), currentTenantId: "foreign-tenant" });
    const context = await getOccupancyResolutionContext({ ...base, tenantId: null });
    await expect(resolveOccupancy({ ...base, tenantId: null, actorId: "landlord-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-a", expectedStateToken: context.expectedStateToken, idempotencyKey: "foreign-pointer", confirmation: true })).rejects.toMatchObject({ code: "occupancy_projection_context_ambiguous" });
    expect(read("leases", "lease-b")).not.toHaveProperty("occupancyDisposition");
    expect(list("canonicalEvents")).toEqual([]);
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
