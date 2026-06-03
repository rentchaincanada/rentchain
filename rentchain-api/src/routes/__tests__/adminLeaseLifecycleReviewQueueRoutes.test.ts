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
        doc(id: string) {
          return {
            async get() {
              const collection = ensureCollection(name);
              const data = collection.get(id);
              return {
                id,
                exists: Boolean(data),
                data: () => data,
              };
            },
            async set(payload: any, options?: { merge?: boolean }) {
              const collection = ensureCollection(name);
              const existing = collection.get(id) || {};
              collection.set(id, options?.merge ? { ...existing, ...payload } : payload);
            },
          };
        },
      }),
    },
  };
});

vi.mock("../../firebase", () => ({
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
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: Record<string, unknown> }
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
      body: options.body || {},
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
  email: "admin@example.com",
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

  it("merges acknowledgement state into the queue response", async () => {
    seedDoc("leases", "lease-unknown", {
      status: "active",
      propertyId: "property-1",
      unitId: "unit-2",
      landlordId: "landlord-1",
      startDate: "2026-12-31",
      endDate: "2026-01-01",
    });
    seedDoc("leaseLifecycleReviewAcknowledgements", "ack-1", {
      acknowledgementId: "ack-1",
      reviewItemId: "lease_lifecycle:lease-unknown:unknown_lifecycle",
      leaseId: "lease-unknown",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-2",
      status: "reviewed",
      note: "Reviewed by ops",
      acknowledgedBy: "admin-1",
      acknowledgedAt: "2026-05-05T12:00:00.000Z",
      updatedAt: "2026-05-05T12:00:00.000Z",
    });
    seedDoc("leaseLifecycleReviewHistory", "history-1", {
      historyId: "history-1",
      reviewItemId: "lease_lifecycle:lease-unknown:unknown_lifecycle",
      leaseId: "lease-unknown",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-2",
      action: "reviewed",
      previousStatus: null,
      nextStatus: "reviewed",
      note: "Reviewed by ops",
      actorId: "admin-1",
      actorEmail: "admin@example.com",
      createdAt: "2026-05-05T12:00:00.000Z",
    });

    const router = (await import("../adminLeasesRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/lease-lifecycle-review-queue?today=2026-05-05",
      user: adminUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        leaseId: "lease-unknown",
        acknowledgement: expect.objectContaining({
          reviewItemId: "lease_lifecycle:lease-unknown:unknown_lifecycle",
          status: "reviewed",
          note: "Reviewed by ops",
          acknowledgedBy: "admin-1",
        }),
        recentHistory: [
          expect.objectContaining({
            historyId: "history-1",
            action: "reviewed",
            nextStatus: "reviewed",
            note: "Reviewed by ops",
            actorId: "admin-1",
            actorEmail: "admin@example.com",
          }),
        ],
      })
    );
  });

  it("allows admins to mark review items reviewed without mutating leases", async () => {
    const originalLease = {
      status: "active",
      propertyId: "property-1",
      unitId: "unit-2",
      landlordId: "landlord-1",
      startDate: "2026-12-31",
      endDate: "2026-01-01",
    };
    seedDoc("leases", "lease-unknown", originalLease);

    const router = (await import("../adminLeasesRoutes")).default;
    const response = await invokeRouter(router, {
      method: "PATCH",
      url: "/lease-lifecycle-review-queue/lease_lifecycle%3Alease-unknown%3Aunknown_lifecycle/acknowledgement?today=2026-05-05",
      user: adminUser,
      body: {
        status: "reviewed",
        note: "Dates reviewed",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.acknowledgement).toEqual(
      expect.objectContaining({
        reviewItemId: "lease_lifecycle:lease-unknown:unknown_lifecycle",
        leaseId: "lease-unknown",
        status: "reviewed",
        note: "Dates reviewed",
        acknowledgedBy: "admin-1",
      })
    );
    expect(response.body.historyEvent).toEqual(
      expect.objectContaining({
        reviewItemId: "lease_lifecycle:lease-unknown:unknown_lifecycle",
        leaseId: "lease-unknown",
        action: "reviewed",
        previousStatus: null,
        nextStatus: "reviewed",
        note: "Dates reviewed",
        actorId: "admin-1",
        actorEmail: "admin@example.com",
      })
    );
    expect(Array.from(collections.get("leaseLifecycleReviewHistory")?.values() || [])).toEqual([
      expect.objectContaining({
        action: "reviewed",
        nextStatus: "reviewed",
        leaseId: "lease-unknown",
      }),
    ]);
    expect(collections.get("leases")?.get("lease-unknown")).toEqual({ id: "lease-unknown", ...originalLease });
  });

  it("allows admins to snooze and assign review items", async () => {
    const originalLease = {
      status: "active",
      propertyId: "property-1",
      unitId: "unit-2",
      landlordId: "landlord-1",
      startDate: "2026-12-31",
      endDate: "2026-01-01",
    };
    seedDoc("leases", "lease-unknown", originalLease);

    const router = (await import("../adminLeasesRoutes")).default;
    const snoozed = await invokeRouter(router, {
      method: "PATCH",
      url: "/lease-lifecycle-review-queue/lease_lifecycle%3Alease-unknown%3Aunknown_lifecycle/acknowledgement?today=2026-05-05",
      user: adminUser,
      body: {
        status: "snoozed",
        snoozedUntil: "2026-05-12T12:00:00.000Z",
      },
    });
    expect(snoozed.status).toBe(200);
    expect(snoozed.body.acknowledgement).toEqual(
      expect.objectContaining({
        status: "snoozed",
        snoozedUntil: "2026-05-12T12:00:00.000Z",
      })
    );
    expect(snoozed.body.historyEvent).toEqual(
      expect.objectContaining({
        action: "snoozed",
        nextStatus: "snoozed",
        snoozedUntil: "2026-05-12T12:00:00.000Z",
      })
    );

    const assigned = await invokeRouter(router, {
      method: "PATCH",
      url: "/lease-lifecycle-review-queue/lease_lifecycle%3Alease-unknown%3Aunknown_lifecycle/acknowledgement?today=2026-05-05",
      user: adminUser,
      body: {
        status: "assigned",
        assignedTo: "ops-admin-2",
      },
    });
    expect(assigned.status).toBe(200);
    expect(assigned.body.acknowledgement).toEqual(
      expect.objectContaining({
        status: "assigned",
        assignedTo: "ops-admin-2",
      })
    );
    expect(assigned.body.historyEvent).toEqual(
      expect.objectContaining({
        action: "assigned",
        previousStatus: "snoozed",
        nextStatus: "assigned",
        assignedTo: "ops-admin-2",
      })
    );
    expect(Array.from(collections.get("leaseLifecycleReviewHistory")?.values() || [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "snoozed", leaseId: "lease-unknown" }),
        expect.objectContaining({ action: "assigned", leaseId: "lease-unknown" }),
      ])
    );
    expect(collections.get("leases")?.get("lease-unknown")).toEqual({ id: "lease-unknown", ...originalLease });
  });

  it("blocks non-admin acknowledgement mutations", async () => {
    const router = (await import("../adminLeasesRoutes")).default;
    const response = await invokeRouter(router, {
      method: "PATCH",
      url: "/lease-lifecycle-review-queue/lease_lifecycle%3Alease-unknown%3Aunknown_lifecycle/acknowledgement",
      user: { id: "landlord-1", role: "landlord", permissions: [], revokedPermissions: [] },
      body: {
        status: "reviewed",
      },
    });

    expect(response.status).toBe(403);
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
