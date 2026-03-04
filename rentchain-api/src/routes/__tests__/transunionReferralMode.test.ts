import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedRentalApplication, enqueueScreeningJobMock, getDocData } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const col = ensureCollection(name);
        const docId = id || `auto_${++autoId}`;
        return {
          id: docId,
          path: `${name}/${docId}`,
          get: async () => {
            const entry = col.get(docId);
            return {
              id: docId,
              exists: Boolean(entry),
              data: () => entry?.data,
            };
          },
          set: async (payload: any, options?: { merge?: boolean }) => {
            if (options?.merge && col.has(docId)) {
              const existing = col.get(docId)!;
              col.set(docId, { id: docId, data: { ...(existing.data || {}), ...(payload || {}) } });
              return;
            }
            col.set(docId, { id: docId, data: payload });
          },
        };
      },
      where: (field: string, op: string, value: any) => ({
        limit: (_count: number) => ({
          get: async () => {
            const col = ensureCollection(name);
            const docs = Array.from(col.values())
              .filter((entry) => op === "==" && entry.data?.[field] === value)
              .map((entry) => ({
                id: entry.id,
                data: () => entry.data,
                ref: {
                  id: entry.id,
                  set: async (payload: any, options?: { merge?: boolean }) => {
                    if (options?.merge) {
                      const existing = col.get(entry.id)!;
                      col.set(entry.id, {
                        id: entry.id,
                        data: { ...(existing.data || {}), ...(payload || {}) },
                      });
                    } else {
                      col.set(entry.id, { id: entry.id, data: payload });
                    }
                  },
                },
              }));
            return { empty: docs.length === 0, docs };
          },
        }),
      }),
    }),
  };

  return {
    dbMock,
    enqueueScreeningJobMock: vi.fn(async () => ({ ok: true, jobId: "job_1" })),
    resetDb: () => {
      collections.clear();
      autoId = 0;
    },
    seedRentalApplication: (id: string, data: any) => {
      const col = ensureCollection("rentalApplications");
      col.set(id, { id, data });
    },
    getDocData: (collection: string, id: string) => {
      return ensureCollection(collection).get(id)?.data ?? null;
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
    provider: "transunion_referral",
    configured: true,
    preflightOk: true,
    preflightDetail: null,
  })),
}));

vi.mock("../../services/screeningJobs", () => ({
  enqueueScreeningJob: enqueueScreeningJobMock,
}));

vi.mock("../../services/stripeService", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => {
    throw new Error("stripe should not be called in referral mode");
  },
}));

vi.mock("../../services/screening/screeningEvents", () => ({
  writeScreeningEvent: vi.fn(async () => undefined),
}));

vi.mock("../../services/screening/runPrimaryWithFallback", () => ({
  runPrimaryWithFallback: vi.fn(async () => ({ ok: true })),
}));

async function createApp() {
  const router = (await import("../rentalApplicationsRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

function eligibleApplication(id: string) {
  return {
    id,
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
  };
}

describe("transunion referral provider mode", () => {
  const originalEnv = { ...process.env };
  const appId = "app_tu_ref_1";

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.BUREAU_PROVIDER = "transunion_referral";
    process.env.TU_REFERRAL_BASE_URL = "https://tu.example/referral";
    process.env.TU_REFERRAL_SOURCE = "rentchain";
    resetDb();
    enqueueScreeningJobMock.mockClear();
    seedRentalApplication(appId, eligibleApplication(appId));
  });

  it("returns zero-priced quote in referral mode", async () => {
    const app = await createApp();
    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/screening/quote`)
      .send({
        consent: {
          given: true,
          timestamp: "2026-03-03T10:00:00.000Z",
          version: "v1.0",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.data?.totalAmountCents).toBe(0);
    expect(res.body?.data?.note).toContain("TransUnion");
  });

  it("enforces consent and eligibility gates before referral quote", async () => {
    seedRentalApplication("draft_app", {
      ...eligibleApplication("draft_app"),
      status: "DRAFT",
    });
    const app = await createApp();

    const ineligible = await request(app).post("/api/rental-applications/draft_app/screening/quote").send({});
    expect(ineligible.status).toBe(200);
    expect(ineligible.body?.error).toBe("NOT_ELIGIBLE");

    seedRentalApplication("no_consent_app", {
      ...eligibleApplication("no_consent_app"),
      consent: { creditConsent: false, referenceConsent: false },
    });
    const noConsent = await request(app)
      .post("/api/rental-applications/no_consent_app/screening/quote")
      .send({});
    expect(noConsent.status).toBe(400);
    expect(noConsent.body?.error).toBe("consent_required");
  });

  it("checkout returns referral redirect and creates zero-dollar external order + job", async () => {
    const app = await createApp();
    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/screening/checkout`)
      .send({
        consent: {
          given: true,
          timestamp: "2026-03-03T10:00:00.000Z",
          version: "v1.0",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.mode).toBe("transunion_referral");
    expect(String(res.body?.redirectUrl || "")).toContain("tu.example");
    expect(res.body?.orderId).toBeTruthy();
    expect(enqueueScreeningJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: res.body?.orderId,
        applicationId: appId,
        provider: "transunion_referral",
      })
    );
    const referral = getDocData("screeningReferrals", String(res.body?.orderId));
    expect(referral).toMatchObject({
      referralId: String(res.body?.orderId),
      provider: "transunion_referral",
      applicationId: appId,
      orderId: String(res.body?.orderId),
      status: "initiated",
      version: 1,
    });
    expect(typeof referral?.landlordIdHash).toBe("string");
    expect(referral?.landlordIdHash).not.toBe("landlord-1");
  });

  it("marks referral complete via manual endpoint", async () => {
    const app = await createApp();
    const checkout = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/screening/checkout`)
      .send({
        consent: {
          given: true,
          timestamp: "2026-03-03T10:00:00.000Z",
          version: "v1.0",
        },
      });
    expect(checkout.status).toBe(200);

    const orderId = String(checkout.body?.orderId || "");
    const complete = await request(app).post("/api/screening/referrals/mark-complete").send({ orderId });
    expect(complete.status).toBe(200);
    expect(complete.body?.ok).toBe(true);
    expect(complete.body?.data?.status).toBe("completed");
    expect(complete.body?.data?.completionSource).toBe("manual");
  });
});
