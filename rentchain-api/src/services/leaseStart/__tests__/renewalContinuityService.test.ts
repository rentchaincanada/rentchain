import { beforeEach, describe, expect, it } from "vitest";
import {
  getRenewalContinuityContext,
  handoffRenewalContinuity,
  RenewalContinuityServiceError,
} from "../renewalContinuityService";

function createFakeFirestore() {
  const store = new Map<string, Map<string, any>>();
  let transactionQueue = Promise.resolve();
  const collectionData = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  const ref = (name: string, id: string): any => ({
    kind: "doc", collectionName: name, id,
    get: async () => {
      const value = collectionData(name).get(id);
      return { id, exists: value !== undefined, data: () => value };
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
    kind: "query", collectionName: name, filters,
    where: (field: string, op: string, value: any) => query(name, [...filters, { field, op, value }]),
    get: async () => ({
      docs: [...collectionData(name).entries()]
        .filter(([, value]) => filters.every((filter) => filter.op === "==" && value[filter.field] === filter.value))
        .map(([id, value]) => ({ id, exists: true, data: () => value })),
    }),
  });
  const firestore: any = {
    collection: (name: string) => ({ ...query(name), doc: (id: string) => ref(name, id) }),
    runTransaction: async (callback: any) => {
      const execute = async () => {
      const writes: Array<{ kind: "set" | "create"; target: any; value: any; options?: any }> = [];
      const result = await callback({
        get: (target: any) => target.get(),
        set: (target: any, value: any, options?: any) => writes.push({ kind: "set", target, value, options }),
        create: (target: any, value: any) => writes.push({ kind: "create", target, value }),
      });
      const snapshot = structuredClone([...store.entries()].map(([name, values]) => [name, [...values.entries()]]));
      try {
        for (const write of writes) {
          if (write.kind === "create") await write.target.create(write.value);
          else await write.target.set(write.value, write.options);
        }
      } catch (error) {
        store.clear();
        for (const [name, values] of snapshot) store.set(name, new Map(values));
        throw error;
      }
      return result;
      };
      const pending = transactionQueue.then(execute, execute);
      transactionQueue = pending.then(() => undefined, () => undefined);
      return pending;
    },
  };
  return {
    firestore,
    seed: (name: string, id: string, value: any) => collectionData(name).set(id, structuredClone(value)),
    read: (name: string, id: string) => structuredClone(collectionData(name).get(id)),
    list: (name: string) => [...collectionData(name).values()].map((value) => structuredClone(value)),
  };
}

const evaluationInstant = "2027-01-01T12:00:00.000Z";
let fake: ReturnType<typeof createFakeFirestore>;

function seed(overrides: { predecessor?: any; successor?: any; extraTenancy?: any } = {}) {
  const unit = {
    id: "unit-1", landlordId: "landlord-1", propertyId: "property-1", unitNumber: "1A",
    status: "occupied", occupancyStatus: "occupied", occupied: true,
    tenantId: "tenant-1", currentTenantId: "tenant-1", leaseId: "predecessor", currentLeaseId: "predecessor",
    updatedAt: "2026-12-31T12:00:00.000Z",
  };
  fake.seed("properties", "property-1", { landlordId: "landlord-1", units: [{ ...unit }], updatedAt: unit.updatedAt });
  fake.seed("units", "unit-1", unit);
  fake.seed("tenants", "tenant-1", { landlordId: "landlord-1", status: "current", currentLeaseId: "predecessor", updatedAt: unit.updatedAt });
  fake.seed("leases", "predecessor", {
    landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", tenantIds: ["tenant-1"],
    status: "active", executionStatus: "fully_executed", startDate: "2026-01-01", endDate: "2026-12-31",
    renewedByLeaseId: "successor", occupancyEffective: true, monthlyRent: 1200, updatedAt: unit.updatedAt,
    ...(overrides.predecessor || {}),
  });
  fake.seed("leases", "successor", {
    landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", tenantIds: ["tenant-1"],
    status: "active", executionStatus: "fully_executed", startDate: "2027-01-01", endDate: "2027-12-31",
    predecessorLeaseId: "predecessor", occupancyEffective: false, monthlyRent: 1250, updatedAt: unit.updatedAt,
    ...(overrides.successor || {}),
  });
  fake.seed("tenancies", "predecessor-tenancy", {
    landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "predecessor",
    status: "active", moveInAt: "2026-01-01T00:00:00.000Z", moveOutAt: null, updatedAt: unit.updatedAt,
  });
  if (overrides.extraTenancy) fake.seed("tenancies", "other-tenancy", overrides.extraTenancy);
}

async function request(overrides: Record<string, unknown> = {}) {
  const context = await getRenewalContinuityContext({ landlordId: "landlord-1", successorLeaseId: "successor", evaluationInstant, firestore: fake.firestore });
  return {
    landlordId: "landlord-1", successorLeaseId: "successor", evaluationInstant,
    expectedStateToken: context.expectedStateToken, idempotencyKey: "renewal-request-1",
    actorId: "landlord-1", source: "test", firestore: fake.firestore,
    ...overrides,
  };
}

beforeEach(() => {
  fake = createFakeFirestore();
  seed();
});

describe("renewal continuity service", () => {
  it("returns a read-only eligible context", async () => {
    const before = JSON.stringify(fake.list("tenancies"));
    const context = await getRenewalContinuityContext({ landlordId: "landlord-1", successorLeaseId: "successor", evaluationInstant, firestore: fake.firestore });
    expect(context).toMatchObject({ handoffEligible: true, termContinuity: true, executionReady: true, blockingReasons: [] });
    expect(JSON.stringify(fake.list("tenancies"))).toBe(before);
    expect(fake.list("canonicalEvents")).toHaveLength(0);
  });

  it("atomically hands occupancy to the successor without mutating contract fields", async () => {
    const predecessorBefore = fake.read("leases", "predecessor");
    const successorBefore = fake.read("leases", "successor");
    const result = await handoffRenewalContinuity(await request());
    expect(result.outcome).toBe("renewal_handoff_completed");
    expect(fake.read("units", "unit-1")).toMatchObject({ status: "occupied", currentLeaseId: "successor", currentTenantId: "tenant-1" });
    expect(fake.read("properties", "property-1").units[0]).toMatchObject({ status: "occupied", currentLeaseId: "successor", currentTenantId: "tenant-1" });
    expect(fake.read("tenants", "tenant-1")).toMatchObject({ status: "current", currentLeaseId: "successor" });
    expect(fake.read("tenancies", "predecessor-tenancy")).toMatchObject({ status: "inactive", moveOutAt: evaluationInstant });
    expect(fake.list("tenancies").filter((entry) => entry.leaseId === "successor" && entry.status === "active")).toHaveLength(1);
    expect(fake.list("canonicalEvents")).toHaveLength(1);
    expect(fake.read("leases", "predecessor")).toMatchObject({ startDate: predecessorBefore.startDate, endDate: predecessorBefore.endDate, status: predecessorBefore.status, monthlyRent: predecessorBefore.monthlyRent });
    expect(fake.read("leases", "successor")).toMatchObject({ startDate: successorBefore.startDate, endDate: successorBefore.endDate, executionStatus: successorBefore.executionStatus, monthlyRent: successorBefore.monthlyRent });
  });

  it("replays the same logical request without duplicate tenancy or audit", async () => {
    const input = await request();
    await handoffRenewalContinuity(input);
    const replay = await handoffRenewalContinuity(input);
    expect(replay.outcome).toBe("idempotent_replay");
    expect(fake.list("canonicalEvents")).toHaveLength(1);
    expect(fake.list("tenancies").filter((entry) => entry.leaseId === "successor" && entry.status === "active")).toHaveLength(1);
  });

  it("rejects stale state before any write", async () => {
    const input = await request();
    fake.seed("units", "unit-1", { ...fake.read("units", "unit-1"), updatedAt: "changed", currentLeaseId: "other", leaseId: "other" });
    await expect(handoffRenewalContinuity(input)).rejects.toMatchObject({ code: "renewal_state_stale" });
    expect(fake.list("canonicalEvents")).toHaveLength(0);
  });

  it("rejects a reused idempotency key with changed payload", async () => {
    const input = await request();
    await handoffRenewalContinuity(input);
    await expect(handoffRenewalContinuity({ ...input, source: "changed" })).rejects.toBeInstanceOf(RenewalContinuityServiceError);
    await expect(handoffRenewalContinuity({ ...input, source: "changed" })).rejects.toMatchObject({ code: "renewal_idempotency_key_reused" });
  });

  it("rejects an unrelated active same-unit tenancy without broad deactivation", async () => {
    fake = createFakeFirestore();
    seed({ extraTenancy: { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-2", leaseId: "other", status: "active", moveOutAt: null } });
    const input = await request();
    await expect(handoffRenewalContinuity(input)).rejects.toMatchObject({ code: "renewal_handoff_ineligible" });
    expect(fake.read("tenancies", "other-tenancy")).toMatchObject({ status: "active", moveOutAt: null });
  });

  it("allows only one winner for concurrent handoff identities", async () => {
    const context = await getRenewalContinuityContext({ landlordId: "landlord-1", successorLeaseId: "successor", evaluationInstant, firestore: fake.firestore });
    const base = {
      landlordId: "landlord-1", successorLeaseId: "successor", evaluationInstant,
      expectedStateToken: context.expectedStateToken, actorId: "landlord-1", source: "test", firestore: fake.firestore,
    };
    const attempts = await Promise.allSettled([
      handoffRenewalContinuity({ ...base, idempotencyKey: "concurrent-a" }),
      handoffRenewalContinuity({ ...base, idempotencyKey: "concurrent-b" }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(fake.list("canonicalEvents")).toHaveLength(1);
    expect(fake.list("tenancies").filter((entry) => entry.leaseId === "successor" && entry.status === "active")).toHaveLength(1);
  });
});
