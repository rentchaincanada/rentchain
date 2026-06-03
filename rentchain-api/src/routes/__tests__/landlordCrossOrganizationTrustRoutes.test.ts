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
      doc: (id: string) => makeDoc(name, id),
    };
  }
  function makeDoc(name: string, id: string) {
    const col = ensureCollection(name);
    return {
      id,
      get: async () => {
        const entry = col.get(id);
        return { id, exists: Boolean(entry), data: () => entry?.data };
      },
      set: async (data: any) => {
        col.set(id, { id, data });
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
        doc: (id: string) => makeDoc(name, id),
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
vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const role = String(req.user?.role || "").trim().toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id;
    if (role !== "landlord" && role !== "admin") return res.status(403).json({ ok: false, error: "Forbidden" });
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
      body: {},
      headers: {},
    };
    const match = path.match(/^\/cross-organization-trust\/(.+)$/);
    if (match) req.params = { trustRelationshipId: decodeURIComponent(match[1]) };
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

describe("landlordCrossOrganizationTrustRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
  });

  function seedTrustContext() {
    seedDoc("properties", "property-1", { landlordId: "landlord-1", propertyId: "property-1", province: "NS", municipality: "Halifax" });
    seedDoc("operatorReviewSessions", "review-1", { landlordId: "landlord-1", reviewSessionId: "review-1", status: "completed" });
    seedDoc("evidencePacks", "evidence-1", { landlordId: "landlord-1", evidencePackId: "evidence-1", status: "ready_for_review" });
    seedDoc("institutionalSharingRooms", "room-1", {
      landlordId: "landlord-1",
      sharingRoomId: "room-1",
      status: "active",
      publiclyAccessible: false,
      externalExecutionEnabled: false,
      accessControls: { institutionType: "lender" },
    });
    seedDoc("events", "event-1", { landlordId: "landlord-1", eventId: "event-1", eventType: "operator_review_session_closed" });
    seedDoc("consents", "consent-1", { landlordId: "landlord-1", consentScope: "trust_review", rawGovernmentId: "sensitive-id" });
  }

  it("returns landlord-scoped trust relationships without sensitive payloads", async () => {
    seedTrustContext();
    const router = (await import("../landlordCrossOrganizationTrustRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/cross-organization-trust?relationshipType=operational_trust" });

    expect(res.status).toBe(200);
    expect(res.body.trustRelationships).toHaveLength(1);
    expect(res.body.trustRelationships[0]).toEqual(
      expect.objectContaining({ manualReviewRequired: true, publicTrustExposureEnabled: false, autonomousTrustApprovalEnabled: false })
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("sensitive-id");
  });

  it("returns a single trust relationship by id", async () => {
    seedTrustContext();
    const router = (await import("../landlordCrossOrganizationTrustRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/cross-organization-trust?relationshipType=sharing_trust" });
    const id = list.body.trustRelationships[0].trustRelationshipId;

    const res = await invokeRouter(router, { method: "GET", url: `/cross-organization-trust/${encodeURIComponent(id)}` });

    expect(res.status).toBe(200);
    expect(res.body.trustRelationship.trustRelationshipId).toBe(id);
  });

  it("filters by status and blocks non-landlord users", async () => {
    seedTrustContext();
    const router = (await import("../landlordCrossOrganizationTrustRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/cross-organization-trust?relationshipType=operational_trust&status=unknown" });
    expect(filtered.status).toBe(200);
    expect(filtered.body.trustRelationships).toEqual([]);

    const forbidden = await invokeRouter(router, { method: "GET", url: "/cross-organization-trust", user: { id: "tenant-1", role: "tenant" } });
    expect(forbidden.status).toBe(403);
  });
});
