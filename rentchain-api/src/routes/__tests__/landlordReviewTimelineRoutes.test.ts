import { beforeEach, describe, expect, it, vi } from "vitest";
import { CANONICAL_EVENTS_COLLECTION } from "../../lib/events/buildEvent";
import { lifecycleContinuityDates, lifecycleContinuityIds } from "../../__tests__/fixtures/lifecycleContinuityFixtures";

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
      url: path,
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
    actor: { type: "landlord", id: "landlord-1" },
    occurredAt: "2026-05-05T12:03:00.000Z",
  });
  seedDoc("operatorReviewSessions", "review-1", {
    reviewSessionId: "review-1",
    landlordId: "landlord-1",
    scope: "decision",
    scopeId: "decision-1",
    status: "completed",
    openedAt: "2026-05-05T12:01:00.000Z",
    closedAt: "2026-05-05T12:03:00.000Z",
    openedBy: { userId: "landlord-1", role: "landlord" },
    outcome: { result: "reviewed", summary: "Reviewed", recordedAt: "2026-05-05T12:03:00.000Z", recordedBy: { userId: "landlord-1", role: "landlord" } },
    notes: [{ noteId: "note-1", text: "Reviewed evidence", createdAt: "2026-05-05T12:02:00.000Z", actor: { userId: "landlord-1", role: "landlord" } }],
    linkedEvidence: [],
    manualOnly: true,
    systemGenerated: false,
    updatedAt: "2026-05-05T12:03:00.000Z",
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

describe("landlordReviewTimelineRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  it("returns landlord-scoped read-only canonical review timelines", async () => {
    seedLandlordData();
    const router = (await import("../landlordReviewTimelineRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/review-timeline?scope=decision&scopeId=decision-1" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.timeline).toEqual(expect.objectContaining({
      scope: "decision",
      scopeId: "decision-1",
      manualReviewRequired: true,
      externalSharingEnabled: false,
      certificationIssued: false,
    }));
    expect(res.body.timeline.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entryType: "delinquency_review", source: "decision_inbox" }),
        expect.objectContaining({ entryType: "operator_review", source: "operator_reviews" }),
        expect.objectContaining({ entryType: "canonical_event", source: "canonical_events" }),
        expect.objectContaining({ entryType: "redaction_note", source: "evidence_packs", redacted: true }),
      ])
    );
    expect(JSON.stringify(res.body.timeline)).not.toMatch(/accountNumber|creditReport|bureauPayload|privateDocument/i);
  });

  it("supports deterministic timeline filters", async () => {
    seedLandlordData();
    const router = (await import("../landlordReviewTimelineRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/review-timeline?scope=decision&scopeId=decision-1&entryType=redaction_note&status=redacted&source=evidence_packs",
    });

    expect(res.status).toBe(200);
    expect(res.body.timeline.entries.length).toBeGreaterThan(0);
    expect(res.body.timeline.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ entryType: "redaction_note", status: "redacted", source: "evidence_packs" })])
    );
    expect(res.body.timeline.entries.every((item: any) => item.entryType === "redaction_note" && item.status === "redacted" && item.source === "evidence_packs")).toBe(true);
  });

  it("renders synthetic lifecycle divergence context through landlord-scoped timeline semantics", async () => {
    seedDoc("properties", lifecycleContinuityIds.propertyId, {
      landlordId: lifecycleContinuityIds.landlordId,
      name: "Lifecycle fixture property",
    });
    seedDoc("maintenanceRequests", lifecycleContinuityIds.recoveryMaintenanceId, {
      landlordId: lifecycleContinuityIds.landlordId,
      propertyId: lifecycleContinuityIds.propertyId,
      maintenanceRequestId: lifecycleContinuityIds.recoveryMaintenanceId,
      workOrderId: lifecycleContinuityIds.recoveryMaintenanceId,
      status: "cost_review",
      title: "Lifecycle continuity fixture maintenance review",
      createdAt: lifecycleContinuityDates.recoveryTimelineAt,
      updatedAt: lifecycleContinuityDates.recoveryTimelineAt,
    });
    seedDoc(CANONICAL_EVENTS_COLLECTION, "lc-maintenance-review-event", {
      landlordId: lifecycleContinuityIds.landlordId,
      metadata: { landlordId: lifecycleContinuityIds.landlordId },
      type: "lifecycle_fixture_maintenance_review",
      summary: "Synthetic maintenance lifecycle divergence requires manual review.",
      maintenanceRequestId: lifecycleContinuityIds.recoveryMaintenanceId,
      workOrderId: lifecycleContinuityIds.recoveryMaintenanceId,
      resource: { id: lifecycleContinuityIds.recoveryMaintenanceId },
      actor: { type: "landlord", id: lifecycleContinuityIds.landlordId },
      occurredAt: lifecycleContinuityDates.recoveryTimelineAt,
    });
    const router = (await import("../landlordReviewTimelineRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: `/review-timeline?scope=maintenance&scopeId=${encodeURIComponent(lifecycleContinuityIds.recoveryMaintenanceId)}`,
      user: {
        id: lifecycleContinuityIds.landlordId,
        landlordId: lifecycleContinuityIds.landlordId,
        role: "landlord",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.timeline).toMatchObject({
      scope: "maintenance",
      scopeId: lifecycleContinuityIds.recoveryMaintenanceId,
      manualReviewRequired: true,
      externalSharingEnabled: false,
      certificationIssued: false,
    });
    expect(res.body.timeline.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryType: "canonical_event",
          source: "canonical_events",
          label: "lifecycle_fixture_maintenance_review",
        }),
      ])
    );
    expect(JSON.stringify(res.body.timeline)).not.toMatch(/token|secret|credential|bearer|gs:\/\/|storage\.googleapis\.com|providerPayload/i);
  });

  it("requires landlord scope and does not expose another landlord's source context", async () => {
    seedLandlordData();
    seedDoc("events", "other-event", { landlordId: "landlord-2", summary: "Other landlord event", resource: { id: "decision-1" } });
    const router = (await import("../landlordReviewTimelineRoutes")).default;

    const badQuery = await invokeRouter(router, { method: "GET", url: "/review-timeline?scope=decision" });
    expect(badQuery.status).toBe(400);

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/review-timeline?scope=decision&scopeId=decision-1",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    mockUser = { id: "landlord-2", landlordId: "landlord-2", role: "landlord" };
    const scoped = await invokeRouter(router, { method: "GET", url: "/review-timeline?scope=decision&scopeId=decision-1" });
    expect(JSON.stringify(scoped.body.timeline)).not.toContain("Review missing payment");
  });
});
