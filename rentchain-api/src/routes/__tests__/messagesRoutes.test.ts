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
    where: (field: string, _op: string, value: any) => ({
      orderBy: () => ({
        limit: (count: number) => ({
          get: async () => {
            const docs = Array.from(ensureCollection(name).entries())
              .filter(([, data]) => data?.[field] === value)
              .slice(0, count)
              .map(([id, data]) => ({ id, data: () => clone(data) }));
            return { docs };
          },
        }),
      }),
      limit: (count: number) => ({
        get: async () => {
          const docs = Array.from(ensureCollection(name).entries())
            .filter(([, data]) => data?.[field] === value)
            .slice(0, count)
            .map(([id, data]) => ({ id, data: () => clone(data) }));
          return { docs };
        },
      }),
      get: async () => {
        const docs = Array.from(ensureCollection(name).entries())
          .filter(([, data]) => data?.[field] === value)
          .map(([id, data]) => ({ id, data: () => clone(data) }));
        return { docs };
      },
    }),
  }),
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));
vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
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
vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));
vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: vi.fn(() => "<p>email</p>"),
  buildEmailText: vi.fn(() => "email"),
}));

async function createRouter() {
  return (await import("../messagesRoutes")).default;
}

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

describe("messagesRoutes notifications", () => {
  beforeEach(() => {
    collections.clear();
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
    process.env.EMAIL_FROM = "noreply@example.com";

    ensureCollection("conversations").set("conv-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
    });
    ensureCollection("properties").set("prop-1", {
      name: "Harbour View",
      units: [{ id: "unit-1", unitNumber: "2A" }],
    });
    ensureCollection("units").set("unit-1", {
      propertyId: "prop-1",
      unitNumber: "2A",
    });
    ensureCollection("users").set("landlord-1", {
      email: "landlord@example.com",
    });
  });

  it("emails tenant when landlord sends a message", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-1",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: { body: "Please confirm your move-in date." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["tenant@example.com"],
        subject: expect.stringContaining("New message from your landlord"),
      })
    );
  });

  it("emails tenant when landlord replies to an auth-id conversation hydrated by tenant email", async () => {
    ensureCollection("conversations").set("conv-auth-email", {
      landlordId: "landlord-1",
      tenantId: "auth-user-1",
      tenantEmail: "tenant@example.com",
      unitId: "unit-1",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-auth-email",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: { body: "Your landlord reply is ready." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["tenant@example.com"],
      })
    );
  });

  it("emails tenant when landlord replies to a unit-linked conversation resolved through an active lease", async () => {
    ensureCollection("conversations").set("conv-unit-only", {
      landlordId: "landlord-1",
      tenantId: null,
      propertyId: null,
      unitId: "unit-1",
    });
    ensureCollection("leases").set("lease-unit-only", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-unit-only",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: { body: "Unit-linked reply." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["tenant@example.com"],
      })
    );
  });

  it("does not fail landlord send when tenant email is missing", async () => {
    ensureCollection("conversations").set("conv-no-email", {
      landlordId: "landlord-1",
      tenantId: "tenant-no-email",
    });
    ensureCollection("tenants").set("tenant-no-email", {
      fullName: "No Email Tenant",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-no-email",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: { body: "This should persist without email." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("emails landlord when tenant sends a message", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/tenant/messages/conversation/conv-1",
      headers: { "x-test-user": JSON.stringify({ id: "tenant-user-1", tenantId: "tenant-1", landlordId: "landlord-1", role: "tenant" }) },
      body: { body: "I can confirm by Friday." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("returns landlord-safe conversation display labels", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversations?.[0]).toEqual(
      expect.objectContaining({
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      })
    );
  });

  it("preserves landlord message scope fallback from user id when landlordId is absent", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "conv-1",
          tenantDisplayName: "Taylor Tenant",
        }),
      ])
    );
  });

  it("enriches older conversations from tenant-linked property and unit context when available", async () => {
    ensureCollection("conversations").set("conv-2", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: null,
      unitId: null,
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
      propertyId: "prop-1",
      unit: "2A",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "conv-2",
          tenantDisplayName: "Taylor Tenant",
          propertyDisplayLabel: "Harbour View",
          unitDisplayLabel: "Unit 2A",
        }),
      ])
    );
  });

  it("hydrates sparse message conversations from tenant email and current lease context", async () => {
    ensureCollection("conversations").set("conv-lease", {
      landlordId: "landlord-1",
      tenantId: "tenant-lease",
      propertyId: null,
      unitId: null,
    });
    ensureCollection("tenants").set("tenant-lease", {
      email: "lease.tenant@example.com",
      currentLeaseId: "lease-1",
    });
    ensureCollection("leases").set("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-lease",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "conv-lease",
          tenantDisplayName: "lease.tenant@example.com",
          propertyDisplayLabel: "Harbour View",
          unitDisplayLabel: "Unit 2A",
        }),
      ])
    );
  });

  it("hydrates landlord conversations from tenant email and unit records when tenantId is an auth id", async () => {
    ensureCollection("conversations").set("conv-auth", {
      landlordId: "landlord-1",
      tenantId: "auth-user-1",
      tenantEmail: "tenant@example.com",
      propertyId: null,
      unitId: null,
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
      propertyId: "prop-1",
      unitId: "unit-1",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    const conversation = res.body?.conversations?.find((item: any) => item.id === "conv-auth");
    expect(conversation).toEqual(
      expect.objectContaining({
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      })
    );
    expect(`${conversation?.tenantDisplayName} • ${conversation?.unitDisplayLabel}`).not.toBe("Tenant • Assigned unit");
  });

  it("hydrates unit-linked landlord conversations from active lease context", async () => {
    ensureCollection("conversations").set("conv-unit-only", {
      landlordId: "landlord-1",
      tenantId: null,
      propertyId: null,
      unitId: "unit-1",
    });
    ensureCollection("leases").set("lease-unit-only", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    const conversation = res.body?.conversations?.find((item: any) => item.id === "conv-unit-only");
    expect(conversation).toEqual(
      expect.objectContaining({
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      })
    );
    expect(`${conversation?.tenantDisplayName} • ${conversation?.unitDisplayLabel}`).not.toBe("Tenant • Linked unit");
  });

  it("stores deterministic property context when tenant conversation is created", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation",
      headers: { "x-test-user": JSON.stringify({ id: "tenant-user-1", tenantId: "tenant-1", landlordId: "landlord-1", unitId: "unit-1", role: "tenant" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversation).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitId: "unit-1",
      })
    );
  });

  it("returns enriched tenant conversation detail without raw ids in labels", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation/conv-1",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-user-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          role: "tenant",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversation).toEqual(
      expect.objectContaining({
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      })
    );
  });
});
