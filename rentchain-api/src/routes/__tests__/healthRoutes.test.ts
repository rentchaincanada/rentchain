import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import healthRoutes from "../healthRoutes";

const firebaseMock = vi.hoisted(() => ({
  listCollections: vi.fn(async () => []),
  state: {
    environment: "test",
    mode: "emulator",
    emulatorHost: "127.0.0.1:8080",
    projectId: "project-0d9658de-af29-4dc0-a99",
    databaseId: "(default)",
    timestamp: "2026-06-03T00:00:00.000Z",
    caller: "health-test",
  },
}));
const originalNodeEnv = process.env.NODE_ENV;

vi.mock("../../firebase", () => ({
  db: {
    listCollections: firebaseMock.listCollections,
  },
  initializationState: () => ({ ...firebaseMock.state }),
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
    delete process.env.APP_ENV;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.FIRESTORE_ENABLED;
    delete process.env.FIRESTORE_DATABASE_ID;
    delete process.env.PREVIEW_AUTH_ENABLED;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_API_KEY;
    Object.assign(firebaseMock.state, {
      environment: "test",
      mode: "emulator",
      emulatorHost: "127.0.0.1:8080",
      projectId: "project-0d9658de-af29-4dc0-a99",
      databaseId: "(default)",
    });
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
      firebaseInitializationMode: "emulator",
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
      firebaseInitializationMode: "emulator",
    });

    const db = await invokeApp(app, "GET", "/health/db");
    expect(db.status).toBe(200);
    expect(db.body).toEqual({
      status: "skipped",
      firebaseInitializationMode: "emulator",
      message: "No DB credentials configured",
    });
  });

  it("reports datastore ready but keeps Preview unready until auth is operationally verified", async () => {
    process.env.APP_ENV = "preview";
    process.env.GOOGLE_CLOUD_PROJECT = "rentchain-preview";
    process.env.FIRESTORE_ENABLED = "true";
    process.env.FIRESTORE_DATABASE_ID = "(default)";
    process.env.PREVIEW_AUTH_ENABLED = "true";
    process.env.FIREBASE_PROJECT_ID = "rentchain-preview";
    process.env.FIREBASE_API_KEY = "preview-only-key";
    Object.assign(firebaseMock.state, {
      environment: "preview",
      mode: "preview-enabled",
      emulatorHost: null,
      projectId: "rentchain-preview",
      databaseId: "(default)",
    });

    const ready = await invokeApp(buildApp(), "GET", "/health/ready");

    expect(ready.status).toBe(503);
    expect(ready.body).toMatchObject({
      status: "fail",
      checks: {
        routes: "ok",
        db: "ok",
        datastore: "ready",
        authentication: "configured",
      },
      environment: "preview",
      mode: "datastore-auth-foundation",
      databaseId: "(default)",
    });
    expect(firebaseMock.listCollections).toHaveBeenCalledOnce();
    expect(JSON.stringify(ready.body)).not.toContain("preview-only-key");
  });

  it("does not report authentication ready from API-key presence alone", async () => {
    process.env.APP_ENV = "preview";
    process.env.GOOGLE_CLOUD_PROJECT = "rentchain-preview";
    process.env.FIRESTORE_ENABLED = "true";
    process.env.FIRESTORE_DATABASE_ID = "(default)";
    process.env.PREVIEW_AUTH_ENABLED = "false";
    process.env.FIREBASE_PROJECT_ID = "rentchain-preview";
    process.env.FIREBASE_API_KEY = "preview-only-key";
    Object.assign(firebaseMock.state, {
      environment: "preview",
      mode: "preview-enabled",
      emulatorHost: null,
      projectId: "rentchain-preview",
      databaseId: "(default)",
    });

    const ready = await invokeApp(buildApp(), "GET", "/health/ready");

    expect(ready.status).toBe(503);
    expect(ready.body).toMatchObject({
      checks: {
        datastore: "ready",
        authentication: "deferred",
      },
      mode: "datastore-auth-foundation",
    });
    expect(JSON.stringify(ready.body)).not.toContain("preview-only-key");
  });

  it("fails Preview readiness when the datastore probe fails", async () => {
    process.env.APP_ENV = "preview";
    process.env.GOOGLE_CLOUD_PROJECT = "rentchain-preview";
    process.env.FIRESTORE_ENABLED = "true";
    process.env.FIRESTORE_DATABASE_ID = "(default)";
    process.env.PREVIEW_AUTH_ENABLED = "true";
    process.env.FIREBASE_PROJECT_ID = "rentchain-preview";
    process.env.FIREBASE_API_KEY = "preview-only-key";
    Object.assign(firebaseMock.state, {
      environment: "preview",
      mode: "preview-enabled",
      emulatorHost: null,
      projectId: "rentchain-preview",
      databaseId: "(default)",
    });
    firebaseMock.listCollections.mockRejectedValueOnce(new Error("permission denied"));

    const ready = await invokeApp(buildApp(), "GET", "/health/ready");

    expect(ready.status).toBe(503);
    expect(ready.body).toMatchObject({
      status: "fail",
      checks: { routes: "ok", db: "fail" },
    });
  });
});
