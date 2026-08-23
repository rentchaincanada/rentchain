import { beforeEach, describe, expect, it } from "vitest";
import { buildCanonicalLeaseOccupancyProjection, resolveCanonicalUnitProjectionInputs } from "../../../lib/leases/canonicalLeaseOccupancyProjection";
import { aggregateOccupancyReviewWorkspace } from "../../occupancyReviewWorkspaceService";
import { syncPropertyUnitOccupancyForTenantContext } from "../tenantOccupancySyncService";

function createFakeFirestore() {
  const store = new Map<string, Map<string, any>>();
  const collectionData = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  const ref = (name: string, id: string): any => ({
    id,
    collectionName: name,
    get: async () => {
      const value = collectionData(name).get(id);
      return { id, exists: value !== undefined, data: () => structuredClone(value), ref: ref(name, id) };
    },
    set: async (value: any, options?: any) => {
      const current = collectionData(name).get(id) || {};
      collectionData(name).set(id, options?.merge ? { ...current, ...structuredClone(value) } : structuredClone(value));
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
        .map(([id, value]) => ({ id, exists: true, data: () => structuredClone(value), ref: ref(name, id) })),
    }),
  });
  const firestore: any = {
    collection: (name: string) => ({ ...query(name), doc: (id: string) => ref(name, id) }),
    runTransaction: async (callback: any) => {
      const writes: Array<{ kind: "set" | "create"; target: any; value: any; options?: any }> = [];
      const result = await callback({
        get: (target: any) => target.get(),
        set: (target: any, value: any, options?: any) => writes.push({ kind: "set", target, value, options }),
        create: (target: any, value: any) => writes.push({ kind: "create", target, value }),
      });
      for (const write of writes) {
        if (write.kind === "create") await write.target.create(write.value);
        else await write.target.set(write.value, write.options);
      }
      return result;
    },
  };
  return {
    firestore,
    seed: (name: string, id: string, value: any) => collectionData(name).set(id, structuredClone(value)),
    read: (name: string, id: string) => structuredClone(collectionData(name).get(id)),
    list: (name: string) => [...collectionData(name).entries()].map(([id, value]) => ({ id, ...structuredClone(value) })),
    domain: () => structuredClone({
      properties: [...collectionData("properties")],
      units: [...collectionData("units")],
      leases: [...collectionData("leases")],
      tenants: [...collectionData("tenants")],
      tenancies: [...collectionData("tenancies")],
    }),
  };
}

const instant = "2026-08-23T12:00:00.000Z";
let fake: ReturnType<typeof createFakeFirestore>;

function seedBase(lease: Record<string, unknown> = {}, unit: Record<string, unknown> = {}) {
  fake.seed("properties", "property-1", {
    id: "property-1", landlordId: "landlord-1", name: "Harbour House",
    units: [{ id: "unit-1", unitId: "unit-1", unitNumber: "1A", status: "vacant", occupancyStatus: "vacant" }],
  });
  fake.seed("units", "unit-1", {
    id: "unit-1", landlordId: "landlord-1", propertyId: "property-1", unitNumber: "1A",
    status: "vacant", occupancyStatus: "vacant", ...unit,
  });
  fake.seed("tenants", "tenant-1", { id: "tenant-1", landlordId: "landlord-1", status: "invited", applicationId: "app-1" });
  fake.seed("tenancies", "tenancy-1", {
    id: "tenancy-1", landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1",
    tenantId: "tenant-1", leaseId: "lease-1", status: "inactive", source: "application_conversion",
  });
  fake.seed("leases", "lease-1", {
    id: "lease-1", landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1",
    tenantId: "tenant-1", tenantIds: ["tenant-1"], status: "active", executionStatus: "fully_executed",
    startDate: "2026-08-01", endDate: "2027-07-31", ...lease,
  });
}

async function activate(overrides: Record<string, unknown> = {}) {
  return syncPropertyUnitOccupancyForTenantContext({
    tenantId: "tenant-1", leaseId: "lease-1", applicationId: "app-1", landlordId: "landlord-1",
    propertyId: "property-1", unitId: "unit-1", actorId: "landlord-1", idempotencyKey: "app-1",
    source: "application_conversion", firestore: fake.firestore, evaluationInstant: instant, ...overrides,
  });
}

describe("tenantOccupancySyncService canonical adapter", () => {
  beforeEach(() => { fake = createFakeFirestore(); seedBase(); });

  it("uses the canonical transaction for one eligible current fully executed lease", async () => {
    const result = await activate();
    expect(result).toMatchObject({ updated: true, reason: "occupancy_effective", canonicalResult: { occupancyEffective: true } });
    expect(fake.read("leases", "lease-1")).toMatchObject({ occupancyEffective: true });
    expect(fake.read("units", "unit-1")).toMatchObject({ status: "occupied", occupancyStatus: "occupied", currentLeaseId: "lease-1", currentTenantId: "tenant-1", occupancySource: "canonical_lease_start" });
    expect(fake.read("properties", "property-1").units[0]).toMatchObject({ status: "occupied", currentLeaseId: "lease-1", currentTenantId: "tenant-1" });
    expect(fake.read("tenants", "tenant-1")).toMatchObject({ status: "current", currentLeaseId: "lease-1" });
    expect(fake.list("tenancies")).toEqual([expect.objectContaining({ id: "tenancy-1", tenantId: "tenant-1", leaseId: "lease-1", status: "active" })]);
    expect(fake.list("canonicalEvents")).toEqual([expect.objectContaining({ type: "lease.occupancy_started", status: "succeeded" })]);

    const unit = fake.read("units", "unit-1");
    const projection = buildCanonicalLeaseOccupancyProjection({
      leases: fake.list("leases"), context: { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1" },
      ...resolveCanonicalUnitProjectionInputs(unit), persistedTenancyStatus: "active", persistedTenantStatus: "current",
      currentLeasePointerId: "lease-1", tenantId: "tenant-1",
    });
    expect(projection).toMatchObject({ occupancyState: "occupied", tenantRelationshipState: "current_occupant", supportingLeaseId: "lease-1", reasons: [] });
    expect(aggregateOccupancyReviewWorkspace("landlord-1", {
      properties: fake.list("properties"), units: fake.list("units"), leases: fake.list("leases"),
      tenants: fake.list("tenants"), tenancies: fake.list("tenancies"),
    }).items).toEqual([]);
  });

  it("is replay-safe once the canonical state is already coherent", async () => {
    expect((await activate()).updated).toBe(true);
    const eventsBefore = fake.list("canonicalEvents");
    expect(await activate()).toMatchObject({ updated: false, reason: "already_coherent" });
    expect(fake.list("canonicalEvents")).toEqual(eventsBefore);
    expect(fake.list("tenancies")).toHaveLength(1);
  });

  it("uses the same canonical authority for tenant invite onboarding", async () => {
    expect(await activate({
      source: "tenant_invite_onboarding",
      actorId: "tenant-1",
      idempotencyKey: "invite-1",
    })).toMatchObject({ updated: true, reason: "occupancy_effective" });
    expect(fake.read("units", "unit-1")).toMatchObject({
      status: "occupied",
      currentLeaseId: "lease-1",
      currentTenantId: "tenant-1",
    });
    expect(fake.list("canonicalEvents")).toEqual([
      expect.objectContaining({ type: "lease.occupancy_started", status: "succeeded" }),
    ]);
  });

  it.each([
    ["future signed", { status: "signed", executionStatus: undefined, startDate: "2027-01-01", signedAt: instant }],
    ["future executed", { status: "executed", executionStatus: "fully_executed", startDate: "2027-01-01", executedAt: instant }],
    ["renewal pending status", { status: "renewal_pending", executionStatus: undefined }],
    ["renewal accepted status", { status: "renewal_accepted", executionStatus: undefined }],
    ["active status only", { status: "active", executionStatus: undefined }],
    ["signing timestamps only", { status: "unknown", executionStatus: undefined, signedAt: instant, tenantSignedAt: instant, landlordSignedAt: instant }],
    ["draft", { status: "draft", executionStatus: "draft" }],
    ["past", { startDate: "2025-01-01", endDate: "2026-01-01" }],
    ["ended", { status: "ended", endedAt: instant }],
    ["invalid dates", { startDate: "2027-01-01", endDate: "2026-01-01" }],
  ])("keeps %s metadata-only with zero occupancy writes", async (_label, lease) => {
    fake = createFakeFirestore(); seedBase(lease);
    const before = fake.domain();
    const result = await activate();
    expect(result.updated).toBe(false);
    expect(fake.domain()).toEqual(before);
    expect(fake.list("canonicalEvents")).toEqual([]);
    expect(fake.list("leaseStartRequests")).toEqual([]);
  });

  it("keeps future executed onboarding non-current across canonical projections", async () => {
    fake = createFakeFirestore();
    seedBase({ status: "executed", executionStatus: "fully_executed", startDate: "2027-01-01" });
    expect(await activate({ source: "tenant_invite_onboarding", idempotencyKey: "invite-future" }))
      .toMatchObject({ updated: false, reason: "created_without_occupancy" });

    const unit = fake.read("units", "unit-1");
    expect(unit).toMatchObject({ status: "vacant", occupancyStatus: "vacant" });
    expect(fake.read("tenants", "tenant-1")).toMatchObject({ status: "invited" });
    expect(fake.read("tenancies", "tenancy-1")).toMatchObject({ status: "inactive" });
    expect(buildCanonicalLeaseOccupancyProjection({
      leases: fake.list("leases"),
      context: {
        landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1",
        tenantId: "tenant-1", asOfDate: "2026-08-23",
      },
      ...resolveCanonicalUnitProjectionInputs(unit),
      persistedTenancyStatus: "inactive",
      persistedTenantStatus: "invited",
      currentLeasePointerId: null,
      tenantId: "tenant-1",
    })).toMatchObject({
      leaseTermState: "upcoming",
      occupancyState: "vacant",
      supportingLeaseId: null,
    });
  });

  it("fails closed for multiple current leases with zero occupancy writes", async () => {
    fake.seed("leases", "lease-2", { ...fake.read("leases", "lease-1"), id: "lease-2" });
    const before = fake.domain();
    expect(await activate()).toMatchObject({ updated: false, reason: "rejected", canonicalResult: { reasons: ["MULTIPLE_CURRENT_LEASES"] } });
    expect(fake.domain()).toEqual(before);
  });

  it.each([
    ["foreign landlord lease", { lease: { landlordId: "landlord-2" } }],
    ["foreign property lease", { lease: { propertyId: "property-2" } }],
    ["foreign unit lease", { lease: { unitId: "unit-2" } }],
    ["foreign participant", { lease: { tenantId: "tenant-2", tenantIds: ["tenant-2"] } }],
    ["foreign property owner", { property: { landlordId: "landlord-2" } }],
    ["missing unit landlord", { unit: { landlordId: undefined } }],
  ])("rejects %s without occupancy writes", async (_label, change) => {
    if (change.lease) fake.seed("leases", "lease-1", { ...fake.read("leases", "lease-1"), ...change.lease });
    if (change.property) fake.seed("properties", "property-1", { ...fake.read("properties", "property-1"), ...change.property });
    if (change.unit) fake.seed("units", "unit-1", { ...fake.read("units", "unit-1"), ...change.unit });
    const before = fake.domain();
    try {
      const result = await activate();
      expect(result).toMatchObject({ updated: false, reason: "rejected" });
    } catch (error) {
      expect(error).toMatchObject({ code: "lease_start_context_ambiguous" });
    }
    expect(fake.domain()).toEqual(before);
  });

  it("rejects caller-provided property, unit, and tenant mismatches", async () => {
    for (const overrides of [{ propertyId: "property-2" }, { unitId: "unit-2" }, { tenantId: "tenant-2" }]) {
      const before = fake.domain();
      await expect(activate(overrides)).rejects.toMatchObject({ code: "lease_start_context_ambiguous" });
      expect(fake.domain()).toEqual(before);
    }
  });

  it("does not bypass renewal handoff or reactivate an occupancy-excluded lease", async () => {
    fake.seed("leases", "lease-1", { ...fake.read("leases", "lease-1"), predecessorLeaseId: "lease-old" });
    expect(await activate()).toEqual({ updated: false, reason: "renewal_handoff_required" });
    fake.seed("leases", "lease-1", { ...fake.read("leases", "lease-1"), predecessorLeaseId: null, occupancyDisposition: { status: "excluded_from_current_occupancy_by_resolution" } });
    expect(await activate()).toEqual({ updated: false, reason: "occupancy_excluded" });
    expect(fake.read("units", "unit-1")).toMatchObject({ status: "vacant", occupancyStatus: "vacant" });
    expect(fake.list("canonicalEvents")).toEqual([]);
  });

  it("does nothing without one complete durable context", async () => {
    expect(await activate({ leaseId: null })).toEqual({ updated: false, reason: "missing_context" });
    fake = createFakeFirestore();
    expect(await activate()).toEqual({ updated: false, reason: "lease_not_found" });
  });
});
