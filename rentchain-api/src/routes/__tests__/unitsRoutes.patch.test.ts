import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc, getDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoCounter = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function applyMerge(existing: any, payload: any) {
    return { ...(existing || {}), ...(payload || {}) };
  }

  function snapshotFor(name: string, filters: Array<{ field: string; value: any }>) {
    const docs = Array.from(ensureCollection(name).values())
      .filter((doc) => filters.every((filter) => doc.data?.[filter.field] === filter.value))
      .map((doc) => ({
        id: doc.id,
        exists: true,
        data: () => doc.data,
      }));
    return { docs, size: docs.length };
  }

  function collectionApi(name: string, filters: Array<{ field: string; value: any }> = []): any {
    return {
      doc: (id?: string) => {
        const col = ensureCollection(name);
        const docId = id || `${name}-auto-${++autoCounter}`;
        return {
          id: docId,
          get: async () => {
            const existing = col.get(docId);
            return {
              id: docId,
              exists: Boolean(existing),
              data: () => existing?.data,
            };
          },
          set: async (payload: any, options?: { merge?: boolean }) => {
            if (options?.merge) {
              const existing = col.get(docId)?.data || {};
              col.set(docId, { id: docId, data: applyMerge(existing, payload) });
              return;
            }
            col.set(docId, { id: docId, data: payload });
          },
        };
      },
      where: (field: string, op: string, value: any) => {
        if (op !== "==") throw new Error(`Unsupported where op: ${op}`);
        return collectionApi(name, [...filters, { field, value }]);
      },
      get: async () => snapshotFor(name, filters),
    };
  }

  const dbMock = {
    runTransaction: async (callback: any) => callback({
      get: (target: any) => target.get(),
      set: (ref: any, payload: any, options?: any) => ref.set(payload, options),
    }),
    collection: (name: string) => collectionApi(name),
    batch: () => {
      const writes: Array<() => Promise<void>> = [];
      return {
        set: (ref: any, payload: any, options?: { merge?: boolean }) => {
          writes.push(() => ref.set(payload, options));
        },
        commit: async () => {
          for (const write of writes) await write();
        },
      };
    },
  };

  return {
    dbMock,
    resetDb: () => {
      collections.clear();
      autoCounter = 0;
    },
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
    getDoc: (collection: string, id: string) => ensureCollection(collection).get(id)?.data,
  };
});

vi.mock("../../firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => Date.now(),
  },
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true, plan: "starter" })),
}));

async function createApp() {
  const router = (await import("../unitsRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("unitsRoutes PATCH aliases", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  function seedCoherentCurrentOccupancy(options: { contradictoryTenantPointer?: boolean } = {}) {
    const embedded = { id: "unit-1", unitId: "unit-1", unitNumber: "101", status: "occupied", occupancyStatus: "occupied", occupantName: "Tenant One", tenantId: "tenant-1", currentTenantId: "tenant-1", leaseId: "lease-1", currentLeaseId: "lease-1", leaseEndDate: "2026-12-31" };
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", units: [embedded] });
    seedDoc("units", "unit-1", { landlordId: "landlord-1", propertyId: "prop-1", ...embedded, rent: 1800 });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", currentLeaseId: options.contradictoryTenantPointer ? "lease-other" : "lease-1" });
    seedDoc("leases", "lease-1", { landlordId: "landlord-1", propertyId: "prop-1", unitId: "unit-1", tenantId: "tenant-1", tenantIds: ["tenant-1"], status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-01-01", endDate: "2026-12-31" });
    seedDoc("tenancies", "tenancy-1", { landlordId: "landlord-1", propertyId: "prop-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "lease-1", status: "active" });
  }

  it("accepts name + marketRent aliases for unit updates", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      rent: 1000,
      marketRent: 1000,
    });
    const app = await createApp();

    const res = await request(app).patch("/api/units/unit-1").send({
      name: "101A",
      marketRent: 1800,
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.unit?.unitNumber).toBe("101A");
    expect(res.body?.unit?.rent).toBe(1800);
    expect(res.body?.unit?.marketRent).toBe(1800);
  });

  it("persists occupancy status, occupant name, and lease end date", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "vacant",
    });
    const app = await createApp();

    const res = await request(app).patch("/api/units/unit-1").send({
      status: "occupied",
      occupantName: "Jane Tenant",
      leaseEndDate: "2027-06-10",
    });

    expect(res.status).toBe(200);
    expect(res.body?.unit).toMatchObject({
      id: "unit-1",
      status: "occupied",
      occupantName: "Jane Tenant",
      leaseEndDate: "2027-06-10",
    });
  });

  it("rejects a direct occupied-to-vacant update when a current occupancy-effective lease exists", async () => {
    const embedded = { id: "unit-1", unitId: "unit-1", unitNumber: "101", status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1", currentLeaseId: "lease-1" };
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", units: [embedded] });
    seedDoc("units", "unit-1", { landlordId: "landlord-1", propertyId: "prop-1", unitNumber: "101", status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1", currentLeaseId: "lease-1", rent: 1800 });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", currentLeaseId: "lease-1" });
    seedDoc("leases", "lease-1", { landlordId: "landlord-1", propertyId: "prop-1", unitId: "unit-1", tenantId: "tenant-1", status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-01-01", endDate: "2026-12-31" });
    seedDoc("tenancies", "tenancy-1", { landlordId: "landlord-1", propertyId: "prop-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "lease-1", status: "active" });
    const before = JSON.parse(JSON.stringify({ unit: getDoc("units", "unit-1"), property: getDoc("properties", "prop-1"), lease: getDoc("leases", "lease-1"), tenant: getDoc("tenants", "tenant-1"), tenancy: getDoc("tenancies", "tenancy-1") }));
    const app = await createApp();

    const res = await request(app).patch("/api/units/unit-1").send({ status: "vacant", occupantName: null, leaseEndDate: null });

    expect(res.status).toBe(409);
    expect(res.body?.error).toBe("end_lease_workflow_required");
    expect({ unit: getDoc("units", "unit-1"), property: getDoc("properties", "prop-1"), lease: getDoc("leases", "lease-1"), tenant: getDoc("tenants", "tenant-1"), tenancy: getDoc("tenancies", "tenancy-1") }).toEqual(before);
    expect(getDoc("canonicalEvents", "anything")).toBeUndefined();
  });

  it.each([
    ["occupantName clear", { occupantName: null }],
    ["occupantName case rewrite", { occupantName: "TENANT ONE" }],
    ["tenantName rewrite", { tenantName: "Other Tenant" }],
    ["leaseEndDate clear", { leaseEndDate: null }],
    ["leaseEndDate rewrite", { leaseEndDate: "2026-11-30" }],
    ["tenantId rewrite", { tenantId: "tenant-other" }],
    ["currentTenantId clear", { currentTenantId: null }],
    ["leaseId rewrite", { leaseId: "lease-other" }],
    ["currentLeaseId clear", { currentLeaseId: null }],
    ["status vacancy", { status: "vacant" }],
    ["occupancyStatus vacancy", { occupancyStatus: "vacant" }],
  ])("rejects coherent current occupancy-bearing bypass: %s", async (_label, body) => {
    seedCoherentCurrentOccupancy();
    const before = JSON.parse(JSON.stringify({ unit: getDoc("units", "unit-1"), property: getDoc("properties", "prop-1") }));
    const app = await createApp();

    const res = await request(app).patch("/api/units/unit-1").send(body);

    expect(res.status).toBe(409);
    expect(res.body?.error).toBe("end_lease_workflow_required");
    expect({ unit: getDoc("units", "unit-1"), property: getDoc("properties", "prop-1") }).toEqual(before);
  });

  it.each([
    ["occupantName clear", { occupantName: null }],
    ["occupantName case rewrite", { occupantName: "TENANT ONE" }],
    ["tenantName rewrite", { tenantName: "Other Tenant" }],
    ["leaseEndDate clear", { leaseEndDate: null }],
    ["leaseEndDate rewrite", { leaseEndDate: "2026-11-30" }],
    ["tenantId rewrite", { tenantId: "tenant-other" }],
    ["currentTenantId clear", { currentTenantId: null }],
    ["leaseId rewrite", { leaseId: "lease-other" }],
    ["currentLeaseId clear", { currentLeaseId: null }],
    ["status vacancy", { status: "vacant" }],
    ["occupancyStatus vacancy", { occupancyStatus: "vacant" }],
  ])("routes contradictory single-current occupancy-bearing bypass to reconciliation: %s", async (_label, body) => {
    seedCoherentCurrentOccupancy({ contradictoryTenantPointer: true });
    const before = JSON.parse(JSON.stringify({ unit: getDoc("units", "unit-1"), property: getDoc("properties", "prop-1") }));
    const app = await createApp();

    const res = await request(app).patch("/api/units/unit-1").send(body);

    expect(res.status).toBe(409);
    expect(res.body?.error).toBe("occupancy_reconciliation_required");
    expect({ unit: getDoc("units", "unit-1"), property: getDoc("properties", "prop-1") }).toEqual(before);
  });

  it("rejects ambiguous occupied-to-vacant updates with occupancy reconciliation guidance", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", units: [{ id: "unit-1", unitNumber: "101", status: "occupied", occupancyStatus: "occupied" }] });
    seedDoc("units", "unit-1", { landlordId: "landlord-1", propertyId: "prop-1", unitNumber: "101", status: "occupied", occupancyStatus: "occupied" });
    for (const id of ["lease-a", "lease-b"]) seedDoc("leases", id, { landlordId: "landlord-1", propertyId: "prop-1", unitId: "unit-1", status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-01-01", endDate: "2026-12-31" });
    const app = await createApp();

    const res = await request(app).patch("/api/units/unit-1").send({ status: "vacant" });

    expect(res.status).toBe(409);
    expect(res.body?.error).toBe("occupancy_reconciliation_required");
    expect(getDoc("units", "unit-1")).toMatchObject({ status: "occupied", occupancyStatus: "occupied" });
    expect(getDoc("properties", "prop-1").units[0]).toMatchObject({ status: "occupied", occupancyStatus: "occupied" });
  });

  it("allows safe metadata edits for current occupancy and preserves occupancy fields in both projections", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", units: [{ id: "unit-1", unitNumber: "101", rent: 1800, status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1", currentLeaseId: "lease-1" }] });
    seedDoc("units", "unit-1", { landlordId: "landlord-1", propertyId: "prop-1", unitNumber: "101", rent: 1800, status: "occupied", occupancyStatus: "occupied", occupantName: "Tenant One", tenantId: "tenant-1", currentLeaseId: "lease-1" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", currentLeaseId: "lease-1" });
    seedDoc("leases", "lease-1", { landlordId: "landlord-1", propertyId: "prop-1", unitId: "unit-1", tenantId: "tenant-1", status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-01-01", endDate: "2026-12-31" });
    const app = await createApp();

    const res = await request(app).patch("/api/units/unit-1").send({ name: "101A", marketRent: 1900, status: "occupied", occupantName: "Tenant One" });

    expect(res.status).toBe(200);
    expect(getDoc("units", "unit-1")).toMatchObject({ unitNumber: "101A", rent: 1900, status: "occupied", occupancyStatus: "occupied", occupantName: "Tenant One", tenantId: "tenant-1", currentLeaseId: "lease-1" });
    expect(getDoc("properties", "prop-1").units[0]).toMatchObject({ unitNumber: "101A", rent: 1900, status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1", currentLeaseId: "lease-1" });
  });

  it("returns UNIT_ID_UNRESOLVED when updating a placeholder unit", async () => {
    const app = await createApp();

    const res = await request(app).patch("/api/units/placeholder-0").send({
      status: "occupied",
      occupantName: "Jane Tenant",
      leaseEndDate: "2027-06-10",
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      error: "UNIT_ID_UNRESOLVED",
      code: "UNIT_ID_UNRESOLVED",
    });
  });

  it("returns persisted IDs when creating vacant units for a property", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    const app = await createApp();

    const res = await request(app)
      .post("/api/properties/prop-1/units")
      .send({
        units: [
          { unitNumber: "101", beds: 1, baths: 1, sqft: 500, marketRent: 1500, status: "vacant" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, created: 1 });
    expect(res.body.units).toHaveLength(1);
    expect(res.body.units[0]).toMatchObject({
      id: "units-auto-1",
      unitNumber: "101",
      propertyId: "prop-1",
      rent: 1500,
      marketRent: 1500,
      beds: 1,
      bedrooms: 1,
      baths: 1,
      bathrooms: 1,
      status: "vacant",
      occupancyStatus: "vacant",
      occupantName: null,
      tenantName: null,
      leaseEndDate: null,
    });
    expect(res.body.items).toEqual(res.body.units);
    expect(getDoc("properties", "prop-1")).toMatchObject({
      unitCount: 1,
      unitsCount: 1,
      units: [
        expect.objectContaining({
          id: "units-auto-1",
          unitNumber: "101",
          status: "vacant",
          occupantName: null,
          leaseEndDate: null,
        }),
      ],
    });
  });

  it.each(["occupied", "leased", "rented", " OCCUPIED "])("rejects unsupported standalone unit status %s without writes", async (status) => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    const app = await createApp();
    const res = await request(app).post("/api/properties/prop-1/units").send({ units: [{ unitNumber: "101", status }] });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "UNSUPPORTED_INITIAL_OCCUPANCY" });
    expect(getDoc("units", "units-auto-1")).toBeUndefined();
    expect(getDoc("properties", "prop-1")).toEqual({ landlordId: "landlord-1" });
  });
});
