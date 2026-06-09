import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, Record<string, unknown>>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

const dbMock = {
  collection: (name: string) => ({
    get: async () => ({
      docs: Array.from(ensureCollection(name).entries()).map(([id, value]) => ({
        id,
        data: () => clone(value),
      })),
    }),
  }),
};

vi.mock("../../firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: { headers: Record<string, string>; user?: Record<string, unknown> }, res: any, next: () => void) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (!header) return res.status(401).json({ ok: false, error: "unauthenticated" });
    req.user = JSON.parse(header);
    return next();
  },
}));

async function invokeRouter(
  router: { handle: (req: Record<string, unknown>, res: Record<string, unknown>, next: (error?: unknown) => void) => void },
  options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  }
) {
  return await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const req = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      headers: options.headers ?? {},
      query: options.query ?? {},
    };
    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error?: unknown) => {
      if (error) reject(error);
    });
  });
}

describe("unifiedInboxRoutes", () => {
  beforeEach(() => {
    collections.clear();
    ensureCollection("tenantNotifications").set("tenant-message-1", {
      id: "tenant-message-1",
      tenantWorkspaceId: "tenant-workspace-1",
      sourceKind: "tenant.message",
      title: "Message update",
      summary: "Your landlord replied.",
      createdAt: "2026-06-09T12:00:00.000Z",
    });
    ensureCollection("viewingRequests").set("viewing-1", {
      id: "viewing-1",
      landlordId: "landlord-1",
      tenantWorkspaceId: "tenant-workspace-1",
      applicantName: "Taylor Tenant",
      status: "scheduled",
      updatedAt: "2026-06-09T14:00:00.000Z",
    });
    ensureCollection("workOrders").set("work-order-1", {
      id: "work-order-1",
      landlordId: "landlord-1",
      assignedContractorId: "contractor-1",
      title: "Sink repair",
      category: "plumbing",
      status: "assigned",
      updatedAt: "2026-06-09T11:00:00.000Z",
    });
  });

  it("requires authentication before returning the shared inbox", async () => {
    const router = (await import("../../routes/unifiedInboxRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/inbox",
    });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("returns the tenant projection for tenant users", async () => {
    const router = (await import("../../routes/unifiedInboxRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/inbox",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-1",
          role: "tenant",
          tenantId: "tenant-1",
          tenantWorkspaceId: "tenant-workspace-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, role: "tenant", total: 2 });
    const json = JSON.stringify(res.body);
    expect(json).toContain("tenant.viewing");
    expect(json).not.toContain("tenant-workspace-1");
    expect(json).not.toContain("landlord-1");
  });

  it("returns the landlord projection and rejects tenant source filters", async () => {
    const router = (await import("../../routes/unifiedInboxRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/inbox",
      headers: {
        "x-test-user": JSON.stringify({ id: "landlord-1", role: "landlord", landlordId: "landlord-1" }),
      },
      query: { source: "landlord.work_order" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, role: "landlord", total: 1 });
    expect(JSON.stringify(res.body)).toContain("landlord.work_order");
    expect(JSON.stringify(res.body)).not.toContain("work-order-1");

    const forbiddenSource = await invokeRouter(router, {
      method: "GET",
      url: "/inbox",
      headers: {
        "x-test-user": JSON.stringify({ id: "landlord-1", role: "landlord", landlordId: "landlord-1" }),
      },
      query: { source: "tenant.message" },
    });
    expect(forbiddenSource.status).toBe(200);
    expect(forbiddenSource.body).toMatchObject({ ok: true, role: "landlord", total: 0 });
  });

  it("returns contractor events for contractor users and rejects unsupported roles", async () => {
    const router = (await import("../../routes/unifiedInboxRoutes")).default;

    const contractor = await invokeRouter(router, {
      method: "GET",
      url: "/inbox",
      headers: {
        "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor", contractorId: "contractor-1" }),
      },
    });
    expect(contractor.status).toBe(200);
    expect(contractor.body).toMatchObject({ ok: true, role: "contractor", total: 1 });
    expect(JSON.stringify(contractor.body)).not.toContain("contractor-1");

    const admin = await invokeRouter(router, {
      method: "GET",
      url: "/inbox",
      headers: {
        "x-test-user": JSON.stringify({ id: "admin-1", role: "admin" }),
      },
    });
    expect(admin.status).toBe(403);
    expect(admin.body).toMatchObject({ ok: false, error: "UNIFIED_INBOX_FORBIDDEN" });
  });
});
