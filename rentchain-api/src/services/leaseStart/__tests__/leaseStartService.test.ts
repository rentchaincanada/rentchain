import { beforeEach, describe, expect, it } from "vitest";
import {
  getCanonicalLeaseStartContext,
  LeaseStartServiceError,
  startCanonicalLeaseOccupancy,
  type StartCanonicalLeaseOccupancyInput,
} from "../leaseStartService";

function createFakeFirestore() {
  const store = new Map<string, Map<string, any>>();
  let queue = Promise.resolve();
  let failCollection: string | null = null;
  let retryNext = false;
  const collectionData = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  const ref = (name: string, id: string): any => ({
    collectionName: name,
    id,
    get: async () => {
      const value = collectionData(name).get(id);
      return { id, exists: value !== undefined, data: () => value, ref: ref(name, id) };
    },
    set: async (value: any, options?: any) => {
      const prior = collectionData(name).get(id);
      collectionData(name).set(id, options?.merge ? { ...(prior || {}), ...structuredClone(value) } : structuredClone(value));
    },
    create: async (value: any) => {
      if (collectionData(name).has(id)) throw new Error("already_exists");
      collectionData(name).set(id, structuredClone(value));
    },
  });
  const query = (name: string, filters: any[] = []): any => ({
    collectionName: name,
    filters,
    where: (field: string, op: string, value: any) => query(name, [...filters, { field, op, value }]),
    get: async () => ({
      docs: [...collectionData(name).entries()]
        .filter(([, value]) => filters.every((filter) => filter.op === "==" && value[filter.field] === filter.value))
        .map(([id, value]) => ({ id, exists: true, data: () => value, ref: ref(name, id) })),
    }),
  });
  const transactionAttempt = async (callback: any, apply: boolean) => {
    const writes: Array<{ kind: "set" | "create"; target: any; value: any; options?: any }> = [];
    const result = await callback({
      get: (target: any) => target.get(),
      set: (target: any, value: any, options?: any) => writes.push({ kind: "set", target, value, options }),
      create: (target: any, value: any) => writes.push({ kind: "create", target, value }),
    });
    if (!apply) return result;
    const snapshot = structuredClone([...store.entries()].map(([name, values]) => [name, [...values.entries()]]));
    try {
      for (const write of writes) {
        if (write.target.collectionName === failCollection) throw new Error("forced_transaction_failure");
        if (write.kind === "create") await write.target.create(write.value);
        else await write.target.set(write.value, write.options);
      }
    } catch (error) {
      store.clear();
      for (const [name, entries] of snapshot) store.set(name, new Map(entries));
      throw error;
    }
    return result;
  };
  const firestore: any = {
    collection: (name: string) => ({ ...query(name), doc: (id: string) => ref(name, id) }),
    runTransaction: (callback: any) => {
      const run = queue.then(async () => {
        if (retryNext) {
          retryNext = false;
          await transactionAttempt(callback, false);
        }
        return transactionAttempt(callback, true);
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
  return {
    firestore,
    seed: (name: string, id: string, value: any) => collectionData(name).set(id, structuredClone(value)),
    read: (name: string, id: string) => structuredClone(collectionData(name).get(id)),
    list: (name: string) => [...collectionData(name).values()].map((value) => structuredClone(value)),
    ids: (name: string) => [...collectionData(name).keys()],
    failWritesTo: (name: string | null) => { failCollection = name; },
    retryNextTransaction: () => { retryNext = true; },
  };
}

const evaluationInstant = "2026-05-01T12:00:00.000Z";
const base = { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "lease-1", evaluationInstant };
let fake: ReturnType<typeof createFakeFirestore>;

function seedBase(overrides: { lease?: any; unit?: any; embedded?: any; tenant?: any } = {}) {
  const embedded = {
    id: "unit-1", unitNumber: "1A", status: "vacant", occupancyStatus: "vacant", updatedAt: "2026-04-30T12:00:00.000Z",
    ...(overrides.embedded || {}),
  };
  fake.seed("properties", "property-1", { landlordId: "landlord-1", name: "Harbour House", units: [embedded], updatedAt: "2026-04-30T12:00:00.000Z" });
  fake.seed("units", "unit-1", {
    landlordId: "landlord-1", propertyId: "property-1", unitNumber: "1A", status: "vacant", occupancyStatus: "vacant",
    updatedAt: "2026-04-30T12:00:00.000Z", ...(overrides.unit || {}),
  });
  fake.seed("tenants", "tenant-1", { landlordId: "landlord-1", status: "past", updatedAt: "2026-04-30T12:00:00.000Z", ...(overrides.tenant || {}) });
  fake.seed("leases", "lease-1", {
    landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1",
    status: "active", executionStatus: "fully_executed", startDate: "2026-01-01", endDate: "2026-12-31",
    updatedAt: "2026-04-30T12:00:00.000Z", ...(overrides.lease || {}),
  });
}

async function mutationInput(overrides: Partial<StartCanonicalLeaseOccupancyInput> = {}): Promise<StartCanonicalLeaseOccupancyInput> {
  const context = await getCanonicalLeaseStartContext({ ...base, firestore: fake.firestore });
  return {
    ...base,
    operationKind: "explicit_start",
    trigger: "explicit_start",
    idempotencyKey: "request-1",
    expectedStateToken: context.expectedStateToken,
    actorId: "landlord-1",
    source: "test",
    firestore: fake.firestore,
    ...overrides,
  };
}

function domainSnapshot() {
  return {
    lease: fake.read("leases", "lease-1"),
    property: fake.read("properties", "property-1"),
    unit: fake.read("units", "unit-1"),
    tenant: fake.read("tenants", "tenant-1"),
    tenancies: fake.list("tenancies"),
    events: fake.list("canonicalEvents"),
  };
}

describe("leaseStartService", () => {
  beforeEach(() => {
    fake = createFakeFirestore();
    seedBase();
  });

  it("starts an existing fully executed current lease as one atomic postcondition", async () => {
    const result = await startCanonicalLeaseOccupancy(await mutationInput());
    expect(result).toMatchObject({ outcome: "occupancy_effective", canonicalOutcome: "occupancy_effective", occupancyEffective: true });
    expect(fake.read("leases", "lease-1")).toMatchObject({ occupancyEffective: true, occupancyEffectiveAt: evaluationInstant });
    expect(fake.read("units", "unit-1")).toMatchObject({ status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1", currentTenantId: "tenant-1", leaseId: "lease-1", currentLeaseId: "lease-1", occupancyUpdatedAt: evaluationInstant });
    expect(fake.read("properties", "property-1").units[0]).toMatchObject({ status: "occupied", currentTenantId: "tenant-1", currentLeaseId: "lease-1" });
    expect(fake.read("tenants", "tenant-1")).toMatchObject({ status: "current", currentLeaseId: "lease-1" });
    expect(fake.list("tenancies")).toHaveLength(1);
    expect(fake.list("tenancies")[0]).toMatchObject({ status: "active", tenantId: "tenant-1", leaseId: "lease-1", moveInAt: evaluationInstant });
    expect(fake.list("canonicalEvents")).toHaveLength(1);
    expect(fake.list("canonicalEvents")[0]).toMatchObject({ type: "lease.occupancy_started", immutable: true });
    expect(fake.list("leaseStartRequests")).toHaveLength(1);
    const fresh = await getCanonicalLeaseStartContext({ ...base, firestore: fake.firestore });
    expect(fresh.decision.outcome).toBe("already_coherent");
    expect(result.expectedStateToken).toBe(fresh.expectedStateToken);
  });

  it("reuses a coherent active tenancy without rewriting it", async () => {
    fake.seed("tenancies", "tenancy-existing", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "lease-1", status: "active", moveInAt: "2026-04-01T12:00:00.000Z" });
    const result = await startCanonicalLeaseOccupancy(await mutationInput());
    expect(fake.ids("tenancies")).toEqual(["tenancy-existing"]);
    expect(fake.read("tenancies", "tenancy-existing").moveInAt).toBe("2026-04-01T12:00:00.000Z");
    const fresh = await getCanonicalLeaseStartContext({ ...base, firestore: fake.firestore });
    expect(result.expectedStateToken).toBe(fresh.expectedStateToken);
  });

  it("reconciles one inactive tenancy and preserves its verified earlier move-in", async () => {
    fake.seed("tenancies", "tenancy-existing", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "lease-1", status: "inactive", moveInAt: "2026-04-01T12:00:00.000Z", moveOutAt: "2026-04-15T12:00:00.000Z" });
    await startCanonicalLeaseOccupancy(await mutationInput());
    expect(fake.read("tenancies", "tenancy-existing")).toMatchObject({ status: "active", moveInAt: "2026-04-01T12:00:00.000Z", moveOutAt: null });
  });

  it.each([
    ["future", { startDate: "2026-06-01", endDate: "2027-05-31" }, "UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY"],
    ["incomplete", { executionStatus: "tenant_signed" }, "LEASE_EXECUTION_INCOMPLETE"],
    ["missing execution", { executionStatus: undefined }, "LEASE_EXECUTION_INCOMPLETE"],
    ["draft", { status: "draft", executionStatus: "draft" }, "DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY"],
    ["past", { endDate: "2026-04-30" }, "PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY"],
    ["ended", { status: "ended" }, "ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY"],
  ])("returns created_without_occupancy with zero domain writes for a %s lease", async (_label, lease, reason) => {
    fake = createFakeFirestore();
    seedBase({ lease });
    const before = domainSnapshot();
    const result = await startCanonicalLeaseOccupancy(await mutationInput());
    expect(result).toMatchObject({ outcome: "created_without_occupancy", occupancyEffective: false, reasons: [reason] });
    expect(domainSnapshot()).toEqual(before);
    expect(fake.list("leaseStartRequests")).toHaveLength(1);
  });

  it("fails closed for multiple current leases with no success idempotency result", async () => {
    fake.seed("leases", "lease-2", { ...fake.read("leases", "lease-1"), tenantId: "tenant-1" });
    const before = domainSnapshot();
    const result = await startCanonicalLeaseOccupancy(await mutationInput());
    expect(result).toMatchObject({ outcome: "rejected", reasons: ["MULTIPLE_CURRENT_LEASES"], occupancyEffective: false });
    expect(domainSnapshot()).toEqual(before);
    expect(fake.list("leaseStartRequests")).toEqual([]);
  });

  it("cannot bypass D1 anonymous legacy occupancy rejection", async () => {
    fake = createFakeFirestore();
    seedBase({ unit: { status: "occupied", occupancyStatus: "occupied" }, embedded: { status: "occupied", occupancyStatus: "occupied" } });
    const before = domainSnapshot();
    const result = await startCanonicalLeaseOccupancy(await mutationInput());
    expect(result).toMatchObject({ outcome: "rejected", reasons: ["OCCUPIED_WITHOUT_CURRENT_LEASE"], occupancyEffective: false });
    expect(domainSnapshot()).toEqual(before);
    expect(fake.list("leaseStartRequests")).toEqual([]);
  });

  it.each([
    ["unrelated tenant occupancy", { unit: { status: "occupied", tenantId: "tenant-2" }, embedded: { status: "occupied", tenantId: "tenant-2" } }, "STALE_CURRENT_LEASE_POINTER"],
    ["unrelated lease pointer", { unit: { currentLeaseId: "lease-2" }, embedded: { currentLeaseId: "lease-2" } }, "STALE_CURRENT_LEASE_POINTER"],
  ])("rejects %s with zero domain or success-idempotency writes", async (_label, overrides, reason) => {
    fake = createFakeFirestore();
    seedBase(overrides as any);
    const before = domainSnapshot();
    const result = await startCanonicalLeaseOccupancy(await mutationInput());
    expect(result.outcome).toBe("rejected");
    expect(result.reasons).toContain(reason);
    expect(domainSnapshot()).toEqual(before);
    expect(fake.list("leaseStartRequests")).toEqual([]);
  });

  it("rejects ambiguous tenancy and invalid date range without writes", async () => {
    fake.seed("tenancies", "tenancy-1", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "inactive" });
    fake.seed("tenancies", "tenancy-2", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", status: "inactive" });
    expect((await startCanonicalLeaseOccupancy(await mutationInput())).outcome).toBe("rejected");
    expect(fake.list("leaseStartRequests")).toEqual([]);

    fake = createFakeFirestore();
    seedBase({ lease: { startDate: "2027-01-01", endDate: "2026-12-31" } });
    expect(await startCanonicalLeaseOccupancy(await mutationInput())).toMatchObject({ outcome: "rejected", reasons: ["INVALID_LEASE_DATE_RANGE"] });
    expect(fake.list("leaseStartRequests")).toEqual([]);
  });

  it("rejects tenant-party, cross-landlord, and embedded-unit context mismatches", async () => {
    fake = createFakeFirestore();
    seedBase({ lease: { tenantId: "tenant-2" } });
    expect((await startCanonicalLeaseOccupancy(await mutationInput())).outcome).toBe("rejected");

    fake = createFakeFirestore();
    seedBase({ unit: { landlordId: "landlord-2" } });
    await expect(getCanonicalLeaseStartContext({ ...base, firestore: fake.firestore })).rejects.toMatchObject({ code: "lease_start_context_ambiguous" });

    fake = createFakeFirestore();
    seedBase({ embedded: { id: "unit-2", unitNumber: "2A" } });
    await expect(getCanonicalLeaseStartContext({ ...base, firestore: fake.firestore })).rejects.toMatchObject({ code: "lease_start_context_ambiguous" });
  });

  it("rejects a duplicate standalone logical-unit alias", async () => {
    fake.seed("units", "unit-duplicate", { landlordId: "landlord-1", propertyId: "property-1", unitNumber: "1A", status: "vacant" });
    await expect(getCanonicalLeaseStartContext({ ...base, firestore: fake.firestore })).rejects.toMatchObject({ code: "lease_start_context_ambiguous" });
    expect(fake.list("canonicalEvents")).toEqual([]);
    expect(fake.list("leaseStartRequests")).toEqual([]);
  });

  it("rejects a stale token after authoritative state changes", async () => {
    const input = await mutationInput();
    fake.seed("units", "unit-1", { ...fake.read("units", "unit-1"), currentLeaseId: "lease-racing", updatedAt: evaluationInstant });
    await expect(startCanonicalLeaseOccupancy(input)).rejects.toMatchObject({ code: "lease_start_state_stale", freshContext: expect.any(Object) });
    expect(fake.list("canonicalEvents")).toEqual([]);
  });

  it("fails stale when a competing current lease appears after context generation", async () => {
    const input = await mutationInput();
    fake.seed("leases", "lease-2", { ...fake.read("leases", "lease-1"), tenantId: "tenant-1", updatedAt: evaluationInstant });
    await expect(startCanonicalLeaseOccupancy(input)).rejects.toMatchObject({ code: "lease_start_state_stale" });
    expect(fake.list("canonicalEvents")).toEqual([]);
    expect(fake.list("leaseStartRequests")).toEqual([]);
  });

  it("fails stale when an End-Lease-style terminal change wins the race", async () => {
    const input = await mutationInput();
    fake.seed("leases", "lease-1", { ...fake.read("leases", "lease-1"), status: "ended", endedAt: evaluationInstant, updatedAt: evaluationInstant });
    await expect(startCanonicalLeaseOccupancy(input)).rejects.toMatchObject({ code: "lease_start_state_stale" });
    expect(fake.read("units", "unit-1")).toMatchObject({ status: "vacant", occupancyStatus: "vacant" });
    expect(fake.list("canonicalEvents")).toEqual([]);
  });

  it("recomputes expected state inside the transaction and serializes concurrent starts", async () => {
    const context = await getCanonicalLeaseStartContext({ ...base, firestore: fake.firestore });
    const common = { ...await mutationInput(), expectedStateToken: context.expectedStateToken };
    const settled = await Promise.allSettled([
      startCanonicalLeaseOccupancy({ ...common, idempotencyKey: "race-a" }),
      startCanonicalLeaseOccupancy({ ...common, idempotencyKey: "race-b" }),
    ]);
    expect(settled.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((entry) => entry.status === "rejected")).toHaveLength(1);
    expect(fake.list("canonicalEvents")).toHaveLength(1);
    expect(fake.list("tenancies")).toHaveLength(1);
  });

  it("returns an identical durable replay with no duplicate writes", async () => {
    const input = await mutationInput();
    const first = await startCanonicalLeaseOccupancy(input);
    const before = domainSnapshot();
    const replay = await startCanonicalLeaseOccupancy(input);
    expect(replay).toMatchObject({ outcome: "idempotent_replay", canonicalOutcome: first.canonicalOutcome, auditEventIds: first.auditEventIds, idempotency: { replay: true } });
    expect(domainSnapshot()).toEqual(before);
    expect(fake.list("canonicalEvents")).toHaveLength(1);
    expect(fake.list("tenancies")).toHaveLength(1);
  });

  it("rejects changed payload reuse while allowing the same client key for another operation kind", async () => {
    const input = await mutationInput();
    await startCanonicalLeaseOccupancy(input);
    await expect(startCanonicalLeaseOccupancy({ ...input, source: "changed" })).rejects.toBeInstanceOf(LeaseStartServiceError);
    await expect(startCanonicalLeaseOccupancy({ ...input, source: "changed" })).rejects.toMatchObject({ code: "lease_start_idempotency_key_reused" });
    const fresh = await getCanonicalLeaseStartContext({ ...base, firestore: fake.firestore });
    const replayAcrossOperation = await startCanonicalLeaseOccupancy({
      ...input,
      operationKind: "signing_completion",
      trigger: "signing_completion",
      expectedStateToken: fresh.expectedStateToken,
    });
    expect(replayAcrossOperation.canonicalOutcome).toBe("already_coherent");
    expect(fake.list("canonicalEvents")).toHaveLength(1);
  });

  it("does not duplicate events when the transaction callback retries", async () => {
    fake.retryNextTransaction();
    await startCanonicalLeaseOccupancy(await mutationInput());
    expect(fake.list("canonicalEvents")).toHaveLength(1);
    expect(fake.list("tenancies")).toHaveLength(1);
    expect(fake.list("leaseStartRequests")).toHaveLength(1);
  });

  it("rolls back every record when a required transaction write fails", async () => {
    const input = await mutationInput();
    const before = domainSnapshot();
    fake.failWritesTo("canonicalEvents");
    await expect(startCanonicalLeaseOccupancy(input)).rejects.toThrow("forced_transaction_failure");
    expect(domainSnapshot()).toEqual(before);
    expect(fake.list("leaseStartRequests")).toEqual([]);
  });

  it("returns already_coherent with zero domain writes and no duplicate event", async () => {
    fake = createFakeFirestore();
    const occupied = { status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1", currentTenantId: "tenant-1", leaseId: "lease-1", currentLeaseId: "lease-1" };
    seedBase({ unit: occupied, embedded: occupied, tenant: { status: "current", currentLeaseId: "lease-1" } });
    fake.seed("tenancies", "tenancy-existing", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "lease-1", status: "active", moveInAt: "2026-04-01T12:00:00.000Z" });
    const before = domainSnapshot();
    const result = await startCanonicalLeaseOccupancy(await mutationInput());
    expect(result).toMatchObject({ outcome: "already_coherent", occupancyEffective: true, auditEventIds: [] });
    expect(domainSnapshot()).toEqual(before);
    expect(fake.list("leaseStartRequests")).toHaveLength(1);
  });

  it("conditionally updates legacy occupancy booleans without introducing absent fields", async () => {
    await startCanonicalLeaseOccupancy(await mutationInput());
    expect(fake.read("units", "unit-1")).not.toHaveProperty("occupied");
    expect(fake.read("units", "unit-1")).not.toHaveProperty("isOccupied");
    expect(fake.read("properties", "property-1").units[0]).not.toHaveProperty("occupied");
    expect(fake.read("properties", "property-1").units[0]).not.toHaveProperty("isOccupied");

    fake = createFakeFirestore();
    seedBase({ unit: { occupied: false, isOccupied: false }, embedded: { occupied: false, isOccupied: false } });
    await startCanonicalLeaseOccupancy(await mutationInput());
    expect(fake.read("units", "unit-1")).toMatchObject({ occupied: true, isOccupied: true });
    expect(fake.read("properties", "property-1").units[0]).toMatchObject({ occupied: true, isOccupied: true });
  });

  it("requires a nonempty expected-state token for an occupancy-effective mutation", async () => {
    await expect(startCanonicalLeaseOccupancy({ ...await mutationInput(), expectedStateToken: "" })).rejects.toMatchObject({ code: "lease_start_state_stale" });
    expect(fake.list("canonicalEvents")).toEqual([]);
  });
});
