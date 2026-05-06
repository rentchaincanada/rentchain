import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, listDocs } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.data?.[field];
      if (op === "==") return actual === value;
      return false;
    });
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
    listDocs: (collection: string) => Array.from(ensureCollection(collection).values()).map((entry) => entry.data),
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

vi.mock("../../config/firebase", () => ({
  db: fakeDb,
}));

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

async function invokeRouter(router: any, options: { method: string; url: string; body?: any; user?: Record<string, unknown> | null }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    mockUser = options.user ?? mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: mockUser,
      body: options.body || {},
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
    };
    const match = path.match(/^\/sharing-rooms\/([^/]+)(?:\/(revoke))?$/);
    if (match) req.params = { sharingRoomId: decodeURIComponent(match[1]) };
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
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("landlordSharingRoomRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  it("creates permissioned sharing rooms and writes additive events", async () => {
    const router = (await import("../landlordSharingRoomRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/sharing-rooms",
      body: {
        roomType: "lender_review",
        institutionType: "lender",
        sharedScopes: [
          { scopeKey: "evidence_pack", scopeId: "decision-1", label: "Decision evidence" },
          { scopeKey: "identity_lineage", scopeId: "tenant-1", label: "Tenant identity lineage" },
        ],
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.room).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        roomType: "lender_review",
        status: "review_required",
        manualReviewRequired: true,
        publiclyAccessible: false,
        externalExecutionEnabled: false,
        tokenizationEnabled: false,
      })
    );
    expect(res.body.room.accessControls).toEqual(
      expect.objectContaining({
        publicAccess: false,
        downloadEnabled: false,
        externalSubmissionEnabled: false,
      })
    );
    expect(listDocs("institutionalSharingRooms")).toHaveLength(1);
    expect(listDocs("canonicalEvents").map((event: any) => event.type)).toEqual([
      "institutional_sharing_room_created",
      "institutional_sharing_room_review_required",
    ]);
  });

  it("lists only landlord-scoped rooms", async () => {
    const router = (await import("../landlordSharingRoomRoutes")).default;
    await invokeRouter(router, {
      method: "POST",
      url: "/sharing-rooms",
      body: { roomType: "auditor_review", institutionType: "auditor", sharedScopes: [{ scopeKey: "audit_compliance", scopeId: "readiness-1" }] },
    });
    mockUser = { id: "landlord-2", landlordId: "landlord-2", role: "landlord", email: "other@example.com" };

    const res = await invokeRouter(router, { method: "GET", url: "/sharing-rooms" });

    expect(res.status).toBe(200);
    expect(res.body.rooms).toEqual([]);
  });

  it("revokes access without deleting room lineage", async () => {
    const router = (await import("../landlordSharingRoomRoutes")).default;
    const create = await invokeRouter(router, {
      method: "POST",
      url: "/sharing-rooms",
      body: { roomType: "insurer_review", institutionType: "insurer", sharedScopes: [{ scopeKey: "institution_export", scopeId: "package-1" }] },
    });
    const sharingRoomId = create.body.room.sharingRoomId;

    const revoke = await invokeRouter(router, {
      method: "POST",
      url: `/sharing-rooms/${encodeURIComponent(sharingRoomId)}/revoke`,
    });

    expect(revoke.status).toBe(200);
    expect(revoke.body.room.status).toBe("expired");
    expect(revoke.body.room.accessControls.status).toBe("revoked");
    expect(revoke.body.room.sharedScopes).toHaveLength(1);
    expect(listDocs("canonicalEvents").map((event: any) => event.type)).toContain("institutional_sharing_room_access_revoked");
  });

  it("blocks invalid requests and non-landlord users", async () => {
    const router = (await import("../landlordSharingRoomRoutes")).default;
    const invalid = await invokeRouter(router, {
      method: "POST",
      url: "/sharing-rooms",
      body: { roomType: "lender_review", institutionType: "lender", sharedScopes: [] },
    });
    expect(invalid.status).toBe(400);

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/sharing-rooms",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);
  });
});
