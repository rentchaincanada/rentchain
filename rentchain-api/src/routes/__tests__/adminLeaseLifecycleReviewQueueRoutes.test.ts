import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        async get() {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) {
    collections.set(collectionName, new Map<string, any>());
  }
  collections.get(collectionName)!.set(id, { id, ...data });
}

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

const adminUser = {
  id: "admin-1",
  role: "admin",
  permissions: [],
  revokedPermissions: [],
};

describe("admin lease lifecycle review queue route", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("requires admin permission", async () => {
    const router = (await import("../adminLeasesRoutes")).default;

    const unauthenticated = await invokeRouter(router, {
      method: "GET",
      url: "/lease-lifecycle-review-queue",
    });
    expect(unauthenticated.status).toBe(401);

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/lease-lifecycle-review-queue",
      user: { id: "landlord-1", role: "landlord", permissions: [], revokedPermissions: [] },
    });
    expect(forbidden.status).toBe(403);
  });

  it("returns stable queue summary and redacted review items for admin users", async () => {
    seedDoc("leases", "lease-active", {
      status: "active",
      propertyId: "property-1",
      unitId: "unit-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      tenantSignedAt: "2025-12-15T12:00:00.000Z",
      landlordSignedAt: "2025-12-16T12:00:00.000Z",
    });
    seedDoc("leases", "lease-unknown", {
      status: "active",
      propertyId: "property-1",
      unitId: "unit-2",
      landlordId: "landlord-1",
      startDate: "2026-12-31",
      endDate: "2026-01-01",
      tenantSignedAt: "2025-12-15T12:00:00.000Z",
      landlordSignedAt: "2025-12-16T12:00:00.000Z",
    });
    seedDoc("leases", "lease-conflict", {
      status: "active",
      propertyId: "property-2",
      unitId: "unit-3",
      landlordId: "landlord-2",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      tenantSignedAt: "2024-12-15T12:00:00.000Z",
      landlordSignedAt: "2024-12-16T12:00:00.000Z",
    });
    seedDoc("units", "unit-3", {
      status: "occupied",
      occupantName: "Manual Occupant",
      leaseEndDate: "2027-04-30",
    });

    const router = (await import("../adminLeasesRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/lease-lifecycle-review-queue?today=2026-05-05&limit=10",
      user: adminUser,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        summary: {
          total: 2,
          critical: 1,
          warning: 1,
          info: 0,
        },
      })
    );
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leaseId: "lease-unknown",
          category: "unknown_lifecycle",
          severity: "critical",
          recommendedAction: "Open lease record",
          createdFrom: "lease_lifecycle_review_queue_v1",
        }),
        expect.objectContaining({
          leaseId: "lease-conflict",
          category: "expired_occupancy_conflict",
          severity: "warning",
          recommendedAction: "Confirm occupancy manually",
        }),
      ])
    );
    expect(response.body.items[0]).not.toHaveProperty("raw");
    expect(response.body.items[0]).not.toHaveProperty("payload");
  });

  it("returns an empty queue for valid leases", async () => {
    seedDoc("leases", "lease-active", {
      status: "active",
      propertyId: "property-1",
      unitId: "unit-1",
      landlordId: "landlord-1",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      tenantSignedAt: "2025-12-15T12:00:00.000Z",
      landlordSignedAt: "2025-12-16T12:00:00.000Z",
    });

    const router = (await import("../adminLeasesRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/lease-lifecycle-review-queue?today=2026-05-05",
      user: adminUser,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      items: [],
      summary: {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
      },
    });
  });
});
