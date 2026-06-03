import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../config/firebase", () => ({
  db: {
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
  },
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
    arrayUnion: (...values: unknown[]) => values,
  },
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: mocks.sendEmail,
  sendLandlordWelcomeEmail: vi.fn(async () => ({ ok: true })),
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; body?: any; headers?: Record<string, string> }
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
      path: pathWithQuery,
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
}) {
  return await invokeRouter(authRoutes, options);
}

let authRoutes: typeof import("../authRoutes").default;

describe("auth recovery contract", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    delete process.env.EMAIL_FROM;
    delete process.env.FROM_EMAIL;
    authRoutes = (await import("../authRoutes")).default;
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
