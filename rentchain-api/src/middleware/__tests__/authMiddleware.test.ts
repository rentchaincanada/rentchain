import { afterEach, describe, expect, it, vi } from "vitest";

const jwtMocks = vi.hoisted(() => ({
  verify: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: jwtMocks.verify,
  },
  verify: jwtMocks.verify,
}));

vi.mock("../../config/authConfig", () => ({
  JWT_SECRET: "test-secret",
}));

function createRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

describe("authenticateJwt optional auth for events track", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows /api/events/track through without auth", async () => {
    const { authenticateJwt } = await import("../authMiddleware");
    const req: any = {
      originalUrl: "/api/events/track",
      path: "/api/events/track",
      method: "POST",
      headers: {},
    };
    const res: any = createRes();
    const next = vi.fn();

    authenticateJwt(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("allows /api/events/track through when bearer auth is invalid", async () => {
    jwtMocks.verify.mockImplementationOnce(() => {
      throw new Error("bad token");
    });
    const { authenticateJwt } = await import("../authMiddleware");
    const req: any = {
      originalUrl: "/api/events/track",
      path: "/api/events/track",
      method: "POST",
      headers: {
        authorization: "Bearer invalid-token",
      },
    };
    const res: any = createRes();
    const next = vi.fn();

    authenticateJwt(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("still rejects invalid bearer auth on unrelated routes", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    jwtMocks.verify.mockImplementationOnce(() => {
      throw new Error("bad token Authorization: Bearer leaked.jwt.value");
    });
    const { authenticateJwt } = await import("../authMiddleware");
    const req: any = {
      originalUrl: "/api/account/limits",
      path: "/api/account/limits",
      method: "GET",
      headers: {
        authorization: "Bearer invalid-token",
      },
    };
    const res: any = createRes();
    const next = vi.fn();

    authenticateJwt(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: "UNAUTHORIZED",
        code: "UNAUTHORIZED",
      })
    );
    expect(errorSpy).toHaveBeenCalledWith("[authenticateJwt] verification failed", {
      route: "/api/account/limits",
      method: "GET",
      authHeaderPresent: true,
      error: {
        name: "Error",
        message: "bad token Authorization: [REDACTED]",
      },
    });
  });
});
