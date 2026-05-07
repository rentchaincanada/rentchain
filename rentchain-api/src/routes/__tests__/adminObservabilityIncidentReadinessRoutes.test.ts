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
    const match = path.match(/^\/observability-incident-readiness\/(.+)$/);
    if (match) req.params = { observabilityIncidentReadinessId: decodeURIComponent(match[1]) };
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

describe("adminObservabilityIncidentReadinessRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedReadinessContext() {
    seedDoc("systemObservabilityEvents", "obs-1", {
      eventType: "workflow_completed",
      status: "resolved",
      severity: "info",
      requestBody: "sensitive-payload",
      stackTrace: "stack-value",
    });
    seedDoc("statusIncidents", "incident-1", { status: "resolved", severity: "minor", privateTelemetry: "hidden" });
    seedDoc("incidentRecoveryReadiness", "recovery-1", { recoveryReadinessId: "recovery-1", status: "ready_for_review", credentials: "secret-value" });
    seedDoc("incidentEscalationReadiness", "escalation-1", { escalationReadinessId: "escalation-1", status: "ready_for_review" });
    seedDoc("postIncidentReviews", "review-1", { postIncidentReviewId: "post-incident-1", status: "ready_for_review" });
    seedDoc("slaEvaluations", "sla-1", { slaId: "sla-1", stage: "fresh" });
    seedDoc("adminAlerts", "alert-1", { alertId: "alert-1", severity: "low", webhookUrl: "https://example.test/hook" });
    seedDoc("releaseGovernanceProfiles", "release-1", { releaseGovernanceId: "release-1", status: "ready_for_review" });
    seedDoc("publicExposureHardeningProfiles", "public-exposure-1", { publicExposureHardeningId: "public-exposure-1", status: "ready_for_review" });
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", status: "ready_for_review", rawGovernmentId: "sensitive-id" });
    seedDoc("operatorReviewSessions", "operator-review-1", { reviewSessionId: "operator-review-1", status: "completed", privateNote: "hidden" });
    seedDoc("events", "event-1", { eventId: "event-1", eventType: "observability_incident_readiness_profile_derived" });
  }

  it("returns admin-gated readiness profiles without sensitive telemetry payloads", async () => {
    seedReadinessContext();
    const router = (await import("../adminObservabilityIncidentReadinessRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/observability-incident-readiness",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/observability-incident-readiness",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        manualReviewRequired: true,
        externalMonitoringIntegrationEnabled: false,
        autonomousRemediationEnabled: false,
        alertSendingEnabled: false,
        productionMutationEnabled: false,
        sensitiveTelemetryExposed: false,
      })
    );
    expect(JSON.stringify(res.body)).not.toContain("sensitive-payload");
    expect(JSON.stringify(res.body)).not.toContain("stack-value");
    expect(JSON.stringify(res.body)).not.toContain("secret-value");
    expect(JSON.stringify(res.body)).not.toContain("webhook");
    expect(JSON.stringify(res.body)).not.toContain("sensitive-id");
    expect(JSON.stringify(res.body)).not.toContain("privateNote");
  });

  it("returns a single readiness profile by id", async () => {
    seedReadinessContext();
    const router = (await import("../adminObservabilityIncidentReadinessRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/observability-incident-readiness" });
    const id = list.body.profiles[0].observabilityIncidentReadinessId;

    const res = await invokeRouter(router, { method: "GET", url: `/observability-incident-readiness/${encodeURIComponent(id)}` });

    expect(res.status).toBe(200);
    expect(res.body.profile.observabilityIncidentReadinessId).toBe(id);
  });

  it("filters by status", async () => {
    seedReadinessContext();
    const router = (await import("../adminObservabilityIncidentReadinessRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/observability-incident-readiness?status=unknown" });

    expect(filtered.status).toBe(200);
    expect(filtered.body.profiles).toEqual([]);
  });
});
