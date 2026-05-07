import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }
  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => (op === "==" ? doc?.data?.[field] === value : false));
  }
  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    };
  }
  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
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
vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const role = String(req.user?.role || "").trim().toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id;
    if (role !== "landlord" && role !== "admin") return res.status(403).json({ ok: false, error: "Forbidden" });
    if (!landlordId) return res.status(401).json({ ok: false, error: "Missing landlord context" });
    req.user.landlordId = landlordId;
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

describe("landlordOnboardingHardeningRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
  });

  function seedOnboardingContext() {
    seedDoc("properties", "property-1", { landlordId: "landlord-1", onboardingId: "property-1", status: "completed", privateTenantData: "hidden" });
    seedDoc("landlordProfiles", "profile-1", { landlordId: "landlord-1", profileId: "profile-1", status: "verified", rawGovernmentId: "hidden" });
    seedDoc("screeningOrders", "screening-1", { landlordId: "landlord-1", screeningOrderId: "screening-1", status: "configured", creditBureauPayload: "hidden" });
    seedDoc("interoperabilityAdapterReadiness", "integration-1", { landlordId: "landlord-1", integrationReadinessId: "integration-1", status: "active", providerCredential: "hidden" });
    seedDoc("adminAlerts", "friction-1", { landlordId: "landlord-1", frictionId: "friction-1", status: "resolved", adminOnlyPayload: "hidden" });
    seedDoc("operatorReviewSessions", "review-1", { landlordId: "landlord-1", reviewSessionId: "review-1", status: "completed", privateNote: "hidden" });
    seedDoc("evidencePacks", "evidence-1", { landlordId: "landlord-1", evidencePackId: "evidence-1", status: "verified", rawScreeningPayload: "hidden" });
    seedDoc("events", "event-1", { landlordId: "landlord-1", eventId: "event-1", eventType: "onboarding_hardening_profile_derived", unrestrictedAuditHistory: "hidden" });
    seedDoc("landlordProfiles", "other-profile", { landlordId: "landlord-2", profileId: "other-profile", status: "verified" });
  }

  it("returns landlord-scoped onboarding-hardening profiles without sensitive payloads", async () => {
    seedOnboardingContext();
    const router = (await import("../landlordOnboardingHardeningRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/onboarding-hardening",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/onboarding-hardening?participantType=landlord",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        participantType: "landlord",
        participantId: "landlord-1",
        manualReviewRequired: true,
        autonomousOnboardingEnabled: false,
        autonomousScreeningActivationEnabled: false,
      })
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("landlord-2");
    expect(serialized).not.toContain("privateTenantData");
    expect(serialized).not.toContain("rawGovernmentId");
    expect(serialized).not.toContain("creditBureauPayload");
    expect(serialized).not.toContain("providerCredential");
    expect(serialized).not.toContain("adminOnlyPayload");
    expect(serialized).not.toContain("privateNote");
    expect(serialized).not.toContain("rawScreeningPayload");
    expect(serialized).not.toContain("unrestrictedAuditHistory");
  });

  it("filters by participant type and status", async () => {
    seedOnboardingContext();
    const router = (await import("../landlordOnboardingHardeningRoutes")).default;

    const wrongType = await invokeRouter(router, { method: "GET", url: "/onboarding-hardening?participantType=tenant" });
    const wrongStatus = await invokeRouter(router, { method: "GET", url: "/onboarding-hardening?status=blocked" });

    expect(wrongType.status).toBe(200);
    expect(wrongType.body.profiles).toEqual([]);
    expect(wrongStatus.status).toBe(200);
    expect(wrongStatus.body.profiles).toEqual([]);
  });
});
