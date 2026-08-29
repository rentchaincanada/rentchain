import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanonicalLeaseOccupancyProjection } from "../../lib/leases/canonicalLeaseOccupancyProjection";
import { deriveCanonicalLeaseTermState } from "../../lib/leases/canonicalLeaseOccupancyState";
import { evaluateCanonicalLeaseStart } from "../../lib/leases/canonicalLeaseStart";

const { collections, resetDb } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  return { collections, resetDb: () => collections.clear() };
});

function collection(name: string) {
  let rows = collections.get(name);
  if (!rows) { rows = new Map(); collections.set(name, rows); }
  return rows;
}

vi.mock("../../firebase", () => ({
  db: { collection: (name: string) => ({
    doc: (id: string) => ({ set: async (value: any, options?: { merge?: boolean }) => {
      const current = collection(name).get(id) || {};
      collection(name).set(id, options?.merge ? { ...current, ...value } : value);
    } }),
    add: async (value: any) => {
      const id = `${name}-${collection(name).size + 1}`;
      collection(name).set(id, value);
      return { id, set: async (patch: any, options?: { merge?: boolean }) => {
        const current = collection(name).get(id) || {};
        collection(name).set(id, options?.merge ? { ...current, ...patch } : patch);
      } };
    },
  }) },
}));

vi.mock("../../middleware/requireAuth", () => ({ requireAuth: (req: any, _res: any, next: any) => {
  req.user ||= { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
  next();
} }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "password-hash") } }));
vi.mock("firebase-admin", () => ({ default: { firestore: { FieldValue: { serverTimestamp: () => "server-timestamp" } } } }));

async function invokeRouter(router: any, options: { method: string; url: string; body?: any }) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = { method: options.method, url: options.url, originalUrl: options.url, path: options.url,
      body: options.body || {}, headers: {}, query: {}, user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" } };
    const res: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { resolve({ status: this.statusCode, body: payload }); return this; },
      send(payload: any) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    router.handle(req, res, (error: any) => error ? reject(error) : resolve({ status: 404, body: null }));
  });
}

describe("tenant current-state writer guards", () => {
  beforeEach(resetDb);

  it("onboards a tenant and incomplete lease without creating current occupancy", async () => {
    const router = (await import("../tenantOnboardRoutes")).default;
    const response = await invokeRouter(router, { method: "POST", url: "/tenants/onboard", body: {
      fullName: "Taylor Tenant", email: "tenant@example.com", propertyId: "property-1",
      propertyName: "Harbour House", unit: "1A", moveInDate: "2026-09-01", monthlyRent: 1800,
    } });

    expect(response.status).toBe(201);
    const tenant = [...collection("tenants").values()][0];
    const lease = [...collection("leases").values()][0];
    expect(tenant).toMatchObject({ status: "invited", currentLeaseId: null });
    expect(lease).not.toHaveProperty("occupancyEffective", true);
    const lifecycle = deriveCanonicalLeaseTermState({ id: "onboarding-lease", ...lease }, "2026-09-01T12:00:00.000Z");
    expect(lifecycle).toMatchObject({ state: "unknown", supportsCurrentOccupancy: false });
    const startEligibility = evaluateCanonicalLeaseStart({
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      tenantId: tenant.id,
      evaluationInstant: "2026-09-01T12:00:00.000Z",
      candidateLease: { id: "onboarding-lease", ...lease },
      contextLeases: [],
      standaloneUnits: [{ id: "unit-1", landlordId: "landlord-1", propertyId: "property-1", status: "vacant" }],
      embeddedUnits: [{ id: "unit-1", landlordId: "landlord-1", propertyId: "property-1", status: "vacant" }],
      tenant,
      tenancies: [],
    });
    expect(startEligibility).toMatchObject({ outcome: "rejected", occupancyEffective: false, reasons: ["CURRENT_LEASE_CONTEXT_MISMATCH"] });
    expect(collection("units")).toHaveLength(0);
    expect(collection("tenancies")).toHaveLength(0);
    expect(collection("canonicalEvents")).toHaveLength(0);

    const canonicalState = buildCanonicalLeaseOccupancyProjection({
      leases: [{ id: "onboarding-lease", ...lease }],
      context: { landlordId: "landlord-1", propertyId: "property-1", tenantId: tenant.id },
      persistedTenantStatus: tenant.status, currentLeasePointerId: tenant.currentLeaseId, tenantId: tenant.id,
    });
    expect(canonicalState.reasons).not.toContain("TENANT_CURRENT_WITHOUT_CURRENT_LEASE");
    expect(canonicalState.tenantRelationshipState).not.toBe("current_occupant");
  });

  it("defaults admin-created tenants to invited without occupancy side effects", async () => {
    const router = (await import("../adminTenantToolsRoutes")).default;
    const response = await invokeRouter(router, { method: "POST", url: "/create",
      body: { email: "tenant@example.com", password: "safe-test-password" } });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("invited");
    expect([...collection("tenants").values()][0]).toMatchObject({ status: "invited", currentLeaseId: null });
    expect(collection("leases")).toHaveLength(0);
    expect(collection("units")).toHaveLength(0);
    expect(collection("tenancies")).toHaveLength(0);
    expect(collection("canonicalEvents")).toHaveLength(0);
  });

  it.each(["active", "current", "occupied", "leased", "rented", " ACTIVE "])(
    "rejects unguarded admin current-like status %j", async (status) => {
      const router = (await import("../adminTenantToolsRoutes")).default;
      const response = await invokeRouter(router, { method: "POST", url: "/create",
        body: { email: "tenant@example.com", password: "safe-test-password", status } });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("current tenant status requires canonical occupancy authority");
      expect(collection("tenants")).toHaveLength(0);
      expect(collection("leases")).toHaveLength(0);
      expect(collection("tenancies")).toHaveLength(0);
      expect(collection("canonicalEvents")).toHaveLength(0);
    }
  );
});
