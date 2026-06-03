import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map<string, any>());
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function applyFilters(rows: Array<[string, any]>, filters: Array<{ field: string; op: string; value: any }>) {
  return rows.filter(([, data]) =>
    filters.every((filter) => {
      const current = data?.[filter.field];
      if (filter.op === "==") return current === filter.value;
      if (filter.op === "array-contains") return Array.isArray(current) && current.includes(filter.value);
      return false;
    })
  );
}

function createQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
  const api: any = {
    where(field: string, op: string, value: any) {
      return createQuery(name, [...filters, { field, op, value }]);
    },
    orderBy() {
      return api;
    },
    limit(count: number) {
      return {
        get: async () => {
          const docs = applyFilters(Array.from(ensureCollection(name).entries()), filters)
            .slice(0, count)
            .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));
          return { docs, empty: docs.length === 0 };
        },
      };
    },
    async get() {
      const docs = applyFilters(Array.from(ensureCollection(name).entries()), filters).map(([id, data]) => ({
        id,
        exists: true,
        data: () => clone(data),
      }));
      return { docs, empty: docs.length === 0 };
    },
  };
  return api;
}

const dbMock = {
  collection: (name: string) => ({
    doc: (id?: string) => {
      const docId = id || `doc_${ensureCollection(name).size + 1}`;
      return {
        id: docId,
        get: async () => ({
          id: docId,
          exists: ensureCollection(name).has(docId),
          data: () => clone(ensureCollection(name).get(docId)),
        }),
        set: async (value: any, opts?: { merge?: boolean }) => {
          const current = ensureCollection(name).get(docId) || {};
          ensureCollection(name).set(docId, opts?.merge ? { ...current, ...clone(value) } : clone(value));
        },
      };
    },
    where: (field: string, op: string, value: any) => createQuery(name, [{ field, op, value }]),
  }),
};

vi.mock("../../firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) req.user = JSON.parse(header);
    next();
  },
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      query: {},
      params: {},
    };
    const res: any = {
      statusCode: 200,
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

describe("tenant notifications route", () => {
  beforeEach(() => {
    collections.clear();
    ensureCollection("properties").set("prop-1", {
      rc_prop_id: "rc-prop-1",
      landlordId: "landlord-1",
      street1: "123 Main St",
      city: "Halifax",
      province: "NS",
    });
    ensureCollection("applications").set("app-1", {
      applicantEmail: "tenant@example.com",
      propertyId: "prop-1",
      status: "submitted",
      missingSteps: ["upload_id"],
      nextActions: ["upload government id"],
      updatedAt: "2026-01-03T00:00:00.000Z",
      rawDecisionNotes: "private",
    });
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "active",
      startDate: "2026-02-01",
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
    });
    ensureCollection("maintenanceRequests").set("maint-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      title: "Leaky faucet",
      status: "submitted",
      updatedAt: "2026-01-04T00:00:00.000Z",
    });
    ensureCollection("tenancy_invites").set("invite-1", {
      redeemed_by_uid: "user-1",
      created_at: "2026-01-02T00:00:00.000Z",
      token_hash: "secret-token-hash",
    });
    ensureCollection("messages").set("msg-1", {
      conversationId: "landlord-1__tenant-1__na",
      senderRole: "landlord",
      body: "Welcome to your new place.",
      createdAtMs: 1500,
    });
  });

  it("returns tenant-safe feed items only", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/notifications",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
          leaseId: "lease-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    const applicationItem = res.body?.data.find((item: any) => item.type === "application");
    const maintenanceItem = res.body?.data.find((item: any) => item.type === "maintenance");
    const messageItem = res.body?.data.find((item: any) => item.type === "message");
    expect(applicationItem).toBeTruthy();
    expect(maintenanceItem).toBeTruthy();
    expect(messageItem).toBeTruthy();
    expect(applicationItem?.sourceRefs?.[0]).toEqual(
      expect.objectContaining({
        sourceType: "application",
        label: "Application",
      })
    );
    expect(maintenanceItem?.relatedPath).toBe("/tenant/maintenance");
    expect(res.body?.data.every((item: any) => typeof item.read === "boolean")).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("secret-token-hash");
    expect(JSON.stringify(res.body)).not.toContain("rawDecisionNotes");
    expect(JSON.stringify(res.body)).not.toContain("app-1");
    expect(JSON.stringify(res.body)).not.toContain("lease-1");
    expect(JSON.stringify(res.body)).not.toContain("maint-1");
    expect(JSON.stringify(res.body)).not.toContain("msg-1");
    expect(JSON.stringify(res.body)).not.toContain("invite-1");
  });

  it("rejects unauthenticated notification and activity requests", async () => {
    const router = (await import("../tenantPortalRoutes")).default;

    const notificationsRes = await invokeRouter(router, {
      method: "GET",
      url: "/notifications",
    });
    const activityRes = await invokeRouter(router, {
      method: "GET",
      url: "/activity",
    });

    expect(notificationsRes.status).toBe(401);
    expect(notificationsRes.body?.error).toBe("UNAUTHORIZED");
    expect(activityRes.status).toBe(401);
    expect(activityRes.body?.error).toBe("UNAUTHORIZED");
  });

  it("fails closed when tenant identity resolves to multiple property contexts", async () => {
    ensureCollection("properties").set("prop-2", {
      rc_prop_id: "rc-prop-2",
      landlordId: "landlord-2",
    });
    ensureCollection("tenants").set("tenant-2", {
      email: "tenant@example.com",
      propertyId: "prop-2",
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/notifications",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-2",
        }),
      },
    });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("AMBIGUOUS_TENANCY_CONTEXT");
  });

  it("uses safe fallbacks for incomplete source documents", async () => {
    ensureCollection("maintenanceRequests").set("maint-raw-missing", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/notifications",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
          leaseId: "lease-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    const fallbackItem = res.body?.data.find((item: any) => item.title === "Maintenance request");
    expect(fallbackItem).toEqual(
      expect.objectContaining({
        type: "maintenance",
        summary: "Status: submitted",
        relatedPath: "/tenant/maintenance",
      })
    );
    expect(JSON.stringify(fallbackItem)).not.toContain("maint-raw-missing");
  });

  it("marks notification read state idempotently with normalized timestamps", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const headers = {
      "x-test-user": JSON.stringify({
        id: "user-1",
        email: "tenant@example.com",
        role: "tenant",
        tenantId: "tenant-1",
        leaseId: "lease-1",
      }),
    };

    const feed = await invokeRouter(router, {
      method: "GET",
      url: "/notifications",
      headers,
    });
    const item = feed.body?.data.find((entry: any) => entry.type === "maintenance");
    expect(item?.id).toBeTruthy();

    const firstRead = await invokeRouter(router, {
      method: "POST",
      url: `/notifications/${item.id}/read`,
      headers,
    });
    const secondRead = await invokeRouter(router, {
      method: "POST",
      url: `/notifications/${item.id}/read`,
      headers,
    });

    expect(firstRead.status).toBe(200);
    expect(secondRead.status).toBe(200);
    expect(secondRead.body?.readAt).toBe(firstRead.body?.readAt);
    expect(ensureCollection("tenantNotificationReads").size).toBe(1);

    const refreshed = await invokeRouter(router, {
      method: "GET",
      url: "/notifications",
      headers,
    });
    const refreshedItem = refreshed.body?.data.find((entry: any) => entry.id === item.id);
    expect(refreshedItem?.read).toBe(true);
    expect(typeof refreshedItem?.readAt).toBe("number");
    expect(refreshedItem.readAt).toBeLessThanOrEqual(Date.parse(refreshedItem.createdAt));
  });

  it("rejects read-state updates for notifications outside the tenant feed", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/notifications/maintenance-not-owned/read",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
          leaseId: "lease-1",
        }),
      },
    });

    expect(res.status).toBe(404);
    expect(res.body?.error).toBe("NOTIFICATION_NOT_FOUND");
  });
});
