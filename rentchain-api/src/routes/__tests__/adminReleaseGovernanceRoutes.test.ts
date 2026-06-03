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
          const docs = Array.from(ensureCollection(name).values()).map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

let mockUser: any;

vi.mock("../../firebase", () => ({ db: fakeDb }));
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockUser) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = mockUser;
    return next();
  },
}));

async function invokeRouter(router: any, options: { method: string; url: string; user?: Record<string, unknown> | null }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    mockUser = options.user ?? mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: mockUser,
      query: Object.fromEntries(new URLSearchParams(queryString || "").entries()),
      params: {},
      headers: {},
    };
    const match = path.match(/^\/release-governance\/(.+)$/);
    if (match) req.params = { releaseGovernanceId: decodeURIComponent(match[1]) };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => (error ? reject(error) : undefined));
  });
}

describe("adminReleaseGovernanceRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedReleaseGovernanceContext() {
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", status: "ready_for_review", deploymentSecret: "secret-value" });
    seedDoc("operatorReviewSessions", "review-1", { reviewSessionId: "review-1", status: "completed" });
    seedDoc("operationalRiskProfiles", "risk-1", { operationalRiskId: "risk-1", status: "stable" });
    seedDoc("releaseQaRecords", "qa-1", { qaId: "qa-1", status: "passed" });
    seedDoc("events", "event-1", { eventId: "event-1", eventType: "operational_risk_profile_derived" });
  }

  it("returns admin-gated release governance profiles without sensitive payloads", async () => {
    seedReleaseGovernanceContext();
    const router = (await import("../adminReleaseGovernanceRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/release-governance",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/release-governance?releaseVersion=v0.9.0-core-foundation",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        manualApprovalRequired: true,
        autonomousDeploymentEnabled: false,
        autonomousRollbackEnabled: false,
        publicLaunchEnabled: false,
      })
    );
    expect(JSON.stringify(res.body)).not.toContain("deploymentSecret");
    expect(JSON.stringify(res.body)).not.toContain("secret-value");
  });

  it("returns a single release governance profile by id", async () => {
    seedReleaseGovernanceContext();
    const router = (await import("../adminReleaseGovernanceRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/release-governance?releaseVersion=v0.9.0-core-foundation" });
    const id = list.body.profiles[0].releaseGovernanceId;

    const res = await invokeRouter(router, { method: "GET", url: `/release-governance/${encodeURIComponent(id)}` });

    expect(res.status).toBe(200);
    expect(res.body.profile.releaseGovernanceId).toBe(id);
  });

  it("filters by status", async () => {
    seedReleaseGovernanceContext();
    const router = (await import("../adminReleaseGovernanceRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/release-governance?status=unknown" });

    expect(filtered.status).toBe(200);
    expect(filtered.body.profiles).toEqual([]);
  });
});
