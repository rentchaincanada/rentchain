import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const {
  dbMock,
  resetDb,
  seedRentalApplication,
  providerHealthMock,
  checkoutCreateMock,
  logCutoverEventMock,
  runPrimaryWithFallbackMock,
} = vi.hoisted(() => {
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
    }),
  };

  const providerHealthMock = vi.fn(async () => ({
    provider: "singlekey",
    configured: false,
    preflightOk: false,
    preflightDetail: "provider_not_ready",
  }));

  const checkoutCreateMock = vi.fn(async () => ({ id: "sess_1", url: "https://checkout.test/session_1" }));
  const logCutoverEventMock = vi.fn();
  const runPrimaryWithFallbackMock = vi.fn(async () => ({ ok: true }));

  return {
    dbMock,
    providerHealthMock,
    checkoutCreateMock,
    logCutoverEventMock,
    runPrimaryWithFallbackMock,
    resetDb: () => {
      collections.clear();
      autoId = 0;
      providerHealthMock.mockClear();
      checkoutCreateMock.mockClear();
      logCutoverEventMock.mockClear();
      runPrimaryWithFallbackMock.mockClear();
    },
    seedRentalApplication: (id: string, data: any) => {
      const col = ensureCollection("rentalApplications");
      col.set(id, { id, data });
    },
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const auth = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim().toLowerCase();
    if (auth === "admin") {
      req.user = { id: "admin-1", landlordId: "admin-1", role: "admin" };
      return next();
    }
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    return next();
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
  getScreeningProviderHealth: providerHealthMock,
}));

vi.mock("../../services/stripeService", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({
    checkout: {
      sessions: {
        create: checkoutCreateMock,
      },
    },
  }),
}));

vi.mock("../../services/screening/screeningEvents", () => ({
  writeScreeningEvent: vi.fn(async () => undefined),
}));

vi.mock("../../services/screening/runPrimaryWithFallback", () => ({
  runPrimaryWithFallback: runPrimaryWithFallbackMock,
}));

vi.mock("../../services/screening/cutoverTelemetry", async () => {
  const actual: any = await vi.importActual("../../services/screening/cutoverTelemetry");
  return {
    ...actual,
    logCutoverEvent: logCutoverEventMock,
  };
});

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

describe("rental applications checkout mock override", () => {
  const originalEnv = { ...process.env };
  const appId = "app_mock_override_1";
  const validCheckoutBody = {
    consent: {
      given: true,
      timestamp: "2026-03-02T10:00:00.000Z",
      version: "v1.0",
    },
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetDb();
    seedRentalApplication(appId, eligibleApplication(appId));
  });

  it("returns 503 when ALLOW_MOCK_PROVIDER_CHECKOUT is false", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_MOCK_PROVIDER_CHECKOUT = "false";
    process.env.BUREAU_ADAPTER_PRIMARY_ALLOWLIST = appId;
    const app = await createApp();

    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/screening/checkout`)
      .set("Authorization", "Bearer admin")
      .send(validCheckoutBody);

    expect(res.status).toBe(503);
    expect(res.body?.detail).toBe("provider_not_ready");
  });

  it("returns 503 when ALLOW_MOCK_PROVIDER_CHECKOUT is true but caller is non-admin", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_MOCK_PROVIDER_CHECKOUT = "true";
    process.env.BUREAU_ADAPTER_PRIMARY_ALLOWLIST = appId;
    const app = await createApp();

    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/screening/checkout`)
      .set("Authorization", "Bearer landlord")
      .send(validCheckoutBody);

    expect(res.status).toBe(503);
    expect(res.body?.detail).toBe("provider_not_ready");
  });

  it("returns 200 for admin when allowlisted and emits mock telemetry", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_MOCK_PROVIDER_CHECKOUT = "true";
    process.env.BUREAU_ADAPTER_PRIMARY_ALLOWLIST = appId;
    const app = await createApp();

    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/screening/checkout`)
      .set("Authorization", "Bearer admin")
      .send(validCheckoutBody);

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(typeof res.body?.checkoutUrl).toBe("string");
    expect(res.body?.checkoutUrl).toContain("https://checkout.test/session_1");
    expect(logCutoverEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "bureau_cutover",
        name: "checkout",
        selectedRoute: "adapter",
        responseSource: "adapter",
        fallbackUsed: false,
        meta: expect.objectContaining({
          providerMode: "mock",
        }),
      })
    );
  });

  it("uses stored application consent when checkout body omits consent", async () => {
    process.env.NODE_ENV = "development";
    const app = await createApp();

    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(appId)}/screening/checkout`)
      .set("Authorization", "Bearer landlord")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(typeof res.body?.checkoutUrl).toBe("string");
  });

  it("supports flattened consent payload fields in checkout body", async () => {
    process.env.NODE_ENV = "development";
    const noStoredConsentId = "app_no_stored_consent_flat";
    seedRentalApplication(noStoredConsentId, {
      ...eligibleApplication(noStoredConsentId),
      consent: {
        creditConsent: true,
        referenceConsent: true,
        dataSharingConsent: true,
      },
    });
    const app = await createApp();

    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(noStoredConsentId)}/screening/checkout`)
      .set("Authorization", "Bearer landlord")
      .send({
        given: true,
        timestamp: "2026-03-02T10:00:00.000Z",
        version: "v1.0",
      });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(typeof res.body?.checkoutUrl).toBe("string");
  });

  it("returns consent_required when no usable consent is provided", async () => {
    process.env.NODE_ENV = "development";
    const missingConsentTimestampId = "app_missing_consent_timestamp";
    seedRentalApplication(missingConsentTimestampId, {
      ...eligibleApplication(missingConsentTimestampId),
      consent: {
        creditConsent: true,
        referenceConsent: true,
        dataSharingConsent: true,
      },
    });
    const app = await createApp();

    const res = await request(app)
      .post(`/api/rental-applications/${encodeURIComponent(missingConsentTimestampId)}/screening/checkout`)
      .set("Authorization", "Bearer landlord")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("consent_required");
  });
});
