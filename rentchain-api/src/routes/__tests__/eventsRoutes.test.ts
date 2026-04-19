import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedEvent, getCollectionDocs } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        add: async (payload: any) => {
          const id = `auto_${++autoId}`;
          ensureCollection(name).set(id, { id, data: payload });
          return { id };
        },
        get: async () => {
          const docs = Array.from(ensureCollection(name).values()).map((entry) => ({
            id: entry.id,
            data: () => entry.data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
    resetDb: () => {
      collections.clear();
      autoId = 0;
    },
    seedEvent: (id: string, data: any) => {
      ensureCollection("events").set(id, { id, data });
    },
    getCollectionDocs: (name: string) =>
      Array.from(ensureCollection(name).values()).map((entry) => ({ id: entry.id, ...(entry.data || {}) })),
  };
});

const telemetryMocks = vi.hoisted(() => ({
  incrementCounter: vi.fn(async () => undefined),
}));

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../services/telemetryService", () => ({
  incrementCounter: telemetryMocks.incrementCounter,
}));

async function createRouter() {
  const router = (await import("../eventsRoutes")).default;
  return router;
}

async function invokeRouter(
  router: any,
  options: {
    method: string;
    url: string;
    user?: Record<string, unknown> | null;
    body?: any;
    cookies?: Record<string, string>;
  }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url.split("?")[0],
      query: {},
      body: options.body ?? {},
      user: options.user || null,
      cookies: options.cookies ?? {},
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, any>,
      setHeader(name: string, value: any) {
        this.headers[name.toLowerCase()] = value;
      },
      cookie(name: string, value: string) {
        req.cookies[name] = value;
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
    const [pathOnly, rawQuery] = options.url.split("?");
    req.path = pathOnly;
    if (rawQuery) {
      req.query = Object.fromEntries(new URLSearchParams(rawQuery).entries());
    }
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("eventsRoutes", () => {
  beforeEach(() => {
    resetDb();
    telemetryMocks.incrementCounter.mockReset();
  });

  it("accepts registry pricing-funnel events through the lightweight tracker", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/track",
      body: {
        name: "registry_ready_created",
        props: {
          propertyId: "prop-1",
          source: "google",
          medium: "cpc",
          campaign: "halifax-ready",
        },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(telemetryMocks.incrementCounter).toHaveBeenCalledWith({ name: "registry_ready_created" });
    expect(getCollectionDocs("events")).toEqual([
      expect.objectContaining({
        name: "registry_ready_created",
        userId: null,
        sessionId: expect.any(String),
      }),
    ]);
  });

  it("accepts billing and upgrade prompt analytics events through the generic tracker", async () => {
    const router = await createRouter();

    const billingRes = await invokeRouter(router, {
      method: "POST",
      url: "/track",
      body: {
        name: "billing_page_opened",
        props: {
          currentPlan: "pro",
          surface: "billing_page",
          route: "/billing",
        },
      },
    });

    const promptRes = await invokeRouter(router, {
      method: "POST",
      url: "/track",
      body: {
        name: "upgrade_prompt_viewed",
        props: {
          featureKey: "tenant_invites",
          currentPlan: "free",
          requiredPlan: "starter",
          source: "locked_feature",
          presentation: "modal",
          route: "/applications",
        },
      },
    });

    expect(billingRes.status).toBe(200);
    expect(promptRes.status).toBe(200);
    expect(telemetryMocks.incrementCounter).toHaveBeenCalledWith({ name: "billing_page_opened" });
    expect(telemetryMocks.incrementCounter).toHaveBeenCalledWith({ name: "upgrade_prompt_viewed" });
  });

  it("accepts activation analytics events through the generic tracker", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/track",
      user: { id: "user-activation", role: "landlord" },
      body: {
        name: "activation_property_created",
        props: {
          surface: "properties_page",
          source: "add_property_form",
          plan: "free",
          route: "/properties",
        },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(telemetryMocks.incrementCounter).toHaveBeenCalledWith({ name: "activation_property_created" });
    expect(getCollectionDocs("events")).toEqual([
      expect.objectContaining({
        name: "activation_property_created",
        userId: "user-activation",
        sessionId: null,
      }),
    ]);
  });

  it("persists authenticated events with userId and no sessionId", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/track",
      user: { id: "user-123", role: "landlord" },
      body: {
        name: "billing_page_opened",
        props: { surface: "billing_page" },
      },
    });

    expect(res.status).toBe(200);
    expect(getCollectionDocs("events")).toEqual([
      expect.objectContaining({
        name: "billing_page_opened",
        userId: "user-123",
        sessionId: null,
      }),
    ]);
  });

  it("rejects invalid event names", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/track",
      body: {
        name: "not_allowed_event",
        props: {},
      },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "invalid_event_name" });
    expect(getCollectionDocs("events")).toEqual([]);
  });

  it("returns a grouped registry funnel report for admins", async () => {
    seedEvent("event-1", {
      name: "registry_landing_cta_clicked",
      ts: Date.parse("2026-04-01T10:00:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
      },
    });
    seedEvent("event-2", {
      name: "registry_ready_created",
      ts: Date.parse("2026-04-01T11:00:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
      },
    });
    seedEvent("event-3", {
      name: "registry_upgrade_prompt_viewed",
      ts: Date.parse("2026-04-01T12:00:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        variant: "B",
      },
    });
    seedEvent("event-4", {
      name: "registry_upgrade_clicked",
      ts: Date.parse("2026-04-01T12:05:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        variant: "B",
      },
    });
    seedEvent("event-5", {
      name: "registry_upgrade_converted",
      ts: Date.parse("2026-04-02T08:00:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        variant: "B",
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/registry-funnel-report?from=2026-04-01T00:00:00.000Z&to=2026-04-03T00:00:00.000Z",
      user: { id: "admin-1", role: "admin" },
    });

    expect(res.status).toBe(200);
    expect(res.body?.totals).toEqual({
      landingEntries: 1,
      readinessCreated: 1,
      filingGateHits: 0,
      upgradePromptViews: 1,
      upgradeClicks: 1,
      upgradeConversions: 1,
    });
    expect(res.body?.bySource).toEqual([
      expect.objectContaining({
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        counts: expect.objectContaining({
          landingEntries: 1,
          readinessCreated: 1,
          upgradePromptViews: 1,
          upgradeClicks: 1,
          upgradeConversions: 1,
        }),
      }),
    ]);
    expect(res.body?.byVariant).toEqual([
      expect.objectContaining({
        variant: "B",
        promptViews: 1,
        clicks: 1,
        conversions: 1,
        clickThroughRate: 1,
        conversionRateFromClick: 1,
      }),
    ]);
    expect(res.body?.byDate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-04-01",
          counts: expect.objectContaining({
            landingEntries: 1,
            readinessCreated: 1,
            upgradePromptViews: 1,
            upgradeClicks: 1,
          }),
        }),
      ])
    );
  });

  it("blocks the funnel report for non-admin users", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/registry-funnel-report",
      user: { id: "landlord-1", role: "landlord" },
    });
    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("forbidden");
  });
});
