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
    const match = path.match(/^\/ecosystem-coordination\/(.+)$/);
    if (match) req.params = { ecosystemCoordinationId: decodeURIComponent(match[1]) };
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

describe("adminEcosystemCoordinationRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedReadinessContext() {
    seedDoc("networkParticipantProfiles", "participant-1", { participantId: "participant-1", status: "verified", rawGovernmentId: "hidden" });
    seedDoc("crossOrganizationTrustRelationships", "trust-1", { trustRelationshipId: "trust-1", status: "verified", privateTrustNote: "hidden" });
    seedDoc("institutionOnboardingReadiness", "onboarding-1", { onboardingReadinessId: "onboarding-1", status: "ready_for_review", privateTenantData: "hidden" });
    seedDoc("operationalRiskProfiles", "risk-1", { operationalRiskId: "risk-1", status: "stable", rawTelemetry: "hidden" });
    seedDoc("interoperabilityAdapterReadiness", "adapter-1", { adapterReadinessId: "adapter-1", status: "ready_for_review", providerSecret: "hidden" });
    seedDoc("controlledIntegrationProfiles", "controlled-1", { controlledIntegrationId: "controlled-1", status: "sandbox_ready", webhookSecret: "hidden" });
    seedDoc("settlementReadiness", "settlement-1", { settlementReadinessId: "settlement-1", status: "ready_for_review", bankingPayload: "hidden" });
    seedDoc("regulatoryProfiles", "regulatory-1", { regulatoryProfileId: "regulatory-1", status: "ready_for_review", governmentId: "hidden" });
    seedDoc("observabilityIncidentReadinessProfiles", "observability-1", { observabilityIncidentReadinessId: "observability-1", status: "ready_for_review", unrestrictedTelemetry: "hidden" });
    seedDoc("releaseGovernanceProfiles", "release-1", { releaseGovernanceId: "release-1", status: "ready_for_review", deployToken: "hidden" });
    seedDoc("publicExposureHardeningProfiles", "public-exposure-1", { publicExposureHardeningId: "public-exposure-1", status: "ready_for_review" });
    seedDoc("commercialReadinessProfiles", "commercial-1", { commercialReadinessId: "commercial-1", status: "ready_for_review" });
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", status: "ready_for_review", rawPaymentPayload: "hidden" });
    seedDoc("operatorReviewSessions", "review-1", { reviewSessionId: "review-1", status: "completed", privateNote: "hidden" });
    seedDoc("events", "event-1", { eventId: "event-1", eventType: "ecosystem_coordination_snapshot_derived", rawAuditPayload: "hidden" });
  }

  it("returns admin-gated ecosystem coordination snapshots without sensitive ecosystem payloads", async () => {
    seedReadinessContext();
    const router = (await import("../adminEcosystemCoordinationRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/ecosystem-coordination",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/ecosystem-coordination",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(1);
    expect(res.body.snapshots[0]).toEqual(
      expect.objectContaining({
        manualReviewRequired: true,
        autonomousCoordinationEnabled: false,
        externalExecutionEnabled: false,
      })
    );
    expect(JSON.stringify(res.body)).not.toContain("rawGovernmentId");
    expect(JSON.stringify(res.body)).not.toContain("privateTenantData");
    expect(JSON.stringify(res.body)).not.toContain("rawTelemetry");
    expect(JSON.stringify(res.body)).not.toContain("providerSecret");
    expect(JSON.stringify(res.body)).not.toContain("webhookSecret");
    expect(JSON.stringify(res.body)).not.toContain("bankingPayload");
    expect(JSON.stringify(res.body)).not.toContain("rawPaymentPayload");
    expect(JSON.stringify(res.body)).not.toContain("privateNote");
  });

  it("returns a single ecosystem coordination snapshot by id", async () => {
    seedReadinessContext();
    const router = (await import("../adminEcosystemCoordinationRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/ecosystem-coordination" });
    const id = list.body.snapshots[0].ecosystemCoordinationId;

    const res = await invokeRouter(router, { method: "GET", url: `/ecosystem-coordination/${encodeURIComponent(id)}` });

    expect(res.status).toBe(200);
    expect(res.body.snapshot.ecosystemCoordinationId).toBe(id);
  });

  it("filters by status", async () => {
    seedReadinessContext();
    const router = (await import("../adminEcosystemCoordinationRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/ecosystem-coordination?status=blocked" });

    expect(filtered.status).toBe(200);
    expect(filtered.body.snapshots).toEqual([]);
  });
});
