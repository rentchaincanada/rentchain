import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}));

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

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));
vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));
vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: vi.fn(() => "<p>email</p>"),
  buildEmailText: vi.fn(() => "email"),
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

describe("tenant communications routes", () => {
  beforeEach(() => {
    collections.clear();
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
    process.env.EMAIL_FROM = "noreply@example.com";
    ensureCollection("properties").set("prop-1", {
      rc_prop_id: "rc-prop-1",
      landlordId: "landlord-1",
      street1: "123 Main St",
    });
    ensureCollection("users").set("landlord-1", {
      email: "landlord@example.com",
    });
    ensureCollection("applications").set("app-1", {
      applicantEmail: "tenant@example.com",
      propertyId: "prop-1",
      status: "submitted",
    });
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "active",
    });
    ensureCollection("conversations").set("landlord-1__tenant-1__na", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      lastMessageAt: "2026-01-03T00:00:00.000Z",
      lastReadAtTenant: "2026-01-01T00:00:00.000Z",
    });
    ensureCollection("messages").set("msg-1", {
      conversationId: "landlord-1__tenant-1__na",
      senderRole: "landlord",
      body: "Please confirm your move-in timing.",
      createdAtMs: Date.parse("2026-01-02T00:00:00.000Z"),
    });
    ensureCollection("messages").set("msg-2", {
      conversationId: "landlord-1__tenant-1__na",
      senderRole: "tenant",
      body: "I can confirm by Friday.",
      createdAtMs: Date.parse("2026-01-03T00:00:00.000Z"),
    });
    ensureCollection("event_log").clear();
  });

  it("rejects unauthorized communications access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/communications" });
    expect(res.status).toBe(401);
  });

  it("returns only tenant-scoped thread messages", async () => {
    ensureCollection("messages").set("msg-3", {
      conversationId: "landlord-1__other-tenant__na",
      senderRole: "landlord",
      body: "Should not leak",
      createdAtMs: Date.parse("2026-01-04T00:00:00.000Z"),
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/communications",
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
    expect(res.body?.data?.thread?.messages).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain("Should not leak");
    expect(res.body?.data?.thread?.unreadCount).toBe(1);
  });

  it("send path respects authority context and records a scoped message", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/communications/messages",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
          leaseId: "lease-1",
        }),
      },
      body: {
        body: "Can we schedule key pickup tomorrow?",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.data?.body).toContain("key pickup");
    const writtenMessages = Array.from(ensureCollection("messages").values()).filter(
      (entry) => entry?.body === "Can we schedule key pickup tomorrow?"
    );
    expect(writtenMessages).toHaveLength(1);
    expect(Array.from(ensureCollection("event_log").values()).some((event) => event.event_type === "tenant_message_sent")).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});
