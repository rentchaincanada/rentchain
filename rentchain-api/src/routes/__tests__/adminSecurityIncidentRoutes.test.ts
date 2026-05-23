import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }
  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        get: async () => {
          const docs = Array.from(ensureCollection(name).values()).map((doc) => ({
            id: doc.id,
            exists: true,
            data: () => doc.data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

let mockUser: any;

vi.mock("../../config/firebase", () => ({ db: fakeDb }));
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockUser) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = mockUser;
    return next();
  },
}));
vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    if (req.user?.role !== "admin" && !permissions.includes("system.admin")) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    return next();
  },
}));

async function invokeRouter(router: any, options: { method: string; url: string; user?: Record<string, unknown> | null }) {
  return await new Promise<{ status: number; body: any; headers: Record<string, string> }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const detailMatch = path.match(/^\/security\/incidents\/(.+)$/);
    mockUser = options.user ?? mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      query: Object.fromEntries(new URLSearchParams(queryString || "").entries()),
      params: detailMatch ? { incidentId: decodeURIComponent(detailMatch[1]) } : {},
      headers: {},
      user: mockUser,
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        this.headers[String(name).toLowerCase()] = value;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
    };
    router.handle(req, res, (error: any) => (error ? reject(error) : undefined));
  });
}

describe("adminSecurityIncidentRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedIncidentContext() {
    seedDoc("telemetry_events", "telemetry-1", {
      type: "impersonation.started",
      actor: "admin-raw-id",
      landlordId: "landlord-raw-id",
      ts: 1779540000000,
      meta: {
        realActorId: "admin-raw-id",
        realActorRole: "admin",
        effectiveActorId: "tenant-raw-id",
        effectiveActorRole: "tenant",
        impersonationSessionId: "session-raw-id",
        sourceActionFamily: "admin_support_impersonation",
        policyDecision: "allowed",
        token: "secret-token",
      },
    });
    seedDoc("events", "event-1", {
      eventType: "route_source_anomaly",
      occurredAt: "2026-05-23T12:00:00.000Z",
      routeSource: "not-found",
      requestBody: { authorization: "Bearer secret" },
    });
    seedDoc("events", "event-2", {
      eventType: "lease_updated",
      occurredAt: "2026-05-23T12:05:00.000Z",
      rawProviderPayload: "must-not-render",
    });
  }

  it("denies non-admin access and returns admin-only metadata incident summaries", async () => {
    seedIncidentContext();
    const router = (await import("../adminSecurityIncidentRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/security/incidents",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/security/incidents",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("adminSecurityIncidentRoutes.ts");
    expect(res.body.incidents).toHaveLength(2);
    expect(res.body.summary.metadataOnly).toBe(true);
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain("admin-raw-id");
    expect(payload).not.toContain("tenant-raw-id");
    expect(payload).not.toContain("session-raw-id");
    expect(payload).not.toContain("secret-token");
    expect(payload).not.toContain("Bearer secret");
    expect(payload).not.toContain("must-not-render");
  });

  it("filters incidents and returns a safe detail payload", async () => {
    seedIncidentContext();
    const router = (await import("../adminSecurityIncidentRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/security/incidents?category=route_source_anomaly" });
    expect(filtered.status).toBe(200);
    expect(filtered.body.incidents).toHaveLength(1);
    expect(filtered.body.incidents[0].category).toBe("route_source_anomaly");

    const incidentId = filtered.body.incidents[0].incidentId;
    const detail = await invokeRouter(router, {
      method: "GET",
      url: `/security/incidents/${encodeURIComponent(incidentId)}`,
    });

    expect(detail.status).toBe(200);
    expect(detail.body.incident).toEqual(
      expect.objectContaining({
        incidentId,
        metadataOnly: true,
        timeline: expect.any(Array),
        redactionNotes: expect.any(Array),
      })
    );
    expect(JSON.stringify(detail.body)).not.toContain("Bearer secret");
  });

  it("returns a useful empty state when no supported security events exist", async () => {
    seedDoc("events", "event-unrelated", { eventType: "lease_updated", rawPayload: "hidden" });
    const router = (await import("../adminSecurityIncidentRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/security/incidents" });

    expect(res.status).toBe(200);
    expect(res.body.incidents).toEqual([]);
    expect(res.body.summary.total).toBe(0);
    expect(JSON.stringify(res.body)).not.toContain("hidden");
  });
});
