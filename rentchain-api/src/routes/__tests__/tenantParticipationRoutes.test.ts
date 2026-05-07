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
    const match = path.match(/^\/participation-profile\/(.+)$/);
    if (match) req.params = { tenantParticipationId: decodeURIComponent(match[1]) };
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

describe("tenantParticipationRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "tenant-user-1", role: "tenant", tenantId: "tenant-1" };
  });

  function seedParticipationContext() {
    seedDoc("rentalApplications", "application-1", { applicationId: "application-1", tenantId: "tenant-1", status: "completed", rawGovernmentId: "hidden" });
    seedDoc("ledgerEvents", "payment-1", { ledgerEventId: "payment-1", tenantId: "tenant-1", status: "verified", paymentAccount: "hidden" });
    seedDoc("verifiedRentalHistoryLedgers", "ledger-1", { rentalHistoryLedgerId: "ledger-1", tenantId: "tenant-1", status: "verified", rawPaymentPayload: "hidden" });
    seedDoc("maintenanceRequests", "maintenance-1", { maintenanceRequestId: "maintenance-1", tenantId: "tenant-1", status: "completed", privateTenantData: "hidden" });
    seedDoc("operatorReviewSessions", "review-1", { reviewSessionId: "review-1", tenantId: "tenant-1", status: "completed", privateNote: "hidden" });
    seedDoc("disputeResolutionReadiness", "dispute-1", { disputeResolutionId: "dispute-1", tenantId: "tenant-1", status: "ready_for_review", rawDisputePayload: "hidden" });
    seedDoc("tenantMessages", "message-1", { communicationId: "message-1", tenantId: "tenant-1", status: "available", messageBody: "hidden" });
    seedDoc("evidencePacks", "evidence-1", { evidencePackId: "evidence-1", tenantId: "tenant-1", status: "ready_for_review", creditBureauPayload: "hidden" });
    seedDoc("events", "event-1", { eventId: "event-1", resourceId: "tenant-1", eventType: "tenant_participation_profile_derived", unrestrictedAuditHistory: "hidden" });
    seedDoc("ledgerEvents", "other-payment", { ledgerEventId: "other-payment", tenantId: "tenant-2", status: "verified" });
  }

  it("returns tenant-scoped participation profiles without sensitive payloads", async () => {
    seedParticipationContext();
    const router = (await import("../tenantParticipationRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/participation-profile",
      user: { id: "landlord-1", role: "landlord", tenantId: "tenant-1" },
    });
    expect(forbidden.status).toBe(401);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/participation-profile",
      user: { id: "tenant-user-1", role: "tenant", tenantId: "tenant-1" },
    });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        manualReviewRequired: true,
        publicParticipationExposureEnabled: false,
        autonomousRewardExecutionEnabled: false,
      })
    );
    expect(JSON.stringify(res.body)).not.toContain("tenant-2");
    expect(JSON.stringify(res.body)).not.toContain("rawGovernmentId");
    expect(JSON.stringify(res.body)).not.toContain("paymentAccount");
    expect(JSON.stringify(res.body)).not.toContain("rawPaymentPayload");
    expect(JSON.stringify(res.body)).not.toContain("privateTenantData");
    expect(JSON.stringify(res.body)).not.toContain("privateNote");
    expect(JSON.stringify(res.body)).not.toContain("rawDisputePayload");
    expect(JSON.stringify(res.body)).not.toContain("messageBody");
    expect(JSON.stringify(res.body)).not.toContain("creditBureauPayload");
    expect(JSON.stringify(res.body)).not.toContain("unrestrictedAuditHistory");
  });

  it("returns a single tenant participation profile by id", async () => {
    seedParticipationContext();
    const router = (await import("../tenantParticipationRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/participation-profile" });
    const id = list.body.profiles[0].tenantParticipationId;

    const res = await invokeRouter(router, { method: "GET", url: `/participation-profile/${encodeURIComponent(id)}` });

    expect(res.status).toBe(200);
    expect(res.body.profile.tenantParticipationId).toBe(id);
  });

  it("filters by status", async () => {
    seedParticipationContext();
    const router = (await import("../tenantParticipationRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/participation-profile?status=blocked" });

    expect(filtered.status).toBe(200);
    expect(filtered.body.profiles).toEqual([]);
  });
});
