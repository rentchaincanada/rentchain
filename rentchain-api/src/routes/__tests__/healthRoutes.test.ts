import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import healthRoutes from "../healthRoutes";

const firebaseMock = vi.hoisted(() => ({
  listCollections: vi.fn(async () => []),
}));
const originalNodeEnv = process.env.NODE_ENV;

vi.mock("../../config/firebase", () => ({
  db: {
    listCollections: firebaseMock.listCollections,
  },
}));

function buildApp() {
  const app = express();
  app.use("/health", healthRoutes);
  return app;
}

async function invokeApp(app: any, method: string, url: string) {
  return await new Promise<{ status: number; body: any; headers: Record<string, any> }>((resolve, reject) => {
    const req: any = {
      method,
      url,
      originalUrl: url,
      path: url,
      headers: {},
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
    };

    app.handle(req, res, (error: any) => {
      if (error) reject(error);
      else reject(new Error(`Unhandled request: ${method} ${url}`));
    });
  });
}

describe("healthRoutes", () => {
  afterEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.RELEASE_SHA;
    delete process.env.K_REVISION;
    delete process.env.GIT_SHA;
    delete process.env.COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIREBASE_CONFIG;
  });

  it("keeps /health reachable while redacting exact revision and commit values", async () => {
    process.env.RELEASE_SHA = "release-secret-sha";
    process.env.K_REVISION = "rentchain-landlord-api-00042-secret";
    process.env.GIT_SHA = "abc123secret";

    const res = await invokeApp(buildApp(), "GET", "/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      service: "rentchain-api",
      revisionPresent: true,
      commitPresent: true,
      releaseShaPresent: true,
    });
    expect(JSON.stringify(res.body)).not.toContain("release-secret-sha");
    expect(JSON.stringify(res.body)).not.toContain("00042-secret");
    expect(JSON.stringify(res.body)).not.toContain("abc123secret");
  });

  it("keeps /health/version reachable without exposing environment hints", async () => {
    process.env.NODE_ENV = "production";

    const res = await invokeApp(buildApp(), "GET", "/health/version");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      service: "rentchain-api",
    });
    expect(res.body.version).toBeDefined();
    expect(res.body.env).toBeUndefined();
  });

  it("keeps readiness and db health safe for deployment verification", async () => {
    const app = buildApp();

    const ready = await invokeApp(app, "GET", "/health/ready");
    expect(ready.status).toBe(200);
    expect(ready.body).toMatchObject({
      status: "ok",
      service: "rentchain-api",
      checks: { routes: "ok", db: "skipped" },
    });

    const db = await invokeApp(app, "GET", "/health/db");
    expect(db.status).toBe(200);
    expect(db.body).toEqual({ status: "skipped", message: "No DB credentials configured" });
  });
});
