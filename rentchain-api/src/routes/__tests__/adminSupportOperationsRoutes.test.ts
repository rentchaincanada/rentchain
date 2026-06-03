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
vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    const role = String(req.user?.actorRole || req.user?.role || "").trim().toLowerCase();
    if (role !== "admin") return res.status(403).json({ ok: false, error: "FORBIDDEN" });
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
    const match = path.match(/^\/support-operations\/(.+)$/);
    if (match) req.params = { supportOperationsId: decodeURIComponent(match[1]) };
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

describe("adminSupportOperationsRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin" };
  });

  function seedSupportOperations() {
    seedDoc("supportTickets", "ticket-1", { supportTicketId: "ticket-1", status: "resolved", privateTenantData: "hidden" });
    seedDoc("onboardingHardeningProfiles", "onboarding-1", { onboardingHardeningId: "onboarding-1", status: "ready_for_review", rawGovernmentId: "hidden" });
    seedDoc("platformCredentialingReadiness", "credentialing-1", { platformCredentialingId: "credentialing-1", status: "ready_for_review", providerCredential: "hidden" });
    seedDoc("statusIncidents", "incident-1", { incidentId: "incident-1", status: "resolved", rawTelemetryPayload: "hidden" });
    seedDoc("operationalRiskProfiles", "risk-1", { operationalRiskProfileId: "risk-1", status: "ready_for_review", adminOnlyPayload: "hidden" });
    seedDoc("operatorReviewSessions", "review-1", { reviewSessionId: "review-1", status: "completed", privateNote: "hidden" });
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", status: "verified", creditBureauPayload: "hidden" });
    seedDoc("events", "event-1", { eventId: "event-1", eventType: "support_operations_profile_derived", paymentAccount: "hidden" });
  }

  it("returns support-operations profiles for admins without sensitive payloads", async () => {
    seedSupportOperations();
    const router = (await import("../adminSupportOperationsRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/support-operations",
      user: { id: "landlord-1", role: "landlord" },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, { method: "GET", url: "/support-operations", user: { id: "admin-1", role: "admin" } });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        manualReviewRequired: true,
        autonomousSupportExecutionEnabled: false,
        adminImpersonationEnabled: false,
      })
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("privateTenantData");
    expect(serialized).not.toContain("rawGovernmentId");
    expect(serialized).not.toContain("providerCredential");
    expect(serialized).not.toContain("rawTelemetryPayload");
    expect(serialized).not.toContain("adminOnlyPayload");
    expect(serialized).not.toContain("privateNote");
    expect(serialized).not.toContain("creditBureauPayload");
    expect(serialized).not.toContain("paymentAccount");
  });

  it("returns a single support-operations profile by id and filters by status", async () => {
    seedSupportOperations();
    const router = (await import("../adminSupportOperationsRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/support-operations" });
    const id = list.body.profiles[0].supportOperationsId;

    const one = await invokeRouter(router, { method: "GET", url: `/support-operations/${encodeURIComponent(id)}` });
    const filtered = await invokeRouter(router, { method: "GET", url: "/support-operations?status=blocked" });

    expect(one.status).toBe(200);
    expect(one.body.profile.supportOperationsId).toBe(id);
    expect(filtered.status).toBe(200);
    expect(filtered.body.profiles).toEqual([]);
  });
});
