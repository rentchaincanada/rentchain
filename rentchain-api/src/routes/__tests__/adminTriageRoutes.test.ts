import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        async get() {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
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

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) {
    collections.set(collectionName, new Map<string, any>());
  }
  collections.get(collectionName)!.set(id, { id, ...data });
}

describe("adminTriageRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("returns triage items for admin users", async () => {
    seedDoc("rentalApplications", "app-1", {
      applicantName: "Alex Applicant",
      screeningMonetization: {
        paymentStatus: "paid",
        paidAt: "2026-04-15T08:00:00.000Z",
        fulfillmentStatus: "ordered",
      },
    });
    seedDoc("financialTransactions", "tx-1", {
      applicationId: "app-1",
      type: "payment_succeeded",
      createdAt: Date.parse("2026-04-15T08:00:00.000Z"),
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "screening.paid",
      domain: "screening",
      action: "paid",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-15T08:00:00.000Z",
      recordedAt: "2026-04-15T08:00:00.000Z",
      visibility: "internal",
      summary: "Screening paid",
    });
    seedDoc("adminAssignments", "assignment-1", {
      version: "v1",
      id: "assignment-1",
      resource: { type: "application", id: "app-1" },
      currentOwner: { ownerId: "admin-1", ownerLabel: "Morgan Ops" },
      createdAt: "2026-04-15T08:05:00.000Z",
      updatedAt: "2026-04-15T08:10:00.000Z",
      history: [],
    });

    const router = (await import("../adminTriageRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/triage?limit=10",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "screening_reconciliation",
          severity: "critical",
          assignment: expect.objectContaining({
            ownerId: "admin-1",
            ownerLabel: "Morgan Ops",
          }),
          sla: expect.objectContaining({
            stage: expect.any(String),
            escalationLevel: expect.any(String),
            ageHours: expect.any(Number),
          }),
          navigation: expect.objectContaining({
            supportConsolePath:
              "/admin/support-console?resourceType=application&resourceId=app-1&triageCategory=screening_reconciliation&triageSeverity=critical&reasonCode=TRIAGE_PAID_NOT_FULFILLED",
          }),
        }),
      ])
    );
  });

  it("applies category, severity, and resource filters", async () => {
    seedDoc("rentalApplications", "app-1", {
      applicantName: "Alex Applicant",
      screeningMonetization: {
        paymentStatus: "paid",
        paidAt: "2026-04-15T08:00:00.000Z",
        fulfillmentStatus: "ordered",
      },
    });
    seedDoc("leases", "lease-1", {
      tenantName: "Taylor Tenant",
      status: "draft",
    });
    seedDoc("financialTransactions", "tx-1", {
      applicationId: "app-1",
      type: "payment_succeeded",
      createdAt: Date.parse("2026-04-15T08:00:00.000Z"),
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "screening.paid",
      domain: "screening",
      action: "paid",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-15T08:00:00.000Z",
      recordedAt: "2026-04-15T08:00:00.000Z",
      visibility: "internal",
      summary: "Screening paid",
    });
    seedDoc("canonicalEvents", "event-2", {
      version: "v1",
      type: "automation.skipped",
      domain: "system",
      action: "skipped",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "lease", id: "lease-1" },
      occurredAt: "2026-04-15T09:00:00.000Z",
      recordedAt: "2026-04-15T09:00:00.000Z",
      visibility: "internal",
      summary: "Automation skipped",
      metadata: {
        action: "lease.auto_send_notice",
        reason: "LEASE_AUTO_SEND_NOTICE_POLICY_BLOCKED",
        skipped: true,
      },
    });

    const router = (await import("../adminTriageRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/triage?category=automation_exception&resourceType=lease&severity=medium",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.items).toHaveLength(1);
    expect(response.body?.items[0]).toEqual(
      expect.objectContaining({
        category: "automation_exception",
        resource: expect.objectContaining({
          type: "lease",
          id: "lease-1",
        }),
      })
    );
  });

  it("enforces admin-only access and safe validation errors", async () => {
    const router = (await import("../adminTriageRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/triage",
      user: { id: "landlord-1", role: "landlord" },
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body?.error).toBe("FORBIDDEN");

    const invalidCategory = await invokeRouter(router, {
      method: "GET",
      url: "/triage?category=nope",
      user: { id: "admin-1", role: "admin" },
    });
    expect(invalidCategory.status).toBe(400);
    expect(invalidCategory.body?.error).toBe("CATEGORY_INVALID");
  });

  it("returns a stable empty shape when no items match", async () => {
    const router = (await import("../adminTriageRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/triage?limit=10",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      nextCursor: undefined,
    });
  });
});
