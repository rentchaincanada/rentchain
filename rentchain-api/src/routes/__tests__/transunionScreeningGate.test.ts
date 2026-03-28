import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedRentalApplication } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        doc: (id: string) => ({
          async get() {
            const entry = ensureCollection(name).get(id);
            return {
              id,
              exists: Boolean(entry),
              data: () => entry?.data,
            };
          },
          async set(payload: any, options?: { merge?: boolean }) {
            const col = ensureCollection(name);
            if (options?.merge && col.has(id)) {
              const existing = col.get(id)!;
              col.set(id, { id, data: { ...(existing.data || {}), ...(payload || {}) } });
              return;
            }
            col.set(id, { id, data: payload || {} });
          },
        }),
      }),
    },
    resetDb: () => collections.clear(),
    seedRentalApplication: (id: string, data: any) => {
      ensureCollection("rentalApplications").set(id, { id, data });
    },
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../middleware/attachAccount", () => ({
  attachAccount: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/rateLimit", () => ({
  rateLimitScreeningIp: (_req: any, _res: any, next: any) => next(),
  rateLimitScreeningUser: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/screening/providerHealth", () => ({
  getScreeningProviderHealth: vi.fn(async () => ({
    provider: "singlekey",
    configured: true,
    preflightOk: true,
    preflightDetail: null,
  })),
}));

vi.mock("../../services/screening/screeningEvents", () => ({
  writeScreeningEvent: vi.fn(async () => undefined),
}));

vi.mock("../../services/screening/runPrimaryWithFallback", () => ({
  runPrimaryWithFallback: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/integrations/transunion/transunionService", () => ({
  assertTransUnionConnectedForScreening: vi.fn(async () => {
    const error: any = new Error("not connected");
    error.statusCode = 409;
    error.code = "transunion_not_connected";
    throw error;
  }),
}));

async function createApp() {
  const router = (await import("../rentalApplicationsRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("rentalApplicationsRoutes transunion gate", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BUREAU_PROVIDER", "singlekey");
    vi.stubEnv("SCREENING_PROVIDER", "singlekey");
    resetDb();
    seedRentalApplication("app-1", {
      landlordId: "landlord-1",
      status: "SUBMITTED",
      screeningStatus: "unpaid",
      consent: {
        creditConsent: true,
        referenceConsent: true,
        dataSharingConsent: true,
        acceptedAt: Date.now(),
        version: "v1.0",
      },
      applicant: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        dob: "1990-01-01",
      },
      residentialHistory: [{ address: "123 Main St" }],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns transunion_not_connected when screening starts without a connection", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/rental-applications/app-1/screening/checkout")
      .send({
        consent: {
          given: true,
          timestamp: "2026-03-03T10:00:00.000Z",
          version: "v1.0",
        },
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "transunion_not_connected",
      message: "Connect your TransUnion membership before starting screening.",
    });
  });
});
