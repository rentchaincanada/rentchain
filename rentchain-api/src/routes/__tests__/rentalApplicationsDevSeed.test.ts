import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetStore, upsertApplication, getApplication } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoCounter = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const col = ensureCollection(name);
        const docId = id || `auto_${++autoCounter}`;
        return {
          id: docId,
          get: async () => {
            const entry = col.get(docId);
            return {
              id: docId,
              exists: Boolean(entry),
              data: () => entry?.data,
            };
          },
          set: async (payload: any, opts?: { merge?: boolean }) => {
            if (opts?.merge && col.has(docId)) {
              const existing = col.get(docId)!;
              col.set(docId, { id: docId, data: { ...(existing.data || {}), ...(payload || {}) } });
              return;
            }
            col.set(docId, { id: docId, data: payload });
          },
        };
      },
    }),
  };

  return {
    dbMock,
    resetStore: () => {
      collections.clear();
      autoCounter = 0;
    },
    upsertApplication: (id: string, data: any) => {
      const col = ensureCollection("rentalApplications");
      col.set(id, { id, data });
    },
    getApplication: (id: string) => {
      const col = ensureCollection("rentalApplications");
      return col.get(id)?.data || null;
    },
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const auth = String(req.headers?.authorization || "");
    const token = auth.replace(/^Bearer\s+/i, "").trim().toLowerCase();
    if (!token) {
      req.user = null;
      return next();
    }
    if (token === "admin") {
      req.user = { id: "admin-1", landlordId: "admin-1", role: "admin" };
      return next();
    }
    if (token === "landlord2") {
      req.user = { id: "landlord-2", landlordId: "landlord-2", role: "landlord" };
      return next();
    }
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    return next();
  },
}));

vi.mock("../../middleware/attachAccount", () => ({
  attachAccount: (_req: any, _res: any, next: any) => next(),
}));

async function createApp() {
  const router = (await import("../rentalApplicationsRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("rentalApplications dev seed consent endpoint", () => {
  const originalEnv = { ...process.env };
  const appId = "app-dev-seed-1";

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetStore();
    upsertApplication(appId, {
      id: appId,
      landlordId: "landlord-1",
      status: "SUBMITTED",
      consent: null,
      updatedAt: Date.now(),
    });
  });

  it("returns 404 in production when ALLOW_DEV_SEED_ENDPOINTS is not enabled, even for admin", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_DEV_SEED_ENDPOINTS;
    const app = await createApp();
    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/dev/seed-consent`)
      .set("Authorization", "Bearer admin");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "not_found" });
  }, 20000);

  it("allows admin in production when ALLOW_DEV_SEED_ENDPOINTS=true", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEV_SEED_ENDPOINTS = "true";
    const app = await createApp();

    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/dev/seed-consent`)
      .set("Authorization", "Bearer admin");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    const updated = getApplication(appId);
    expect(updated?.consent?.creditConsent).toBe(true);
    expect(updated?.consent?.referenceConsent).toBe(true);
  }, 20000);

  it("returns 404 for non-admin in production even when ALLOW_DEV_SEED_ENDPOINTS=true", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEV_SEED_ENDPOINTS = "true";
    const app = await createApp();

    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/dev/seed-consent`)
      .set("Authorization", "Bearer landlord");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "not_found" });
  }, 20000);

  it("works in non-production for landlord and tolerates empty body", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_DEV_SEED_ENDPOINTS;
    const app = await createApp();

    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/dev/seed-consent`)
      .set("Authorization", "Bearer landlord");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    const updated = getApplication(appId);
    expect(updated?.consent?.version).toBe("v1.0");
  }, 20000);
});

describe("rentalApplications dev create submitted endpoint", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetStore();
  });

  it("returns 404 in production when ALLOW_DEV_SEED_ENDPOINTS is not enabled, even for admin", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_DEV_SEED_ENDPOINTS;
    const app = await createApp();

    const res = await request(app)
      .post("/api/rental-applications/dev/create-submitted")
      .set("Authorization", "Bearer admin");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "not_found" });
  });

  it("returns 200 for admin when ALLOW_DEV_SEED_ENDPOINTS is enabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEV_SEED_ENDPOINTS = "true";
    const app = await createApp();

    const res = await request(app)
      .post("/api/rental-applications/dev/create-submitted")
      .set("Authorization", "Bearer admin");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(typeof res.body?.data?.rentalApplicationId).toBe("string");
    expect(res.body?.data?.landlordId).toBe("admin-1");

    const created = getApplication(String(res.body?.data?.rentalApplicationId || ""));
    expect(created?.status).toBe("SUBMITTED");
    expect(created?.landlordId).toBe("admin-1");
  });

  it("returns 404 for non-admin", async () => {
    process.env.NODE_ENV = "development";
    const app = await createApp();

    const res = await request(app)
      .post("/api/rental-applications/dev/create-submitted")
      .set("Authorization", "Bearer landlord");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "not_found" });
  });
});
