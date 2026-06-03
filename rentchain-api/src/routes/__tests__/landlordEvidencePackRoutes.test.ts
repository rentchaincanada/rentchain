import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
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

vi.mock("../../firebase", () => ({
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

async function invokeRouter(router: any, options: { method: string; url: string; user?: Record<string, unknown> | null }) {
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
      body: {},
      query: Object.fromEntries(query.entries()),
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
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

function seedLandlordData() {
  seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Main property", unitsCount: 1 });
  seedDoc("leases", "lease-1", { landlordId: "landlord-1", propertyId: "prop-1", unitId: "unit-1", status: "active" });
  seedDoc("events", "event-1", {
    landlordId: "landlord-1",
    id: "event-1",
    type: "operator_review_session_closed",
    summary: "Review closed",
    resource: { id: "decision-1", parentId: "decision-1" },
    occurredAt: "2026-05-05T12:00:00.000Z",
  });
  seedDoc("operatorReviewSessions", "review-1", {
    reviewSessionId: "review-1",
    landlordId: "landlord-1",
    scope: "decision",
    scopeId: "decision-1",
    status: "completed",
    openedAt: "2026-05-05T12:00:00.000Z",
    closedAt: "2026-05-05T12:01:00.000Z",
    openedBy: { userId: "landlord-1", role: "landlord" },
    outcome: { result: "reviewed", summary: "Reviewed", recordedAt: "2026-05-05T12:01:00.000Z", recordedBy: { userId: "landlord-1", role: "landlord" } },
    notes: [],
    linkedEvidence: [],
    manualOnly: true,
    systemGenerated: false,
    updatedAt: "2026-05-05T12:01:00.000Z",
  });
  seedDoc("landlordAnalyticsSnapshots", "snapshot-1", {
    landlordId: "landlord-1",
    decisions: {
      items: [{
        id: "decision-1",
        decisionType: "rent_payment_missing",
        priority: "high",
        explanation: "Expected rent payment is missing.",
        recommendedAction: "Review missing payment",
        state: "pending",
        destination: "/leases/lease-1/ledger",
      }],
    },
  });
}

describe("landlordEvidencePackRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  it("returns landlord-scoped read-only evidence pack previews", async () => {
    seedLandlordData();
    const router = (await import("../landlordEvidencePackRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/evidence-packs/preview?scope=decision&scopeId=decision-1" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.evidencePack).toEqual(expect.objectContaining({
      scope: "decision",
      scopeId: "decision-1",
      manualReviewRequired: true,
      externalSharingEnabled: false,
      certificationIssued: false,
    }));
    expect(res.body.evidencePack.sections.map((section: any) => section.sectionKey)).toEqual(expect.arrayContaining([
      "decision_lineage",
      "operator_review_sessions",
      "audit_events",
      "redaction_summary",
    ]));
    expect(JSON.stringify(res.body.evidencePack)).not.toMatch(/accountNumber|creditReport|bureauPayload|privateDocument/i);
  });

  it("requires landlord scope and valid evidence pack query", async () => {
    const router = (await import("../landlordEvidencePackRoutes")).default;

    const badQuery = await invokeRouter(router, { method: "GET", url: "/evidence-packs/preview?scope=decision" });
    expect(badQuery.status).toBe(400);

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/evidence-packs/preview?scope=decision&scopeId=decision-1",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);
  });

  it("preserves landlord authority fallback from user id when landlordId is absent", async () => {
    seedLandlordData();
    mockUser = { id: "landlord-1", role: "landlord", email: "landlord@example.com" };
    const router = (await import("../landlordEvidencePackRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/evidence-packs/preview?scope=decision&scopeId=decision-1" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.evidencePack.scopeId).toBe("decision-1");
  });

  it("does not expose another landlord's source context", async () => {
    seedLandlordData();
    seedDoc("properties", "prop-2", { landlordId: "landlord-2", name: "Other property" });
    mockUser = { id: "landlord-2", landlordId: "landlord-2", role: "landlord", email: "other@example.com" };
    const router = (await import("../landlordEvidencePackRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/evidence-packs/preview?scope=decision&scopeId=decision-1" });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.evidencePack)).not.toContain("Main property");
  });
});
