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
    const match = path.match(/^\/production-integrations\/(.+)$/);
    if (match) req.params = { productionIntegrationId: decodeURIComponent(match[1]) };
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

describe("adminProductionIntegrationsRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedReadinessContext() {
    seedDoc("productionIntegrationMetadata", "registry-production", {
      productionIntegrationId: "activation-1",
      integrationKey: "registry-production",
      integrationType: "registry",
      status: "sandbox_ready",
      providerSecret: "provider-secret",
      webhookSecret: "webhook-secret",
      apiToken: "api-token",
    });
    seedDoc("interoperabilityAdapterReadiness", "adapter-1", { adapterReadinessId: "adapter-1", adapterType: "registry", status: "ready_for_review", providerToken: "provider-token-secret" });
    seedDoc("controlledIntegrationProfiles", "controlled-1", { controlledIntegrationId: "controlled-1", integrationType: "registry", status: "sandbox_ready", rawProviderPayload: "hidden" });
    seedDoc("observabilityIncidentReadinessProfiles", "observability-1", { observabilityIncidentReadinessId: "observability-1", status: "ready_for_review", rawTelemetry: "hidden" });
    seedDoc("releaseGovernanceProfiles", "release-1", { releaseGovernanceId: "release-1", status: "ready_for_review" });
    seedDoc("supportOperationsProfiles", "support-1", { supportOperationsId: "support-1", status: "stable", adminOnlyPayload: "hidden" });
    seedDoc("operatorReviewSessions", "review-1", { reviewSessionId: "review-1", status: "completed", privateNote: "hidden" });
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", status: "ready_for_review", privateTenantData: "hidden" });
    seedDoc("operationalRiskProfiles", "risk-1", { operationalRiskId: "risk-1", status: "stable", privateRiskPayload: "hidden" });
    seedDoc("regulatoryProfiles", "regulatory-1", { regulatoryProfileId: "regulatory-1", status: "ready_for_review", regulatorToken: "hidden" });
    seedDoc("events", "event-1", { eventId: "event-1", eventType: "production_integration_profile_derived", rawWebhookPayload: "hidden" });
  }

  it("returns admin-gated production integration profiles without sensitive integration payloads", async () => {
    seedReadinessContext();
    const router = (await import("../adminProductionIntegrationsRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/production-integrations",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/production-integrations?integrationType=registry",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        manualApprovalRequired: true,
        autonomousExecutionEnabled: false,
        paymentExecutionEnabled: false,
        unrestrictedWebhookExecutionEnabled: false,
      })
    );
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain("provider-secret");
    expect(payload).not.toContain("webhook-secret");
    expect(payload).not.toContain("api-token");
    expect(payload).not.toContain("provider-token-secret");
    expect(payload).not.toContain("rawProviderPayload");
    expect(payload).not.toContain("rawTelemetry");
    expect(payload).not.toContain("privateTenantData");
    expect(payload).not.toContain("rawWebhookPayload");
    expect(payload).not.toContain("privateNote");
  });

  it("returns a single production integration profile by id and filters by status", async () => {
    seedReadinessContext();
    const router = (await import("../adminProductionIntegrationsRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/production-integrations?integrationType=registry" });
    const id = list.body.profiles[0].productionIntegrationId;

    const one = await invokeRouter(router, { method: "GET", url: `/production-integrations/${encodeURIComponent(id)}` });
    const filtered = await invokeRouter(router, { method: "GET", url: "/production-integrations?status=blocked" });

    expect(one.status).toBe(200);
    expect(one.body.profile.productionIntegrationId).toBe(id);
    expect(filtered.status).toBe(200);
    expect(filtered.body.profiles).toEqual([]);
  });
});
