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
    const match = path.match(/^\/platform-credentialing-readiness\/(.+)$/);
    if (match) req.params = { platformCredentialingId: decodeURIComponent(match[1]) };
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

describe("adminPlatformCredentialingRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedReadinessContext() {
    seedDoc("releaseGovernanceProfiles", "release-1", { releaseGovernanceId: "release-1", status: "ready_for_review", deployToken: "hidden" });
    seedDoc("publicExposureHardeningProfiles", "public-exposure-1", { publicExposureHardeningId: "public-exposure-1", status: "ready_for_review" });
    seedDoc("commercialReadinessProfiles", "commercial-1", { commercialReadinessId: "commercial-1", status: "ready_for_review", paymentAccount: "hidden" });
    seedDoc("privacyReadiness", "privacy-1", { privacyReadinessId: "privacy-1", status: "ready_for_review", rawGovernmentId: "hidden" });
    seedDoc("consentGovernance", "consent-1", { consentGovernanceId: "consent-1", status: "ready_for_review", consentSecret: "hidden" });
    seedDoc("events", "event-1", { eventId: "event-1", eventType: "platform_credentialing_readiness_derived", rawAuditPayload: "hidden" });
    seedDoc("identityProfiles", "identity-1", { identityProfileId: "identity-1", status: "ready_for_review", rawScreeningPayload: "hidden" });
    seedDoc("networkParticipantProfiles", "participant-1", { participantId: "participant-1", status: "verified", rawGovernmentId: "hidden" });
    seedDoc("interoperabilityAdapterReadiness", "adapter-1", { adapterReadinessId: "adapter-1", status: "ready_for_review", providerCredential: "hidden" });
    seedDoc("controlledIntegrationProfiles", "controlled-1", { controlledIntegrationId: "controlled-1", status: "sandbox_ready", webhookSecret: "hidden" });
    seedDoc("institutionOnboardingReadiness", "onboarding-1", { onboardingReadinessId: "onboarding-1", status: "ready_for_review", privateTenantData: "hidden" });
    seedDoc("operationalRiskProfiles", "risk-1", { operationalRiskId: "risk-1", status: "stable", unrestrictedTelemetry: "hidden" });
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", status: "ready_for_review", creditBureauPayload: "hidden" });
    seedDoc("operatorReviewSessions", "review-1", { reviewSessionId: "review-1", status: "completed", privateNote: "hidden" });
  }

  it("returns admin-gated platform credentialing readiness without sensitive credentialing payloads", async () => {
    seedReadinessContext();
    const router = (await import("../adminPlatformCredentialingRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/platform-credentialing-readiness",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/platform-credentialing-readiness",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.body.readiness).toHaveLength(1);
    expect(res.body.readiness[0]).toEqual(
      expect.objectContaining({
        manualApprovalRequired: true,
        consumerReportingExecutionEnabled: false,
        autonomousCredentialApprovalEnabled: false,
        publicCredentialExposureEnabled: false,
      })
    );
    expect(JSON.stringify(res.body)).not.toContain("deployToken");
    expect(JSON.stringify(res.body)).not.toContain("paymentAccount");
    expect(JSON.stringify(res.body)).not.toContain("rawGovernmentId");
    expect(JSON.stringify(res.body)).not.toContain("consentSecret");
    expect(JSON.stringify(res.body)).not.toContain("rawAuditPayload");
    expect(JSON.stringify(res.body)).not.toContain("rawScreeningPayload");
    expect(JSON.stringify(res.body)).not.toContain("providerCredential");
    expect(JSON.stringify(res.body)).not.toContain("webhookSecret");
    expect(JSON.stringify(res.body)).not.toContain("privateTenantData");
    expect(JSON.stringify(res.body)).not.toContain("creditBureauPayload");
    expect(JSON.stringify(res.body)).not.toContain("privateNote");
  });

  it("returns a single platform credentialing readiness profile by id", async () => {
    seedReadinessContext();
    const router = (await import("../adminPlatformCredentialingRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/platform-credentialing-readiness" });
    const id = list.body.readiness[0].platformCredentialingId;

    const res = await invokeRouter(router, { method: "GET", url: `/platform-credentialing-readiness/${encodeURIComponent(id)}` });

    expect(res.status).toBe(200);
    expect(res.body.readiness.platformCredentialingId).toBe(id);
  });

  it("filters by status", async () => {
    seedReadinessContext();
    const router = (await import("../adminPlatformCredentialingRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/platform-credentialing-readiness?status=blocked" });

    expect(filtered.status).toBe(200);
    expect(filtered.body.readiness).toEqual([]);
  });
});
