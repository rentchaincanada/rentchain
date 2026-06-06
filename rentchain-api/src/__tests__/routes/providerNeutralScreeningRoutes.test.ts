import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, upsertDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensure(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function docRef(collectionName: string, id: string) {
    const col = ensure(collectionName);
    return {
      id,
      get: async () => {
        const entry = col.get(id);
        return { id, exists: Boolean(entry), data: () => entry?.data };
      },
      set: async (data: any, options?: { merge?: boolean }) => {
        if (options?.merge && col.has(id)) {
          col.set(id, { id, data: { ...col.get(id)!.data, ...data } });
        } else {
          col.set(id, { id, data });
        }
      },
    };
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id: string) => docRef(name, id),
      where: (field: string, op: string, value: any) => ({
        get: async () => {
          const docs = Array.from(ensure(name).values())
            .filter((entry) => op === "==" && entry.data?.[field] === value)
            .map((entry) => ({ id: entry.id, data: () => entry.data }));
          return { docs, empty: docs.length === 0 };
        },
      }),
      get: async () => {
        const docs = Array.from(ensure(name).values()).map((entry) => ({ id: entry.id, data: () => entry.data }));
        return { docs, empty: docs.length === 0 };
      },
    }),
  };

  return {
    dbMock,
    resetDb: () => collections.clear(),
    upsertDoc: (collectionName: string, id: string, data: any) => ensure(collectionName).set(id, { id, data }),
  };
});

vi.mock("../../firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ ok: false, error: "unauthenticated" });
    req.user = { id: token, tenantId: token, role: token === "admin-1" ? "admin" : "tenant" };
    return next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (token === "tenant-1") return res.status(403).json({ ok: false, error: "Forbidden" });
    req.user = { id: token, landlordId: token, role: token === "admin-1" ? "admin" : "landlord" };
    return next();
  },
}));

vi.mock("../../middleware/requireAdmin", () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (token !== "admin-1") return res.status(401).json({ ok: false, error: "Unauthorized" });
    req.user = { id: token, role: "admin" };
    return next();
  },
}));

vi.mock("../../lib/gcs", () => ({
  uploadBufferToGcs: vi.fn(async (input: any) => ({ bucket: "test-bucket", path: input.path })),
}));

async function createApp() {
  const router = (await import("../../routes/providerNeutralScreeningRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("provider-neutral screening routes", () => {
  beforeEach(() => {
    resetDb();
    upsertDoc("units", "unit-1", { landlordId: "landlord-1" });
  });

  it("returns 401 for tenant consent without auth", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/tenant/tenant-1/screeningConsent").send({});
    expect(res.status).toBe(401);
  });

  it("creates consent and landlord request with safe response shape", async () => {
    const app = await createApp();
    const consentRes = await request(app)
      .post("/api/tenant/tenant-1/screeningConsent")
      .set("Authorization", "Bearer tenant-1")
      .send({ landlordId: "landlord-1", unitId: "unit-1" });
    expect(consentRes.status).toBe(201);
    expect(consentRes.body.consent.consentId).toMatch(/^consent_/);

    const requestRes = await request(app)
      .post("/api/landlord/units/unit-1/screeningRequest")
      .set("Authorization", "Bearer landlord-1")
      .send({ tenantId: "tenant-1", consentId: consentRes.body.consent.consentId });

    expect(requestRes.status).toBe(201);
    expect(requestRes.body).toMatchObject({ ok: true, status: "pending" });
    expect(JSON.stringify(requestRes.body)).not.toContain("auditLog");
  });

  it("rejects landlord access to another landlord unit", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/landlord/units/unit-1/screeningRequest")
      .set("Authorization", "Bearer landlord-2")
      .send({ tenantId: "tenant-1", consentId: "consent-missing" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("UNIT_FORBIDDEN");
  });

  it("fails closed for unregistered webhook provider", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/webhook/screening/provider-x")
      .set("X-Signature", "bad")
      .send({ requestId: "request-1" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("PROVIDER_NOT_CONFIGURED");
  });
});
