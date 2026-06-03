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
    const match = path.match(/^\/enterprise-municipal-readiness\/(.+)$/);
    if (match) req.params = { enterpriseMunicipalReadinessId: decodeURIComponent(match[1]) };
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

describe("adminEnterpriseMunicipalReadinessRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedReadinessContext() {
    seedDoc("institutionOnboardingReadiness", "institution-1", { onboardingReadinessId: "institution-1", institutionType: "municipality", status: "ready_for_review", rawGovernmentId: "hidden" });
    seedDoc("commercialReadinessProfiles", "commercial-1", { commercialReadinessId: "commercial-1", status: "ready_for_review", adminOnlyPayload: "hidden" });
    seedDoc("platformCredentialingReadiness", "credentialing-1", { platformCredentialingId: "credentialing-1", status: "ready_for_review", providerCredential: "hidden" });
    seedDoc("portfolioGovernanceReadiness", "portfolio-1", { portfolioGovernanceId: "portfolio-1", status: "ready_for_review", privateTenantData: "hidden" });
    seedDoc("productionIntegrationMetadata", "municipal-1", { municipalReadinessId: "municipal-1", organizationType: "municipality", status: "ready_for_review", governmentCredential: "hidden" });
    seedDoc("interoperabilityAdapterReadiness", "adapter-1", { adapterReadinessId: "adapter-1", adapterType: "registry", status: "ready_for_review", providerToken: "hidden" });
    seedDoc("regulatoryProfiles", "regulatory-1", { regulatoryProfileId: "regulatory-1", status: "ready_for_review", rawRegistryPayload: "hidden" });
    seedDoc("operationalRiskProfiles", "risk-1", { operationalRiskId: "risk-1", status: "stable", privateRiskPayload: "hidden" });
    seedDoc("operatorReviewSessions", "review-1", { reviewSessionId: "review-1", status: "completed", privateNote: "hidden" });
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", status: "ready_for_review", creditBureauPayload: "hidden" });
    seedDoc("events", "event-1", { eventId: "event-1", eventType: "enterprise_municipal_readiness_profile_derived", rawPaymentPayload: "hidden" });
  }

  it("returns admin-gated profiles without sensitive institutional payloads", async () => {
    seedReadinessContext();
    const router = (await import("../adminEnterpriseMunicipalReadinessRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/enterprise-municipal-readiness",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/enterprise-municipal-readiness?organizationType=municipality",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        manualApprovalRequired: true,
        autonomousGovernmentExecutionEnabled: false,
        autonomousEnterpriseExecutionEnabled: false,
      })
    );
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain("rawGovernmentId");
    expect(payload).not.toContain("adminOnlyPayload");
    expect(payload).not.toContain("providerCredential");
    expect(payload).not.toContain("privateTenantData");
    expect(payload).not.toContain("governmentCredential");
    expect(payload).not.toContain("providerToken");
    expect(payload).not.toContain("rawRegistryPayload");
    expect(payload).not.toContain("creditBureauPayload");
    expect(payload).not.toContain("rawPaymentPayload");
  });

  it("returns a single enterprise municipal profile by id and filters by status", async () => {
    seedReadinessContext();
    const router = (await import("../adminEnterpriseMunicipalReadinessRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/enterprise-municipal-readiness?organizationType=municipality" });
    const id = list.body.profiles[0].enterpriseMunicipalReadinessId;

    const one = await invokeRouter(router, { method: "GET", url: `/enterprise-municipal-readiness/${encodeURIComponent(id)}` });
    const filtered = await invokeRouter(router, { method: "GET", url: "/enterprise-municipal-readiness?status=blocked" });

    expect(one.status).toBe(200);
    expect(one.body.profile.enterpriseMunicipalReadinessId).toBe(id);
    expect(filtered.status).toBe(200);
    expect(filtered.body.profiles).toEqual([]);
  });
});
