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

vi.mock("../../config/firebase", () => ({ db: fakeDb }));
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
    const match = path.match(/^\/controlled-integrations\/(.+)$/);
    if (match) req.params = { controlledIntegrationId: decodeURIComponent(match[1]) };
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

describe("adminControlledIntegrationsRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedReadinessContext() {
    seedDoc("controlledIntegrationMetadata", "registry-metadata", {
      integrationKey: "registry-baseline",
      integrationType: "registry",
      status: "sandbox_ready",
      providerSecret: "provider-secret",
      webhookSecret: "webhook-secret",
    });
    seedDoc("interoperabilityAdapterReadiness", "adapter-1", { adapterReadinessId: "adapter-1", adapterType: "registry", status: "ready_for_review", providerToken: "provider-token-secret" });
    seedDoc("operatorReviewSessions", "review-1", { reviewSessionId: "review-1", status: "completed", privateNote: "hidden" });
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", status: "ready_for_review", rawTenantData: "hidden" });
    seedDoc("settlementReadiness", "settlement-1", { settlementReadinessId: "settlement-1", status: "ready_for_review", bankingPayload: "hidden" });
    seedDoc("regulatoryProfiles", "regulatory-1", { regulatoryProfileId: "regulatory-1", status: "ready_for_review", regulatorToken: "hidden" });
    seedDoc("observabilityIncidentReadinessProfiles", "observability-1", { observabilityIncidentReadinessId: "observability-1", status: "ready_for_review", rawTelemetry: "hidden" });
    seedDoc("releaseGovernanceProfiles", "release-1", { releaseGovernanceId: "release-1", status: "ready_for_review" });
    seedDoc("operationalRiskProfiles", "risk-1", { operationalRiskId: "risk-1", status: "stable", privateRiskPayload: "hidden" });
    seedDoc("events", "event-1", { eventId: "event-1", eventType: "controlled_integration_profile_derived", rawWebhookPayload: "hidden" });
  }

  it("returns admin-gated controlled integration profiles without sensitive integration payloads", async () => {
    seedReadinessContext();
    const router = (await import("../adminControlledIntegrationsRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/controlled-integrations",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/controlled-integrations?integrationType=registry",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        manualApprovalRequired: true,
        liveSynchronizationEnabled: false,
        autonomousExecutionEnabled: false,
        webhookExecutionEnabled: false,
      })
    );
    expect(JSON.stringify(res.body)).not.toContain("provider-secret");
    expect(JSON.stringify(res.body)).not.toContain("webhook-secret");
    expect(JSON.stringify(res.body)).not.toContain("provider-token-secret");
    expect(JSON.stringify(res.body)).not.toContain("rawTenantData");
    expect(JSON.stringify(res.body)).not.toContain("bankingPayload");
    expect(JSON.stringify(res.body)).not.toContain("rawWebhookPayload");
    expect(JSON.stringify(res.body)).not.toContain("privateNote");
  });

  it("returns a single controlled integration profile by id", async () => {
    seedReadinessContext();
    const router = (await import("../adminControlledIntegrationsRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/controlled-integrations?integrationType=registry" });
    const id = list.body.profiles[0].controlledIntegrationId;

    const res = await invokeRouter(router, { method: "GET", url: `/controlled-integrations/${encodeURIComponent(id)}` });

    expect(res.status).toBe(200);
    expect(res.body.profile.controlledIntegrationId).toBe(id);
  });

  it("filters by status", async () => {
    seedReadinessContext();
    const router = (await import("../adminControlledIntegrationsRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/controlled-integrations?status=blocked" });

    expect(filtered.status).toBe(200);
    expect(filtered.body.profiles).toEqual([]);
  });
});
