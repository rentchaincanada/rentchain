import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthUser: null as any,
  signAuthTokenMock: vi.fn(),
  logEventMock: vi.fn(),
  tenantDocs: new Map<string, any>(),
}));

vi.mock("../../firebase", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (name !== "tenants") return { exists: false, data: () => null };
          const data = mocks.tenantDocs.get(id);
          return { exists: Boolean(data), data: () => data };
        },
      }),
    }),
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mocks.requireAuthUser) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = mocks.requireAuthUser;
    return next();
  },
}));

vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    if (req.user?.role !== "admin" && !permissions.includes("system.admin")) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    return next();
  },
}));

vi.mock("../../auth/jwt", () => ({
  signAuthToken: mocks.signAuthTokenMock,
}));

vi.mock("../../services/telemetryService", () => ({
  logEvent: mocks.logEventMock,
}));

function createReq(options: {
  method: string;
  url: string;
  body?: Record<string, unknown>;
  user?: Record<string, unknown> | null;
}) {
  const [path] = options.url.split("?");
  const startMatch = path.match(/^\/landlord\/tenants\/([^/]+)\/impersonate$/);
  const endMatch = path.match(/^\/landlord\/tenants\/([^/]+)\/impersonate\/end$/);
  mocks.requireAuthUser = options.user ?? mocks.requireAuthUser;
  return {
    method: options.method,
    url: options.url,
    originalUrl: options.url,
    path,
    params: { tenantId: decodeURIComponent((startMatch || endMatch)?.[1] || "") },
    body: options.body || {},
    headers: {},
    user: mocks.requireAuthUser,
  } as any;
}

function createRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    setHeader(name: string, value: string) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as any;
}

async function invokeRouter(router: any, req: any) {
  return await new Promise<{ status: number; body: any; headers: Record<string, string> }>((resolve, reject) => {
    const res = createRes();
    router.handle(req, res, (error: unknown) => {
      if (error) reject(error);
      else resolve({ status: res.statusCode, body: res.body, headers: res.headers });
    });
    setTimeout(() => resolve({ status: res.statusCode, body: res.body, headers: res.headers }), 0);
  });
}

describe("impersonationRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.tenantDocs.clear();
    mocks.requireAuthUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
    mocks.signAuthTokenMock.mockReturnValue("signed-impersonation-token");
    mocks.logEventMock.mockResolvedValue(undefined);
    mocks.tenantDocs.set("tenant-1", {
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      email: "tenant@example.test",
      rawProviderPayload: "must-not-leak",
    });
  });

  it("requires admin/system permission and a governed reason before issuing impersonation", async () => {
    const router = (await import("../impersonationRoutes")).default;

    const landlordRes = await invokeRouter(
      router,
      createReq({
        method: "POST",
        url: "/landlord/tenants/tenant-1/impersonate",
        body: { reasonCategory: "customer_support" },
        user: { id: "landlord-1", role: "landlord", permissions: [] },
      })
    );
    expect(landlordRes.status).toBe(403);

    const missingReason = await invokeRouter(
      router,
      createReq({
        method: "POST",
        url: "/landlord/tenants/tenant-1/impersonate",
        body: {},
        user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
      })
    );
    expect(missingReason.status).toBe(400);
    expect(missingReason.body.error).toBe("impersonation_reason_required");
  });

  it("issues short-lived impersonation tokens with actor-chain claims and safe audit telemetry", async () => {
    const router = (await import("../impersonationRoutes")).default;
    const res = await invokeRouter(
      router,
      createReq({
        method: "POST",
        url: "/landlord/tenants/tenant-1/impersonate",
        body: { reasonCategory: "incident_review" },
        user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("impersonationRoutes");
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        token: "signed-impersonation-token",
        tenantId: "tenant-1",
      })
    );
    expect(res.body.impersonation).toEqual(
      expect.objectContaining({
        state: "active",
        reasonCategory: "incident_review",
        targetAccountType: "tenant",
        targetAccountId: "tenant-1",
        metadataOnly: true,
        tenantVisible: false,
      })
    );
    expect(mocks.signAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "tenant-1",
        role: "tenant",
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        realActorId: "admin-1",
        realActorRole: "admin",
        effectiveActorId: "tenant-1",
        effectiveActorRole: "tenant",
        impersonationReason: "incident_review",
      }),
      { expiresIn: "15m" }
    );
    expect(mocks.logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "impersonation.started",
        landlordId: "landlord-1",
        actor: "admin-1",
        meta: expect.objectContaining({
          realActorId: "admin-1",
          effectiveActorId: "tenant-1",
          targetAccountId: "tenant-1",
          tenantVisible: false,
          metadataOnly: true,
        }),
      })
    );
    const serialized = JSON.stringify(mocks.logEventMock.mock.calls[0][0]);
    expect(serialized).not.toContain("tenant@example.test");
    expect(serialized).not.toContain("rawProviderPayload");
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("signed-impersonation-token");
  });

  it("records safe impersonation end audit telemetry", async () => {
    const router = (await import("../impersonationRoutes")).default;
    const res = await invokeRouter(
      router,
      createReq({
        method: "POST",
        url: "/landlord/tenants/tenant-1/impersonate/end",
        body: { sessionId: "session-1", reasonCategory: "incident_review" },
        user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
      })
    );

    expect(res.status).toBe(200);
    expect(res.body.impersonation).toEqual(
      expect.objectContaining({
        sessionId: "session-1",
        state: "ended",
        targetAccountId: "tenant-1",
        tenantVisible: false,
        metadataOnly: true,
      })
    );
    expect(mocks.logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "impersonation.ended",
        actor: "admin-1",
        meta: expect.objectContaining({
          sessionId: "session-1",
          lifecycleState: "ended",
          realActorId: "admin-1",
          effectiveActorId: "tenant-1",
        }),
      })
    );
  });
});
