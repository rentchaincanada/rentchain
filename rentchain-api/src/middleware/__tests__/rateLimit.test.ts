import fs from "fs";
import path from "path";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRateLimiter,
  RATE_LIMIT_PROFILES,
  rateLimitInternalJob,
  type RateLimitProfile,
} from "../rateLimit";

function testLimiter(profile: Partial<RateLimitProfile> & Pick<RateLimitProfile, "profileName">) {
  return createRateLimiter({
    windowMs: 60_000,
    max: 2,
    keyStrategy: "ip",
    description: "test profile",
    ...profile,
  });
}

function buildApp(limiter: ReturnType<typeof createRateLimiter>) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(limiter);
  app.get("/ok", (_req, res) => res.json({ ok: true }));
  app.post("/ok", (_req, res) => res.json({ ok: true }));
  return app;
}

function appBuildSource() {
  return fs.readFileSync(path.resolve(__dirname, "../../app.build.ts"), "utf8");
}

async function invokeApp(
  app: any,
  options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
  }
) {
  return await new Promise<{ status: number; body: any; headers: Record<string, any> }>((resolve, reject) => {
    const [pathOnly, rawQuery] = options.url.split("?");
    const headers = Object.fromEntries(
      Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
    );
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: pathOnly,
      query: rawQuery ? Object.fromEntries(new URLSearchParams(rawQuery).entries()) : {},
      headers,
      ip: headers["x-forwarded-for"] || "127.0.0.1",
      socket: { remoteAddress: headers["x-forwarded-for"] || "127.0.0.1" },
      get(name: string) {
        return this.headers[String(name || "").toLowerCase()];
      },
      header(name: string) {
        return this.headers[String(name || "").toLowerCase()];
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, any>,
      setHeader(name: string, value: any) {
        this.headers[String(name).toLowerCase()] = value;
      },
      getHeader(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      removeHeader(name: string) {
        delete this.headers[String(name).toLowerCase()];
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
      end(payload?: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
    };

    app.handle(req, res, (error: any) => {
      if (error) reject(error);
      else reject(new Error(`Unhandled request: ${options.method} ${options.url}`));
    });
  });
}

describe("rate limit middleware", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns deterministic 429 responses after the configured threshold", async () => {
    const app = buildApp(testLimiter({ profileName: "test-auth-sensitive", max: 2 }));

    expect(
      (await invokeApp(app, { method: "GET", url: "/ok", headers: { "x-forwarded-for": "203.0.113.10" } }))
        .status
    ).toBe(200);
    expect(
      (await invokeApp(app, { method: "GET", url: "/ok", headers: { "x-forwarded-for": "203.0.113.10" } }))
        .status
    ).toBe(200);
    const limited = await invokeApp(app, { method: "GET", url: "/ok", headers: { "x-forwarded-for": "203.0.113.10" } });

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      error: "rate_limited",
      detail: "Too many requests. Please try again later.",
    });
    expect(limited.headers["retry-after"]).toBeDefined();
  });

  it("keeps separate route categories from sharing counters", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use("/auth", testLimiter({ profileName: "test-auth-category", max: 1 }));
    app.use("/exports", testLimiter({ profileName: "test-export-category", max: 1 }));
    app.get("/auth/ping", (_req, res) => res.json({ ok: true, category: "auth" }));
    app.get("/exports/ping", (_req, res) => res.json({ ok: true, category: "exports" }));

    expect(
      (await invokeApp(app, { method: "GET", url: "/auth/ping", headers: { "x-forwarded-for": "203.0.113.11" } }))
        .status
    ).toBe(200);
    expect(
      (await invokeApp(app, { method: "GET", url: "/exports/ping", headers: { "x-forwarded-for": "203.0.113.11" } }))
        .status
    ).toBe(200);
    expect(
      (await invokeApp(app, { method: "GET", url: "/auth/ping", headers: { "x-forwarded-for": "203.0.113.11" } }))
        .status
    ).toBe(429);
    expect(
      (await invokeApp(app, { method: "GET", url: "/exports/ping", headers: { "x-forwarded-for": "203.0.113.11" } }))
        .status
    ).toBe(429);
  });

  it("uses actor identity when safely available so authenticated users do not collide on IP alone", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use((req: any, _res, next) => {
      req.user = { id: String(req.header("x-test-actor") || "") };
      next();
    });
    app.use(
      createRateLimiter({
        profileName: "test-actor-or-ip",
        windowMs: 60_000,
        max: 1,
        keyStrategy: "actor-or-ip",
        description: "actor key test",
      })
    );
    app.get("/ok", (_req, res) => res.json({ ok: true }));

    expect(
      (
        await invokeApp(app, {
          method: "GET",
          url: "/ok",
          headers: { "x-forwarded-for": "203.0.113.12", "x-test-actor": "actor-a" },
        })
      ).status
    ).toBe(200);
    expect(
      (
        await invokeApp(app, {
          method: "GET",
          url: "/ok",
          headers: { "x-forwarded-for": "203.0.113.12", "x-test-actor": "actor-a" },
        })
      ).status
    ).toBe(429);
    expect(
      (
        await invokeApp(app, {
          method: "GET",
          url: "/ok",
          headers: { "x-forwarded-for": "203.0.113.12", "x-test-actor": "actor-b" },
        })
      ).status
    ).toBe(200);
  });

  it("does not log Authorization header or token material when a request is limited", async () => {
    const warnSpy = vi.mocked(console.warn);
    const app = buildApp(testLimiter({ profileName: "test-log-redaction", max: 1 }));

    expect(
      (await invokeApp(app, { method: "GET", url: "/ok", headers: { authorization: "Bearer leaked.jwt.value" } }))
        .status
    ).toBe(200);
    expect(
      (await invokeApp(app, { method: "GET", url: "/ok", headers: { authorization: "Bearer leaked.jwt.value" } }))
        .status
    ).toBe(429);

    const serializedLogs = JSON.stringify(warnSpy.mock.calls);
    expect(serializedLogs).toContain("[rate-limit] request limited");
    expect(serializedLogs).toContain("authHeaderPresent");
    expect(serializedLogs).not.toContain("Bearer leaked.jwt.value");
    expect(serializedLogs).not.toContain("authorization");
  });

  it("keeps internal job limiting lenient for normal retries", async () => {
    const app = buildApp(rateLimitInternalJob);

    expect(
      (await invokeApp(app, { method: "POST", url: "/ok", headers: { "x-forwarded-for": "203.0.113.13" } }))
        .status
    ).toBe(200);
    expect(
      (await invokeApp(app, { method: "POST", url: "/ok", headers: { "x-forwarded-for": "203.0.113.13" } }))
        .status
    ).toBe(200);
  });

  it("documents the first-pass route categories and conservative defaults", () => {
    expect(RATE_LIMIT_PROFILES.authSensitive.max).toBe(20);
    expect(RATE_LIMIT_PROFILES.publicToken.max).toBe(60);
    expect(RATE_LIMIT_PROFILES.evidenceExportReview.keyStrategy).toBe("actor-or-ip");
    expect(RATE_LIMIT_PROFILES.internalJob.max).toBeGreaterThan(RATE_LIMIT_PROFILES.authSensitive.max);
  });

  it("keeps webhook routes before parser and category rate-limit mounts", () => {
    const source = appBuildSource();
    const stripeWebhook = source.indexOf('"/api/webhooks/stripe"');
    const transunionWebhook = source.indexOf('"/api/webhooks/transunion"');
    const jsonParser = source.indexOf("const jsonParser = express.json");
    const firstCategoryLimiterMount = source.indexOf('app.use("/api/public/landlord-invites", rateLimitPublicToken)');

    expect(stripeWebhook).toBeGreaterThan(-1);
    expect(transunionWebhook).toBeGreaterThan(-1);
    expect(jsonParser).toBeGreaterThan(-1);
    expect(firstCategoryLimiterMount).toBeGreaterThan(-1);
    expect(stripeWebhook).toBeLessThan(jsonParser);
    expect(transunionWebhook).toBeLessThan(jsonParser);
    expect(jsonParser).toBeLessThan(firstCategoryLimiterMount);
  });
});
