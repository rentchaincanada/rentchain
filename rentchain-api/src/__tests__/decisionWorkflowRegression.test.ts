import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildLifecycleContinuityLedgerEntry,
  buildLifecycleContinuityLease,
  buildLifecycleContinuityObligation,
  buildLifecycleContinuityPayment,
  lifecycleContinuityIds,
} from "./fixtures/lifecycleContinuityFixtures";

const { fakeDb, resetFakeDb, seedDoc, listDocs } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function fieldValue(data: any, field: string) {
    return String(field || "")
      .split(".")
      .reduce((current, key) => (current == null ? undefined : current[key]), data);
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = fieldValue(doc?.data, field);
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
        col.set(id, { id, data: JSON.parse(JSON.stringify(data)) });
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) =>
      ensureCollection(collection).set(id, { id, data: JSON.parse(JSON.stringify(data)) }),
    listDocs: (collection: string) =>
      Array.from(ensureCollection(collection).values()).map((entry) => JSON.parse(JSON.stringify(entry.data))),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
        doc: (id: string) => makeDoc(name, id),
      }),
    },
  };
});

vi.mock("../firebase", () => ({
  db: fakeDb,
}));

let mockUser: any;

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockUser) return res.status(401).json({ ok: false, error: "unauthenticated" });
    req.user = mockUser;
    return next();
  },
}));

async function makeRouter() {
  const router = (await import("../routes/decisionRoutes")).default;
  return router;
}

async function invokeRouter(
  router: any,
  options: {
    method: string;
    url: string;
    body?: any;
    query?: Record<string, unknown>;
  },
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url.split("?")[0],
      body: options.body ?? {},
      headers: {},
      query: options.query ?? {},
      params: {},
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
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

function seedLifecycleDecisionFixture() {
  const lease = buildLifecycleContinuityLease("active", {
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    monthlyRent: 1640,
    dueDate: "2026-04-01",
  });
  seedDoc("leases", lifecycleContinuityIds.activeLeaseId, lease);
  seedDoc("payments", lifecycleContinuityIds.paymentId, buildLifecycleContinuityPayment());
  seedDoc("ledgerEntries", lifecycleContinuityIds.ledgerEntryId, buildLifecycleContinuityLedgerEntry());
  seedDoc("paymentObligations", lifecycleContinuityIds.obligationId, buildLifecycleContinuityObligation());
}

function financialSnapshot() {
  return {
    leases: listDocs("leases"),
    payments: listDocs("payments"),
    ledgerEntries: listDocs("ledgerEntries"),
    paymentObligations: listDocs("paymentObligations"),
  };
}

async function firstDecision(router: any) {
  const res = await invokeRouter(router, {
    method: "GET",
    url: "/",
    query: { leaseId: lifecycleContinuityIds.activeLeaseId },
  });
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  const decision = res.body.decisions.find((row: any) => row.decisionType === "review_missing_payment") || res.body.decisions[0];
  expect(decision).toBeTruthy();
  return decision;
}

describe("decision workflow regression continuity", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFakeDb();
    mockUser = {
      id: lifecycleContinuityIds.landlordId,
      landlordId: lifecycleContinuityIds.landlordId,
      role: "landlord",
      email: "ops@example.test",
    };
  });

  it.each([
    ["reviewed", { note: "Reviewed by operations" }, "reviewed", true],
    ["snoozed", { snoozedUntil: "2026-06-12T00:00:00.000Z" }, "snoozed", true],
    ["assigned", { assignedTo: "lease-ops" }, "assigned", false],
    ["dismissed", { note: "Not actionable for active review" }, "dismissed", true],
    ["resolved", { note: "Operational review resolved" }, "resolved", true],
  ])("%s updates workflow state only and preserves financial truth", async (actionType, extraPayload, expectedStatus, inactive) => {
    seedLifecycleDecisionFixture();
    const router = await makeRouter();
    const decision = await firstDecision(router);
    const before = financialSnapshot();

    const res = await invokeRouter(router, {
      method: "PATCH",
      url: `/${encodeURIComponent(decision.decisionId)}/action`,
      body: {
        leaseId: lifecycleContinuityIds.activeLeaseId,
        actionType,
        decision,
        ...extraPayload,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.decision).toEqual(
      expect.objectContaining({
        decisionId: decision.decisionId,
        status: expectedStatus,
        latestAction: expect.objectContaining({
          actionType,
          previousStatus: "detected",
          nextStatus: expectedStatus,
        }),
      }),
    );
    expect(financialSnapshot()).toEqual(before);
    expect(listDocs("decisionActions")).toHaveLength(1);

    const afterList = await invokeRouter(router, {
      method: "GET",
      url: "/",
      query: { leaseId: lifecycleContinuityIds.activeLeaseId },
    });
    expect(afterList.status).toBe(200);
    expect(afterList.body.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionId: decision.decisionId,
          status: expectedStatus,
        }),
      ]),
    );
    expect(afterList.body.summary).toEqual(
      expect.objectContaining({
        allTotal: afterList.body.decisions.length,
        inactiveTotal: inactive ? 1 : 0,
        total: inactive ? afterList.body.decisions.length - 1 : afterList.body.decisions.length,
      }),
    );
  });

  it("preserves reviewed decisions historically while active counts exclude inactive workflow states", async () => {
    seedLifecycleDecisionFixture();
    const router = await makeRouter();
    const decision = await firstDecision(router);

    const reviewedRes = await invokeRouter(router, {
      method: "PATCH",
      url: `/${encodeURIComponent(decision.decisionId)}/action`,
      body: {
        leaseId: lifecycleContinuityIds.activeLeaseId,
        actionType: "reviewed",
        decision,
        note: "Reviewed first",
      },
    });
    expect(reviewedRes.status).toBe(200);

    const patchRes = await invokeRouter(router, {
      method: "PATCH",
      url: `/${encodeURIComponent(decision.decisionId)}/action`,
      body: {
        leaseId: lifecycleContinuityIds.activeLeaseId,
        actionType: "resolved",
        decision,
        note: "Resolved after review",
      },
    });
    expect(patchRes.status).toBe(200);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/",
      query: { leaseId: lifecycleContinuityIds.activeLeaseId },
    });

    expect(res.status).toBe(200);
    expect(res.body.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionId: decision.decisionId,
          status: "resolved",
          latestAction: expect.objectContaining({
            actionType: "resolved",
            previousStatus: "reviewed",
            nextStatus: "resolved",
          }),
        }),
      ]),
    );
    expect(res.body.summary.inactiveTotal).toBe(1);
    expect(res.body.summary.total).toBe(res.body.decisions.length - 1);
    expect(listDocs("decisionActions")).toHaveLength(2);
  });

  it("returns no active or historical decisions when financial evidence produces no decision records", async () => {
    const lease = buildLifecycleContinuityLease("active", {
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      monthlyRent: 1640,
      dueDate: "2026-04-01",
    });
    seedDoc("leases", lifecycleContinuityIds.activeLeaseId, lease);
    seedDoc("rentPayments", "paid-rent", {
      id: "paid-rent",
      leaseId: lifecycleContinuityIds.activeLeaseId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      landlordId: lifecycleContinuityIds.landlordId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      amountCents: 164000,
      status: "paid",
      paidAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
      updatedAt: "2026-04-01T12:00:00.000Z",
    });
    const router = await makeRouter();

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/",
      query: { leaseId: lifecycleContinuityIds.activeLeaseId },
    });

    expect(res.status).toBe(200);
    expect(res.body.decisions).toEqual([]);
    expect(res.body.actions).toEqual([]);
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        total: 0,
        allTotal: 0,
        inactiveTotal: 0,
        critical: 0,
        warning: 0,
        info: 0,
      }),
    );
  });
});
