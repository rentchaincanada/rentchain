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
vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, res: any, next: any) => {
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

describe("tenantOnboardingHardeningRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "tenant-user-1", role: "tenant", tenantId: "tenant-1" };
  });

  function seedOnboardingContext() {
    seedDoc("rentalApplications", "application-1", { applicationId: "application-1", tenantId: "tenant-1", status: "completed", rawGovernmentId: "hidden" });
    seedDoc("tenantProfiles", "profile-1", { profileId: "profile-1", tenantId: "tenant-1", status: "verified", privateTenantData: "hidden" });
    seedDoc("screeningOrders", "screening-1", { screeningOrderId: "screening-1", tenantId: "tenant-1", status: "configured", creditBureauPayload: "hidden" });
    seedDoc("tenantAccessGrants", "integration-1", { integrationId: "integration-1", tenantId: "tenant-1", status: "active", providerCredential: "hidden" });
    seedDoc("adminAlerts", "friction-1", { frictionId: "friction-1", tenantId: "tenant-1", status: "resolved", adminOnlyPayload: "hidden" });
    seedDoc("operatorReviewSessions", "review-1", { reviewSessionId: "review-1", tenantId: "tenant-1", status: "completed", privateNote: "hidden" });
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", tenantId: "tenant-1", status: "verified", rawScreeningPayload: "hidden" });
    seedDoc("events", "event-1", { eventId: "event-1", resourceId: "tenant-1", eventType: "onboarding_hardening_profile_derived", unrestrictedAuditHistory: "hidden" });
    seedDoc("tenantProfiles", "other-profile", { profileId: "other-profile", tenantId: "tenant-2", status: "verified" });
  }

  it("returns tenant-scoped onboarding-hardening profiles without sensitive payloads", async () => {
    seedOnboardingContext();
    const router = (await import("../tenantOnboardingHardeningRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/onboarding-hardening",
      user: { id: "landlord-1", role: "landlord", tenantId: "tenant-1" },
    });
    expect(forbidden.status).toBe(401);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/onboarding-hardening?participantType=tenant",
      user: { id: "tenant-user-1", role: "tenant", tenantId: "tenant-1" },
    });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        participantType: "tenant",
        participantId: "tenant-1",
        manualReviewRequired: true,
        autonomousOnboardingEnabled: false,
        autonomousScreeningActivationEnabled: false,
      })
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("tenant-2");
    expect(serialized).not.toContain("rawGovernmentId");
    expect(serialized).not.toContain("privateTenantData");
    expect(serialized).not.toContain("creditBureauPayload");
    expect(serialized).not.toContain("providerCredential");
    expect(serialized).not.toContain("adminOnlyPayload");
    expect(serialized).not.toContain("privateNote");
    expect(serialized).not.toContain("rawScreeningPayload");
    expect(serialized).not.toContain("unrestrictedAuditHistory");
  });

  it("filters by participant type and status", async () => {
    seedOnboardingContext();
    const router = (await import("../tenantOnboardingHardeningRoutes")).default;

    const wrongType = await invokeRouter(router, { method: "GET", url: "/onboarding-hardening?participantType=landlord" });
    const wrongStatus = await invokeRouter(router, { method: "GET", url: "/onboarding-hardening?status=blocked" });

    expect(wrongType.status).toBe(200);
    expect(wrongType.body.profiles).toEqual([]);
    expect(wrongStatus.status).toBe(200);
    expect(wrongStatus.body.profiles).toEqual([]);
  });
});
