import { beforeEach, describe, expect, it } from "vitest";
import { createCanonicalLease, type CreateCanonicalLeaseInput } from "../leaseCreationService";

function fakeFirestore() {
  const store = new Map<string, Map<string, any>>();
  let failCollection: string | null = null;
  const values = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  const ref = (name: string, id: string): any => ({
    kind: "doc", collectionName: name, id,
    get: async () => {
      const value = values(name).get(id);
      return { id, exists: value !== undefined, data: () => value, ref: ref(name, id) };
    },
  });
  const query = (name: string, filters: any[] = []): any => ({
    kind: "query", collectionName: name,
    where: (field: string, op: string, value: any) => query(name, [...filters, { field, op, value }]),
    get: async () => ({
      docs: [...values(name)].filter(([, value]) => filters.every((filter) => filter.op === "==" && value[filter.field] === filter.value))
        .map(([id, value]) => ({ id, exists: true, data: () => value, ref: ref(name, id) })),
    }),
  });
  const firestore: any = {
    collection: (name: string) => ({ ...query(name), doc: (id: string) => ref(name, id) }),
    runTransaction: async (callback: any) => {
      const writes: any[] = [];
      const result = await callback({
        get: (target: any) => target.get(),
        set: (target: any, value: any, options?: any) => writes.push({ kind: "set", target, value, options }),
        create: (target: any, value: any) => writes.push({ kind: "create", target, value }),
      });
      const snapshot = structuredClone([...store].map(([name, entries]) => [name, [...entries]]));
      try {
        for (const write of writes) {
          const name = write.target.collectionName;
          if (name === failCollection) throw new Error("forced_transaction_failure");
          const collection = values(name);
          if (write.kind === "create" && collection.has(write.target.id)) throw new Error("already_exists");
          const current = collection.get(write.target.id) || {};
          collection.set(write.target.id, structuredClone(write.options?.merge ? { ...current, ...write.value } : write.value));
        }
      } catch (error) {
        store.clear();
        for (const [name, entries] of snapshot) store.set(name, new Map(entries));
        throw error;
      }
      return result;
    },
  };
  return {
    firestore,
    seed: (name: string, id: string, value: any) => values(name).set(id, structuredClone(value)),
    read: (name: string, id: string) => structuredClone(values(name).get(id)),
    list: (name: string) => [...values(name).values()].map((value) => structuredClone(value)),
    fail: (name: string | null) => { failCollection = name; },
  };
}

const at = "2026-08-19T12:00:00.000Z";
let fake: ReturnType<typeof fakeFirestore>;

function seedContext(overrides: { unit?: any; embedded?: any; tenant?: any } = {}) {
  fake.seed("properties", "property-1", {
    landlordId: "landlord-1",
    units: [{ id: "unit-1", unitId: "unit-1", unitNumber: "1A", status: "vacant", occupancyStatus: "vacant", ...(overrides.embedded || {}) }],
  });
  fake.seed("units", "unit-1", { landlordId: "landlord-1", propertyId: "property-1", unitNumber: "1A", status: "vacant", occupancyStatus: "vacant", ...(overrides.unit || {}) });
  fake.seed("tenants", "tenant-1", { landlordId: "landlord-1", status: "applicant", currentLeaseId: null, ...(overrides.tenant || {}) });
}

function input(overrides: Partial<CreateCanonicalLeaseInput> = {}): CreateCanonicalLeaseInput {
  const idempotencyKey = overrides.idempotencyKey || "create-1";
  const leaseId = overrides.leaseId || `lease-${idempotencyKey}`;
  const result: CreateCanonicalLeaseInput = {
    landlordId: "landlord-1",
    propertyId: "property-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    leaseId,
    leaseRecord: {
      landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", tenantIds: ["tenant-1"],
      status: "active", executionStatus: "fully_executed", startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: 1800,
      createdAt: at, updatedAt: at,
      ...(overrides.leaseRecord || {}),
    },
    operationKind: "direct_create",
    idempotencyKey,
    evaluationInstant: at,
    actorId: "landlord-1",
    source: "test",
    firestore: fake.firestore,
  };
  return { ...result, ...overrides, leaseRecord: { ...result.leaseRecord, ...(overrides.leaseRecord || {}) } };
}

describe("createCanonicalLease", () => {
  beforeEach(() => {
    fake = fakeFirestore();
    seedContext();
  });

  it("creates a fully executed current lease and complete occupancy atomically", async () => {
    const result = await createCanonicalLease(input());
    expect(result).toMatchObject({ canonicalOutcome: "occupancy_effective", occupancyEffective: true });
    expect(fake.read("leases", "lease-create-1")).toMatchObject({ status: "active", occupancyEffective: true });
    expect(fake.read("units", "unit-1")).toMatchObject({ status: "occupied", currentLeaseId: "lease-create-1", currentTenantId: "tenant-1" });
    expect(fake.read("properties", "property-1").units[0]).toMatchObject({ status: "occupied", currentLeaseId: "lease-create-1" });
    expect(fake.read("tenants", "tenant-1")).toMatchObject({ currentLeaseId: "lease-create-1" });
    expect(fake.list("tenancies")).toHaveLength(1);
    expect(fake.list("canonicalEvents").map((event) => event.type).sort()).toEqual(["lease.created", "lease.occupancy_started"]);
    expect(fake.list("leaseStartRequests")).toHaveLength(1);
  });

  it.each([
    ["future", { startDate: "2026-09-01", endDate: "2027-08-31" }],
    ["incomplete", { executionStatus: "draft", executionState: "draft", status: "draft" }],
    ["missing execution", { executionStatus: undefined, executionState: undefined, status: "active" }],
  ])("creates %s lease without current occupancy", async (_label, leasePatch) => {
    const result = await createCanonicalLease(input({ leaseRecord: leasePatch }));
    expect(result).toMatchObject({ canonicalOutcome: "created_without_occupancy", occupancyEffective: false });
    expect(fake.read("leases", "lease-create-1")).toMatchObject({ status: "pending", occupancyEffective: false });
    expect(fake.read("units", "unit-1")).toMatchObject({ status: "vacant" });
    expect(fake.read("tenants", "tenant-1")).toMatchObject({ currentLeaseId: null });
    expect(fake.list("tenancies")).toEqual([]);
    expect(fake.list("canonicalEvents").map((event) => event.type)).toEqual(["lease.created_without_occupancy"]);
  });

  it("returns the durable result for an identical retry without duplicates", async () => {
    const request = input();
    const first = await createCanonicalLease(request);
    const replay = await createCanonicalLease({ ...request, evaluationInstant: "2026-08-19T12:00:05.000Z" });
    expect(first.leaseId).toBe(replay.leaseId);
    expect(replay.outcome).toBe("idempotent_replay");
    expect(fake.list("leases")).toHaveLength(1);
    expect(fake.list("tenancies")).toHaveLength(1);
    expect(fake.list("canonicalEvents")).toHaveLength(2);
    expect(fake.list("leaseStartRequests")).toHaveLength(1);
  });

  it("rejects the same key with changed semantic payload", async () => {
    await createCanonicalLease(input());
    await expect(createCanonicalLease(input({ leaseRecord: { monthlyRent: 1900 } }))).rejects.toMatchObject({ code: "lease_start_idempotency_key_reused" });
  });

  it("does not collapse a new key with an identical payload", async () => {
    await createCanonicalLease(input());
    const second = await createCanonicalLease(input({ idempotencyKey: "create-2", leaseId: "lease-create-2" }));
    expect(second.canonicalOutcome).toBe("rejected");
    expect(second.reasons).toContain("MULTIPLE_CURRENT_LEASES");
    expect(fake.list("leaseStartRequests")).toHaveLength(2);
  });

  it("fails closed for cross-tenant active tenancy without creating a lease", async () => {
    fake.seed("tenancies", "foreign", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-2", leaseId: "foreign-lease", status: "active" });
    const result = await createCanonicalLease(input());
    expect(result.canonicalOutcome).toBe("rejected");
    expect(fake.list("leases")).toEqual([]);
    expect(fake.read("units", "unit-1")).toMatchObject({ status: "vacant" });
    expect(fake.list("canonicalEvents").map((event) => event.type)).toEqual(["lease.occupancy_start_rejected"]);
  });

  it("rolls back every domain write when the atomic transaction fails", async () => {
    fake.fail("canonicalEvents");
    await expect(createCanonicalLease(input())).rejects.toThrow("forced_transaction_failure");
    expect(fake.list("leases")).toEqual([]);
    expect(fake.read("units", "unit-1")).toMatchObject({ status: "vacant" });
    expect(fake.read("tenants", "tenant-1")).toMatchObject({ currentLeaseId: null });
    expect(fake.list("tenancies")).toEqual([]);
    expect(fake.list("leaseStartRequests")).toEqual([]);
  });

  it("consumes a draft in the same transaction as lease creation", async () => {
    fake.seed("leaseDrafts", "draft-1", { landlordId: "landlord-1", status: "generated", leaseId: null });
    const result = await createCanonicalLease(input({ operationKind: "draft_activation", draftActivation: { draftId: "draft-1" } }));
    expect(result.occupancyEffective).toBe(true);
    expect(fake.read("leaseDrafts", "draft-1")).toMatchObject({ status: "activated", leaseId: "lease-create-1" });
  });
});
