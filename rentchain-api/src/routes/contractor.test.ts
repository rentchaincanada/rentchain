import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map<string, any>());
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

const dbMock = {
  collection: (name: string) => ({
    get: async () => ({
      docs: Array.from(ensureCollection(name).entries()).map(([id, value]) => ({ id, data: () => clone(value) })),
    }),
    doc: (id?: string) => {
      const docId = id || `${name}_${ensureCollection(name).size + 1}`;
      return {
        id: docId,
        get: async () => ({
          id: docId,
          exists: ensureCollection(name).has(docId),
          data: () => clone(ensureCollection(name).get(docId)),
        }),
      };
    },
    where(field: string, op: string, value: any) {
      return {
        limit: (_limit: number) => ({
          get: async () => ({
            docs: Array.from(ensureCollection(name).entries())
              .filter(([, record]) => op === "==" && record?.[field] === value)
              .map(([id, record]) => ({ id, data: () => clone(record) })),
          }),
        }),
      };
    },
  }),
};

vi.mock("../firebase", () => ({ db: dbMock }));

vi.mock("../middleware/requireContractor", () => ({
  requireContractor: (req: any, res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (!header) return res.status(401).json({ ok: false, error: "unauthenticated" });
    req.user = JSON.parse(header);
    if (!["contractor", "admin", "landlord", "tenant"].includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    if (req.user.role === "contractor") req.user.contractorId = req.user.contractorId || req.user.id;
    next();
  },
}));

async function invokeRouter(router: any, options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method || "GET",
      url: options.url || "/contractor/inbox",
      originalUrl: options.url || "/contractor/inbox",
      path: options.url || "/contractor/inbox",
      headers: options.headers ?? {},
      query: options.query ?? {},
      params: {},
      body: {},
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

function contractorHeader(overrides: Record<string, unknown> = {}) {
  return {
    "x-test-user": JSON.stringify({ id: "contractor_raw_1", role: "contractor", ...overrides }),
  };
}

const PUBLIC_INBOX_KEYS = ["audienceRole", "body", "id", "occurredAt", "priority", "readAt", "sourceKind", "status", "title"];
const EXCLUDED_INBOX_FIELDS = [
  "sourceId",
  "sourceRef",
  "audienceScopeKey",
  "rawIdsIncluded",
  "tokensIncluded",
  "secretsIncluded",
  "providerPayloadIncluded",
  "storagePathIncluded",
  "privateNotesIncluded",
];

function seedInboxData() {
  ensureCollection("workOrders").set("work_order_raw_1", {
    assignedContractorId: "contractor_raw_1",
    landlordId: "landlord_raw_1",
    tenantId: "tenant_raw_1",
    propertyId: "property_raw_1",
    unitId: "unit_raw_1",
    title: "Fix sink",
    status: "assigned",
    priority: "urgent",
    updatedAt: "2026-06-09T15:00:00.000Z",
  });
  ensureCollection("workOrders").set("work_order_raw_2", {
    assignedContractorId: "contractor_raw_1",
    title: "Replace lock",
    status: "scheduled",
    priority: "normal",
    updatedAt: "2026-06-09T13:00:00.000Z",
  });
  ensureCollection("workOrders").set("work_order_other", {
    assignedContractorId: "contractor_raw_2",
    title: "Other contractor task",
    status: "assigned",
    updatedAt: "2026-06-09T16:00:00.000Z",
  });
  ensureCollection("workOrders").set("work_order_unsafe", {
    assignedContractorId: "contractor_raw_1",
    title: "Unsafe",
    status: "assigned",
    providerPayload: { raw: true },
    updatedAt: "2026-06-09T17:00:00.000Z",
  });
  ensureCollection("contractorMessages").set("message_raw_1", {
    contractorId: "contractor_raw_1",
    landlordId: "landlord_raw_1",
    workOrderId: "work_order_raw_1",
    senderRole: "landlord",
    text: "Please confirm the appointment window.",
    createdAt: "2026-06-09T14:00:00.000Z",
  });
  ensureCollection("contractorMessages").set("message_raw_2", {
    contractorId: "contractor_raw_1",
    senderRole: "contractor",
    text: "Schedule confirmed.",
    createdAt: "2026-06-09T12:00:00.000Z",
  });
  ensureCollection("contractorMessages").set("message_other", {
    contractorId: "contractor_raw_2",
    senderRole: "landlord",
    text: "Other contractor message.",
    createdAt: "2026-06-09T15:30:00.000Z",
  });
  ensureCollection("contractorMessages").set("message_unsafe", {
    contractorId: "contractor_raw_1",
    senderRole: "landlord",
    text: "secret token is visible",
    createdAt: "2026-06-09T15:30:00.000Z",
  });
}

describe("contractor inbox route", () => {
  beforeEach(() => {
    collections.clear();
    seedInboxData();
  });

  it("requires authentication before returning contractor inbox", async () => {
    const router = (await import("./contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {});

    expect(res.status).toBe(401);
  });

  it("rejects tenant, landlord, and admin roles", async () => {
    const router = (await import("./contractorPortalRoutes")).default;

    await expect(invokeRouter(router, { headers: contractorHeader({ role: "tenant", id: "tenant_raw_1" }) })).resolves.toMatchObject({
      status: 403,
    });
    await expect(invokeRouter(router, { headers: contractorHeader({ role: "landlord", id: "landlord_raw_1" }) })).resolves.toMatchObject({
      status: 403,
    });
    await expect(invokeRouter(router, { headers: contractorHeader({ role: "admin", id: "admin_raw_1" }) })).resolves.toMatchObject({
      status: 403,
    });
  });

  it("rejects contractor users without a contractor identity", async () => {
    const router = (await import("./contractorPortalRoutes")).default;
    const res = await invokeRouter(router, { headers: contractorHeader({ id: "" }) });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("returns a safe contractor inbox projection", async () => {
    const router = (await import("./contractorPortalRoutes")).default;
    const res = await invokeRouter(router, { headers: contractorHeader() });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, total: 4, limit: 20, offset: 0 });
    expect(res.body.items.map((item: any) => item.title)).toEqual([
      "Fix sink",
      "Message from landlord",
      "Replace lock",
      "Contractor message",
    ]);
    expect(res.body.items.every((item: any) => item.audienceRole === "contractor")).toBe(true);
    expect(res.body.items.map((item: any) => Object.keys(item).sort())).toEqual([
      PUBLIC_INBOX_KEYS,
      PUBLIC_INBOX_KEYS,
      PUBLIC_INBOX_KEYS,
      PUBLIC_INBOX_KEYS,
    ]);
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain("contractor_raw_1");
    expect(payload).not.toContain("landlord_raw_1");
    expect(payload).not.toContain("tenant_raw_1");
    expect(payload).not.toContain("property_raw_1");
    expect(payload).not.toContain("unit_raw_1");
    expect(payload).not.toContain("work_order_raw_");
    expect(payload).not.toContain("message_raw_");
    expect(payload).not.toContain('"providerPayload":');
    expect(payload).not.toContain("secret token");
    for (const field of EXCLUDED_INBOX_FIELDS) {
      expect(payload).not.toContain(field);
    }
  });

  it("supports limit and offset pagination", async () => {
    const router = (await import("./contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      headers: contractorHeader(),
      query: { limit: "2", offset: "1" },
    });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items.map((item: any) => item.title)).toEqual(["Message from landlord", "Replace lock"]);
  });

  it("filters by contractor source", async () => {
    const router = (await import("./contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      headers: contractorHeader(),
      query: { source: "message" },
    });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.every((item: any) => item.sourceKind === "contractor.message")).toBe(true);
  });

  it("filters by date range", async () => {
    const router = (await import("./contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      headers: contractorHeader(),
      query: { dateFrom: "2026-06-09T13:30:00.000Z", dateTo: "2026-06-09T15:00:00.000Z" },
    });

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: any) => item.title)).toEqual(["Fix sink", "Message from landlord"]);
  });

  it("rejects cross-contractor scope query attempts", async () => {
    const router = (await import("./contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      headers: contractorHeader(),
      query: { contractorId: "contractor_raw_2" },
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("CONTRACTOR_SCOPE_FORBIDDEN");
  });

  it("rejects invalid query parameters with safe errors", async () => {
    const router = (await import("./contractorPortalRoutes")).default;

    await expect(invokeRouter(router, { headers: contractorHeader(), query: { limit: "0" } })).resolves.toMatchObject({
      status: 400,
      body: expect.objectContaining({ error: "INVALID_LIMIT" }),
    });
    await expect(invokeRouter(router, { headers: contractorHeader(), query: { offset: "-1" } })).resolves.toMatchObject({
      status: 400,
      body: expect.objectContaining({ error: "INVALID_OFFSET" }),
    });
    await expect(invokeRouter(router, { headers: contractorHeader(), query: { source: "lease" } })).resolves.toMatchObject({
      status: 400,
      body: expect.objectContaining({ error: "INVALID_SOURCE" }),
    });
    await expect(invokeRouter(router, { headers: contractorHeader(), query: { dateFrom: "not-date" } })).resolves.toMatchObject({
      status: 400,
      body: expect.objectContaining({ error: "INVALID_DATE_FROM" }),
    });
    await expect(
      invokeRouter(router, {
        headers: contractorHeader(),
        query: { dateFrom: "2026-06-10T00:00:00.000Z", dateTo: "2026-06-09T00:00:00.000Z" },
      })
    ).resolves.toMatchObject({
      status: 400,
      body: expect.objectContaining({ error: "INVALID_DATE_RANGE" }),
    });
  });

  it("returns an empty page when no contractor records exist", async () => {
    collections.clear();
    const router = (await import("./contractorPortalRoutes")).default;
    const res = await invokeRouter(router, { headers: contractorHeader() });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, items: [], total: 0, limit: 20, offset: 0 });
  });
});
