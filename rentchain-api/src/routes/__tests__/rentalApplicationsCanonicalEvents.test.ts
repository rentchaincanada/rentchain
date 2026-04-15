import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id || `${name}_${++autoId}`;
        return {
          id: docId,
          get: async () => ({
            id: docId,
            exists: ensureCollection(name).has(docId),
            data: () => ensureCollection(name).get(docId),
          }),
          set: async (value: any, options?: { merge?: boolean }) => {
            const current = ensureCollection(name).get(docId) || {};
            ensureCollection(name).set(docId, options?.merge ? { ...current, ...value } : value);
          },
        };
      },
    }),
  };

  return { collections, dbMock };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    req.user = { id: "admin-1", landlordId: "landlord-1", role: "admin" };
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

vi.mock("../../services/stripeService", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ id: "sess_1", url: "https://checkout.test/session_1" })),
      },
    },
  }),
}));

vi.mock("../../services/screening/screeningEvents", () => ({
  writeScreeningEvent: vi.fn(async () => undefined),
}));

vi.mock("../../services/screening/runPrimaryWithFallback", () => ({
  runPrimaryWithFallback: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/screeningPaymentTransactionService", () => ({
  recordScreeningPaymentInitiated: vi.fn(async () => undefined),
}));

vi.mock("../../services/integrations/transunion/transunionService", () => ({
  assertTransUnionConnectedForScreening: vi.fn(async () => undefined),
}));

async function invokeRouter(router: any, options: { method: string; url: string; body?: any; headers?: Record<string, string> }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
      params: {},
      query: {},
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("rentalApplicationsRoutes canonical screening events", () => {
  beforeEach(() => {
    collections.clear();
    process.env.NODE_ENV = "test";
    collections.set(
      "rentalApplications",
      new Map([
        [
          "app-1",
          {
            id: "app-1",
            landlordId: "landlord-1",
            propertyId: "property-1",
            unitId: "unit-1",
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
          },
        ],
      ])
    );
  });

  it("emits a canonical screening.checkout_created event on successful checkout creation", async () => {
    const router = (await import("../rentalApplicationsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/app-1/screening/checkout",
      headers: {
        origin: "http://localhost:5173",
      },
      body: {
        consent: {
          given: true,
          timestamp: "2026-03-02T10:00:00.000Z",
          version: "v1.0",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body?.autopilotPolicy).toEqual(
      expect.objectContaining({
        outcome: "allow",
        canAutopilot: true,
      })
    );
    const events = Array.from((collections.get("canonicalEvents") || new Map()).values());
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "screening.checkout_created",
          domain: "screening",
          action: "checkout_created",
          resource: expect.objectContaining({
            type: "screening_order",
          }),
        }),
        expect.objectContaining({
          type: "policy.evaluated",
          domain: "policy",
          metadata: expect.objectContaining({
            domain: "screening",
            action: "start_checkout",
            outcome: "allow",
          }),
        }),
      ])
    );
  });

  it("blocks screening checkout when the provider is degraded", async () => {
    process.env.NODE_ENV = "production";
    const { getScreeningProviderHealth } = await import("../../services/screening/providerHealth");
    vi.mocked(getScreeningProviderHealth).mockResolvedValueOnce({
      provider: "singlekey",
      configured: false,
      preflightOk: false,
      preflightDetail: "provider_down",
    } as any);

    const router = (await import("../rentalApplicationsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/app-1/screening/checkout",
      headers: {
        origin: "http://localhost:5173",
      },
      body: {
        consent: {
          given: true,
          timestamp: "2026-03-02T10:00:00.000Z",
          version: "v1.0",
        },
      },
    });

    expect(response.status).toBe(503);
    expect(response.body?.autopilotPolicy).toEqual(
      expect.objectContaining({
        outcome: "block",
        topReasonCode: "SCREENING_PROVIDER_UNAVAILABLE",
      })
    );
  });
});
