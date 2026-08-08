import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}));

const collections = new Map<string, Map<string, any>>();
const originalEnv = process.env;

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
vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    return next();
  },
}));
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    return next();
  },
}));
vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
  sendWaitlistConfirmation: vi.fn(),
}));
vi.mock("../../services/tenantDetailsService", () => ({
  getTenantsList: vi.fn(),
  getTenantDetailBundle: vi.fn(),
}));
vi.mock("../../services/stripeService", () => ({
  getStripeClient: vi.fn(),
  isStripeConfigured: vi.fn(() => false),
  STRIPE_API_VERSION: "2024-06-20",
}));
vi.mock("../onboardingRoutes", () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../../services/screening/providerHealth", () => ({
  getScreeningProviderHealth: vi.fn(() => ({ ok: true })),
}));
vi.mock("../../services/screening/inviteTokens", () => ({
  hashInviteToken: vi.fn((value: string) => value),
}));
vi.mock("../../services/screening/screeningEvents", () => ({
  writeScreeningEvent: vi.fn(),
}));
vi.mock("../../services/screening/providers/bureauProvider", () => ({
  getBureauProvider: vi.fn(() => null),
}));
vi.mock("../../config/planMatrix", () => ({
  getPricingHealth: vi.fn(() => ({ ok: true })),
}));
vi.mock("../../config/requiredEnv", () => ({
  getEnvFlags: vi.fn(() => ({})),
}));
vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: vi.fn(() => "<p>email</p>"),
  buildEmailText: vi.fn(() => "email"),
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  return await new Promise<{ status: number; body: any; headers: Record<string, string> }>((resolve, reject) => {
    const headers: Record<string, string> = {};
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
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("publicRoutes message endpoints", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    collections.clear();
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
    process.env.EMAIL_FROM = "noreply@example.com";
    ensureCollection("conversations").set("conv-unit-only", {
      landlordId: "landlord-1",
      tenantId: null,
      propertyId: null,
      unitId: "unit-1",
      lastMessageAt: 2000,
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
    });
    ensureCollection("leases").set("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
    });
    ensureCollection("properties").set("prop-1", {
      name: "Harbour View",
    });
    ensureCollection("units").set("unit-1", {
      propertyId: "prop-1",
      unitNumber: "2A",
    });
    ensureCollection("users").set("landlord-1", {
      email: "landlord@example.com",
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function enablePreviewQaAuth() {
    process.env.PREVIEW_QA_AUTH_ENABLED = "true";
    process.env.PREVIEW_QA_AUTH_SCOPE = "pr1509-unified-inbox";
    process.env.APP_ENV = "preview";
    process.env.GOOGLE_CLOUD_PROJECT = "rentchain-preview";
    process.env.K_SERVICE = "rentchain-pr1509-inbox-qa-7255f05e";
    process.env.PREVIEW_QA_EXPECTED_SERVICE = "rentchain-pr1509-inbox-qa-7255f05e";
    process.env.FIRESTORE_ENABLED = "true";
    process.env.FIRESTORE_DATABASE_ID = "(default)";
  }

  it("serves landlord messages through publicRoutes with active lease labels", async () => {
    const router = (await import("../publicRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: {
        "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("publicRoutes.ts");
    expect(res.body?.conversations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "conv-unit-only",
          tenantDisplayName: "Taylor Tenant",
          propertyDisplayLabel: "Harbour View",
          unitDisplayLabel: "Unit 2A",
        }),
      ])
    );
  });

  it("allows the isolated Preview QA identity through the preempting conversation-list route", async () => {
    enablePreviewQaAuth();
    ensureCollection("conversations").set("qa-conversation", {
      landlordId: "qa-pr1509-landlord",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      lastMessageAt: 3000,
    });
    const router = (await import("../publicRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-rentchain-preview-qa-identity": "pr1509-landlord" },
    });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("publicRoutes.ts");
    expect(res.body?.conversations).toEqual([
      expect.objectContaining({ id: "qa-conversation", landlordId: "qa-pr1509-landlord" }),
    ]);
  });

  it("allows the isolated Preview QA identity through the preempting conversation-detail route", async () => {
    enablePreviewQaAuth();
    ensureCollection("conversations").set("qa-conversation", {
      landlordId: "qa-pr1509-landlord",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      lastMessageAt: 3000,
    });
    ensureCollection("messages").set("qa-message", {
      conversationId: "qa-conversation",
      senderRole: "tenant",
      body: "Scoped QA message",
      createdAt: 3000,
    });
    const router = (await import("../publicRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations/qa-conversation",
      headers: { "x-rentchain-preview-qa-identity": "pr1509-landlord" },
    });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("publicRoutes.ts");
    expect(res.body).toMatchObject({
      ok: true,
      conversation: { id: "qa-conversation", landlordId: "qa-pr1509-landlord" },
      messages: [expect.objectContaining({ id: "qa-message", body: "Scoped QA message" })],
    });
  });

  it.each([
    ["Production project", () => (process.env.GOOGLE_CLOUD_PROJECT = "project-0d9658de-af29-4dc0-a99")],
    ["permanent Preview service", () => (process.env.K_SERVICE = "rentchain-preview-backend")],
    ["missing QA flag", () => delete process.env.PREVIEW_QA_AUTH_ENABLED],
    ["wrong expected service", () => (process.env.PREVIEW_QA_EXPECTED_SERVICE = "rentchain-pr1509-inbox-qa-deadbeef")],
  ])("rejects the synthetic selector in %s", async (_label, mutateEnvironment) => {
    enablePreviewQaAuth();
    mutateEnvironment();
    const router = (await import("../publicRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-rentchain-preview-qa-identity": "pr1509-landlord" },
    });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("rejects an unknown synthetic identity", async () => {
    enablePreviewQaAuth();
    const router = (await import("../publicRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-rentchain-preview-qa-identity": "unknown-landlord" },
    });

    expect(res.status).toBe(401);
  });

  it("does not let an invalid bearer token fall through to synthetic QA authentication", async () => {
    enablePreviewQaAuth();
    const router = (await import("../publicRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: {
        authorization: "Bearer invalid-token",
        "x-rentchain-preview-qa-identity": "pr1509-landlord",
      },
    });

    expect(res.status).toBe(401);
  });

  it("fails closed for foreign and missing conversation detail under synthetic QA auth", async () => {
    enablePreviewQaAuth();
    ensureCollection("conversations").set("foreign-conversation", {
      landlordId: "foreign-landlord",
      tenantId: "tenant-1",
    });
    const router = (await import("../publicRoutes")).default;
    const headers = { "x-rentchain-preview-qa-identity": "pr1509-landlord" };

    const foreign = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations/foreign-conversation",
      headers,
    });
    const missing = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations/missing-conversation",
      headers,
    });

    expect(foreign.status).toBe(403);
    expect(missing.status).toBe(404);
  });

  it("keeps synthetic Preview QA authentication disabled on message writes", async () => {
    enablePreviewQaAuth();
    const router = (await import("../publicRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-unit-only",
      headers: { "x-rentchain-preview-qa-identity": "pr1509-landlord" },
      body: { body: "must not be written" },
    });

    expect(res.status).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends tenant email notifications for landlord replies on unit-linked conversations", async () => {
    const router = (await import("../publicRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-unit-only",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          landlordId: "landlord-1",
          role: "landlord",
          email: "landlord@example.com",
        }),
      },
      body: { body: "Please review the latest message." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tenant@example.com",
        subject: "New message on RentChain",
      })
    );
  });

  it("does not send tenant notifications to the landlord request user email", async () => {
    const router = (await import("../publicRoutes")).default;
    await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-unit-only",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          landlordId: "landlord-1",
          role: "landlord",
          email: "landlord@example.com",
        }),
      },
      body: { body: "Recipient should be the tenant." },
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0]?.[0]?.to).toBe("tenant@example.com");
    expect(sendEmailMock.mock.calls[0]?.[0]?.to).not.toBe("landlord@example.com");
  });
});
