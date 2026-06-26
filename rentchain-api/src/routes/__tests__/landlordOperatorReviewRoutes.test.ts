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

describe("landlordOperatorReviewRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  it("opens landlord-scoped review sessions and writes canonical events", async () => {
    const router = (await import("../landlordOperatorReviewRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/operator-reviews",
      body: {
        scope: "decision",
        scopeId: "decision-1",
        note: "Review this decision",
        linkedEvidence: [{ evidenceId: "decision-1", label: "Decision", kind: "decision" }],
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.session).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        scope: "decision",
        scopeId: "decision-1",
        status: "open",
        manualOnly: true,
        systemGenerated: false,
      })
    );
    expect(listDocs("operatorReviewSessions")).toHaveLength(1);
    expect(listDocs("canonicalEvents")).toEqual([
      expect.objectContaining({
        eventType: "operator_review_opened",
        visibility: "landlord_operator_internal",
        appendOnly: true,
        rawIdsIncluded: false,
      }),
    ]);
  });

  it("adds sanitized notes and closes sessions with outcome events", async () => {
    const router = (await import("../landlordOperatorReviewRoutes")).default;
    const open = await invokeRouter(router, {
      method: "POST",
      url: "/operator-reviews",
      body: { scope: "audit_compliance", scopeId: "readiness-1" },
    });
    const reviewSessionId = open.body.session.reviewSessionId;

    const note = await invokeRouter(router, {
      method: "POST",
      url: `/operator-reviews/${encodeURIComponent(reviewSessionId)}/notes`,
      body: { note: " <b>Needs follow-up</b> " },
    });
    expect(note.status).toBe(200);
    expect(note.body.note.text).toBe("bNeeds follow-up/b");

    const close = await invokeRouter(router, {
      method: "POST",
      url: `/operator-reviews/${encodeURIComponent(reviewSessionId)}/close`,
      body: { result: "needs_follow_up", summary: "Needs supporting evidence" },
    });
    expect(close.status).toBe(200);
    expect(close.body.session).toEqual(
      expect.objectContaining({
        status: "completed",
        outcome: expect.objectContaining({ result: "needs_follow_up" }),
      })
    );
    expect(listDocs("canonicalEvents").map((event: any) => event.eventType)).toEqual([
      "operator_review_opened",
      "operator_review_note_added",
      "operator_review_outcome_recorded",
      "operator_review_session_closed",
    ]);
  });

  it("lists only sessions for the authenticated landlord", async () => {
    const router = (await import("../landlordOperatorReviewRoutes")).default;
    await invokeRouter(router, {
      method: "POST",
      url: "/operator-reviews",
      body: { scope: "decision", scopeId: "decision-1" },
    });
    mockUser = { id: "landlord-2", landlordId: "landlord-2", role: "landlord", email: "other@example.com" };

    const res = await invokeRouter(router, { method: "GET", url: "/operator-reviews?scope=decision" });

    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
  });

  it("persists landlord-scoped manual review metadata and rehydrates it by scope", async () => {
    const router = (await import("../landlordOperatorReviewRoutes")).default;

    const update = await invokeRouter(router, {
      method: "PUT",
      url: "/operator-reviews/manual-metadata",
      body: {
        scope: "decision",
        scopeId: "decision-1",
        reviewStatus: "in_review",
        assignmentTarget: "finance_reviewer",
      },
    });

    expect(update.status).toBe(200);
    expect(update.body.metadata).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        scope: "decision",
        scopeId: "decision-1",
        reviewStatus: "in_review",
        assignmentTarget: "finance_reviewer",
        manualOnly: true,
        systemGenerated: false,
      })
    );

    const list = await invokeRouter(router, {
      method: "GET",
      url: "/operator-reviews/manual-metadata?scope=decision&scopeId=decision-1",
    });

    expect(list.status).toBe(200);
    expect(list.body.metadata).toEqual([
      expect.objectContaining({
        scope: "decision",
        scopeId: "decision-1",
        reviewStatus: "in_review",
        assignmentTarget: "finance_reviewer",
      }),
    ]);
    expect(listDocs("canonicalEvents")).toEqual([
      expect.objectContaining({
        eventType: "operator_review_manual_metadata_updated",
        visibility: "landlord_operator_internal",
        appendOnly: true,
        rawIdsIncluded: false,
      }),
    ]);
  });

  it("keeps manual review metadata isolated per landlord", async () => {
    const router = (await import("../landlordOperatorReviewRoutes")).default;
    await invokeRouter(router, {
      method: "PUT",
      url: "/operator-reviews/manual-metadata",
      body: {
        scope: "workflow",
        scopeId: "lease-coherence:lease-1",
        reviewStatus: "blocked",
        assignmentTarget: "property_manager",
      },
    });

    mockUser = { id: "landlord-2", landlordId: "landlord-2", role: "landlord", email: "other@example.com" };
    const list = await invokeRouter(router, { method: "GET", url: "/operator-reviews/manual-metadata" });

    expect(list.status).toBe(200);
    expect(list.body.metadata).toEqual([]);
  });

  it("fails closed for invalid manual review metadata values", async () => {
    const router = (await import("../landlordOperatorReviewRoutes")).default;

    const res = await invokeRouter(router, {
      method: "PUT",
      url: "/operator-reviews/manual-metadata",
      body: {
        scope: "decision",
        scopeId: "decision-1",
        reviewStatus: "active",
        assignmentTarget: "landlord_owner",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("OPERATOR_REVIEW_MANUAL_METADATA_INVALID");
    expect(listDocs("operatorReviewManualMetadata")).toEqual([]);
  });

  it("blocks non-landlord users", async () => {
    mockUser = { id: "tenant-1", role: "tenant" };
    const router = (await import("../landlordOperatorReviewRoutes")).default;

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/operator-reviews",
      body: { scope: "decision", scopeId: "decision-1" },
    });

    expect(res.status).toBe(403);
  });
});
