import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
}));

const dbMock = {
  collection: () => ({
    doc: () => ({
      get: vi.fn(async () => ({ exists: false, data: () => undefined })),
      set: vi.fn(async () => undefined),
    }),
    where: () => ({
      limit: () => ({
        get: vi.fn(async () => ({ empty: true, docs: [] })),
      }),
    }),
  }),
};

const fieldValueMock = {
  serverTimestamp: () => "__server_timestamp__",
  arrayUnion: (...values: unknown[]) => values,
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: fieldValueMock,
}));

vi.mock("../../firebase", () => ({
  db: dbMock,
  firestore: dbMock,
  FieldValue: fieldValueMock,
}));

vi.mock("firebase-admin", () => ({
  default: {
    firestore: {
      FieldValue: fieldValueMock,
    },
  },
  db: {
    collection: dbMock.collection,
  },
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: mocks.sendEmail,
  sendLandlordWelcomeEmail: vi.fn(async () => ({ ok: true })),
}));

async function invokeRouter(
  router: any,
  options: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
    path?: string;
  }
) {
  return await new Promise<{ status: number; body: any; text: string }>((resolve, reject) => {
    const [pathWithQuery, queryRaw = ""] = options.url.split("?");
    const query = Object.fromEntries(new URLSearchParams(queryRaw));
    const headers = options.headers ?? {};
    let resolved = false;
    const finish = (response: { status: number; body: any; text: string }) => {
      if (resolved) return;
      resolved = true;
      resolve(response);
    };
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.path ?? pathWithQuery,
      body: options.body ?? {},
      headers,
      query,
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
      get(name: string) {
        return headers[name] ?? headers[name.toLowerCase()];
      },
      header(name: string) {
        return headers[name] ?? headers[name.toLowerCase()];
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return this.headers[name.toLowerCase()];
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        finish({ status: this.statusCode, body: payload, text: JSON.stringify(payload) });
        return this;
      },
      send(payload?: any) {
        finish({ status: this.statusCode, body: payload, text: payload === undefined ? "" : String(payload) });
        return this;
      },
      end(payload?: any) {
        finish({ status: this.statusCode, body: payload, text: payload === undefined ? "" : String(payload) });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) {
        reject(error);
        return;
      }
      finish({
        status: 404,
        body: {
          ok: false,
          error: "not_found",
          path: req.path,
        },
        text: JSON.stringify({
          ok: false,
          error: "not_found",
          path: req.path,
        }),
      });
    });
  });
}

async function invokeAuth(options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  path?: string;
}) {
  return await invokeRouter(authRoutes, options);
}

async function invokeTenantAuth(options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  return await invokeRouter(tenantAuthRoutes, options);
}

function makeAuthToken(options?: { expiresIn?: string; subject?: string }) {
  return makeAuthTokenWithSecret("test-secret", options);
}

function makeAuthTokenWithSecret(secret: string, options?: { expiresIn?: string; subject?: string }) {
  return jwt.sign(
    {
      sub: options?.subject ?? "landlord-session-1",
      email: "landlord@example.test",
      role: "landlord",
      landlordId: options?.subject ?? "landlord-session-1",
      ver: 1,
    },
    secret,
    { expiresIn: options?.expiresIn ?? "7d" }
  );
}

let authRoutes: typeof import("../authRoutes").default;
let tenantAuthRoutes: typeof import("../tenantAuthRoutes").default;

describe("auth recovery contract", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    delete process.env.EMAIL_FROM;
    delete process.env.FROM_EMAIL;
    authRoutes = (await import("../authRoutes")).default;
    tenantAuthRoutes = (await import("../tenantAuthRoutes")).default;
  });

  it.each(["/refresh", "/resetPassword", "/verifyEmail"])(
    "keeps POST /api/auth%s unsupported and fail-closed",
    async (path) => {
      const res = await invokeAuth({
        method: "POST",
        url: path,
        body: { token: "not-returned" },
      });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        ok: false,
        error: "not_found",
      });
      expect(JSON.stringify(res.body)).not.toContain("token");
      expect(JSON.stringify(res.body)).not.toContain("resetLink");
      expect(JSON.stringify(res.body)).not.toContain("trustedDeviceToken");
    }
  );

  it("documents logout as backend acknowledgement without token internals", async () => {
    const res = await invokeAuth({
      method: "POST",
      url: "/logout",
      headers: { Authorization: "Bearer header.payload.signature" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Logged out" });
    expect(JSON.stringify(res.body)).not.toContain("token");
    expect(JSON.stringify(res.body)).not.toContain("session");
    expect(JSON.stringify(res.body)).not.toContain("revoked");
  });

  it("allows landlord logout without an authorization header", async () => {
    const res = await invokeAuth({
      method: "POST",
      url: "/logout",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Logged out" });
  });

  it("allows landlord logout with an invalid token because logout does not verify session state", async () => {
    const res = await invokeAuth({
      method: "POST",
      url: "/logout",
      headers: { Authorization: "Bearer invalid.token.value" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Logged out" });
  });

  it("allows landlord logout with an expired token because logout does not check expiry", async () => {
    const expiredToken = makeAuthToken({ expiresIn: "-1s" });

    const res = await invokeAuth({
      method: "POST",
      url: "/logout",
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Logged out" });
  });

  it("does not revoke the submitted landlord token server-side after logout acknowledgement", async () => {
    const token = makeAuthToken();

    const logoutRes = await invokeAuth({
      method: "POST",
      url: "/logout",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutRes.status).toBe(200);

    const meRes = await invokeAuth({
      method: "GET",
      url: "/me",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(meRes.status).toBe(200);
    expect(meRes.body).toMatchObject({
      ok: true,
      user: {
        id: "landlord-session-1",
        role: "landlord",
        landlordId: "landlord-session-1",
      },
    });
  });

  it("does not invalidate concurrent landlord sessions when one token is logged out", async () => {
    const firstToken = makeAuthToken({ subject: "landlord-session-1" });
    const secondToken = makeAuthToken({ subject: "landlord-session-2" });

    const logoutRes = await invokeAuth({
      method: "POST",
      url: "/logout",
      headers: { Authorization: `Bearer ${firstToken}` },
    });
    expect(logoutRes.status).toBe(200);

    const secondSessionRes = await invokeAuth({
      method: "GET",
      url: "/me",
      headers: { Authorization: `Bearer ${secondToken}` },
    });

    expect(secondSessionRes.status).toBe(200);
    expect(secondSessionRes.body?.user?.id).toBe("landlord-session-2");
  });

  it("documents tenant logout as acknowledgement-only without token internals", async () => {
    const res = await invokeTenantAuth({
      method: "POST",
      url: "/logout",
      headers: { Authorization: "Bearer tenant.header.payload" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(JSON.stringify(res.body)).not.toContain("token");
    expect(JSON.stringify(res.body)).not.toContain("session");
    expect(JSON.stringify(res.body)).not.toContain("revoked");
  });

  it("allows tenant logout without token validation", async () => {
    const noTokenRes = await invokeTenantAuth({
      method: "POST",
      url: "/logout",
    });
    const invalidTokenRes = await invokeTenantAuth({
      method: "POST",
      url: "/logout",
      headers: { Authorization: "Bearer invalid.tenant.token" },
    });

    expect(noTokenRes.status).toBe(200);
    expect(noTokenRes.body).toEqual({ ok: true });
    expect(invalidTokenRes.status).toBe(200);
    expect(invalidTokenRes.body).toEqual({ ok: true });
  });

  it("documents 2FA disablement as authenticated and without session revocation fields", async () => {
    const token = makeAuthTokenWithSecret("rentchain-dev-jwt-secret", { subject: "landlord-demo" });

    const res = await invokeAuth({
      method: "POST",
      url: "/2fa/disable",
      path: "/api/auth/2fa/disable",
      headers: { Authorization: `Bearer ${token}` },
      body: { code: "123456" },
    });

    expect([400, 401]).toContain(res.status);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    expect(res.body).not.toHaveProperty("revoked");
    expect(res.body).not.toHaveProperty("revokedSessions");
    expect(res.body).not.toHaveProperty("revokedTrustedDevices");
  });

  it("rejects password-reset confirmation notification with invalid email", async () => {
    const res = await invokeAuth({
      method: "POST",
      url: "/password-reset/confirmation",
      body: { email: "invalid" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "invalid_email" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("requires configured sender metadata before password-reset confirmation notification", async () => {
    const res = await invokeAuth({
      method: "POST",
      url: "/password-reset/confirmation",
      body: { email: "tenant@example.test" },
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, error: "email_not_configured" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("sends password-reset confirmation notification without returning sensitive payloads", async () => {
    process.env.EMAIL_FROM = "dev@example.test";

    const res = await invokeAuth({
      method: "POST",
      url: "/password-reset/confirmation",
      body: { email: "tenant@example.test" },
    });

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tenant@example.test",
        from: "dev@example.test",
      })
    );
  });

  it("rejects invalid pending 2FA token without issuing auth or trusted-device tokens", async () => {
    const res = await invokeAuth({
      method: "POST",
      url: "/2fa/verify",
      body: {
        pendingToken: "invalid.pending.token",
        method: "totp",
        code: "123456",
      },
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired 2FA token" });
    expect(res.body).not.toHaveProperty("token");
    expect(res.body).not.toHaveProperty("tenantToken");
    expect(res.body).not.toHaveProperty("trustedDeviceToken");
  });
});
