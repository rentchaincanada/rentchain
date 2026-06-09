import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();
let autoId = 0;

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map<string, any>());
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function applyMerge(current: any, incoming: any) {
  return { ...(current || {}), ...(clone(incoming) || {}) };
}

function makeQuery(name: string, filters: Array<[string, string, any]> = []) {
  return {
    where(field: string, op: string, value: any) {
      return makeQuery(name, [...filters, [field, op, value]]);
    },
    limit(_limit: number) {
      return {
        get: async () => ({
          docs: Array.from(ensureCollection(name).entries())
            .filter(([, value]) =>
              filters.every(([field, op, expected]) => op === "==" && value?.[field] === expected)
            )
            .map(([id, value]) => ({ id, data: () => clone(value) })),
        }),
      };
    },
  };
}

const dbMock = {
  collection: (name: string) => ({
    doc: (id?: string) => {
      const docId = id || `${name}_${++autoId}`;
      return {
        id: docId,
        get: async () => ({
          id: docId,
          exists: ensureCollection(name).has(docId),
          data: () => clone(ensureCollection(name).get(docId)),
        }),
        set: async (value: any, opts?: { merge?: boolean }) => {
          const current = ensureCollection(name).get(docId);
          ensureCollection(name).set(docId, opts?.merge ? applyMerge(current, value) : clone(value));
        },
      };
    },
    where(field: string, op: string, value: any) {
      return makeQuery(name, [[field, op, value]]);
    },
    limit(limit: number) {
      return makeQuery(name).limit(limit);
    },
  }),
};

vi.mock("../../firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/requireContractor", () => ({
  requireContractor: (req: any, res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (!header) return res.status(401).json({ ok: false, error: "unauthenticated" });
    req.user = JSON.parse(header);
    if (req.user.role !== "contractor" && req.user.role !== "admin") {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    req.user.contractorId = req.user.contractorId || req.user.id;
    next();
  },
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
}) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      query: options.query ?? {},
      params: options.params ?? {},
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

describe("contractorPortalRoutes", () => {
  beforeEach(() => {
    collections.clear();
    autoId = 0;
    ensureCollection("workOrders").set("wo-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-raw",
      unitId: "unit-raw",
      propertyLabel: "Harbour Apartments",
      unitLabel: "Unit 4",
      title: "Fix sink",
      description: "Kitchen sink leak",
      category: "plumbing",
      priority: "urgent",
      status: "assigned",
      assignedContractorId: "contractor-1",
      landlordContact: { name: "Landlord Ops", email: "ops@example.test" },
    });
    ensureCollection("workOrders").set("wo-2", {
      landlordId: "landlord-2",
      title: "Private task",
      assignedContractorId: "contractor-2",
    });
    ensureCollection("contractorProfiles").set("contractor-1", {
      businessName: "Harbor Plumbing",
      contactName: "Casey",
      phone: "555-1000",
      serviceCategories: ["plumbing"],
      availabilityStatus: "active",
    });
    ensureCollection("contractorMessages").set("msg-1", {
      id: "msg-1",
      contractorId: "contractor-1",
      landlordId: "landlord-1",
      workOrderId: "wo-1",
      senderRole: "landlord",
      senderId: "landlord-1",
      senderName: "Landlord Ops",
      recipientRole: "contractor",
      text: "Please confirm the appointment window.",
      createdAtMs: 200,
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    ensureCollection("contractorMessages").set("msg-2", {
      id: "msg-2",
      contractorId: "contractor-2",
      landlordId: "landlord-2",
      workOrderId: "wo-2",
      senderRole: "landlord",
      senderId: "landlord-2",
      senderName: "Other Landlord Ops",
      recipientRole: "contractor",
      text: "Private message for another contractor.",
      createdAtMs: 300,
    });
  });

  it("lists only the authenticated contractor's assigned work with safe projections", async () => {
    const router = (await import("../contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/contractors/contractor-1/work-orders",
      params: { contractorId: "contractor-1" },
      headers: { "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.items).toHaveLength(1);
    expect(res.body?.items?.[0]).toMatchObject({
      id: "wo-1",
      property: { label: "Harbour Apartments" },
      landlord: { name: "Landlord Ops" },
    });
    expect(JSON.stringify(res.body?.items?.[0])).not.toContain("tenant-1");
    expect(JSON.stringify(res.body?.items?.[0])).not.toContain("landlord-1");
    expect(JSON.stringify(res.body?.items?.[0])).not.toContain("prop-raw");
    expect(JSON.stringify(res.body?.items?.[0])).not.toContain("unit-raw");
  });

  it("denies contractor URL manipulation for another contractor id", async () => {
    const router = (await import("../contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/contractors/contractor-2/work-orders",
      params: { contractorId: "contractor-2" },
      headers: { "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor" }) },
    });

    expect(res.status).toBe(403);
  });

  it("updates assigned work order status and appends an immutable update event", async () => {
    const router = (await import("../contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/contractors/contractor-1/work-orders/wo-1/status",
      params: { contractorId: "contractor-1", workOrderId: "wo-1" },
      headers: { "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor" }) },
      body: { status: "accepted", message: "I can take this." },
    });

    expect(res.status).toBe(200);
    expect(ensureCollection("workOrders").get("wo-1")?.status).toBe("accepted");
    expect(Array.from(ensureCollection("workOrderUpdates").values())).toEqual(
      expect.arrayContaining([expect.objectContaining({ workOrderId: "wo-1", actorRole: "contractor" })])
    );
  });

  it("allows messaging only about assigned work orders for the matching landlord", async () => {
    const router = (await import("../contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/contractors/contractor-1/messages",
      params: { contractorId: "contractor-1" },
      headers: { "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor" }) },
      body: { workOrderId: "wo-1", landlordId: "landlord-1", text: "Arriving tomorrow morning." },
    });

    expect(res.status).toBe(201);
    expect(res.body?.message?.text).toBe("Arriving tomorrow morning.");
    expect(res.body?.message?.landlordId).toBeUndefined();
    expect(res.body?.message?.senderName).toBeUndefined();
    expect(JSON.stringify(res.body?.message)).not.toContain("landlord-1");

    const listRes = await invokeRouter(router, {
      method: "GET",
      url: "/contractors/contractor-1/messages",
      params: { contractorId: "contractor-1" },
      headers: { "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor" }) },
    });
    expect(listRes.status).toBe(200);
    const listJson = JSON.stringify(listRes.body?.items || []);
    expect(listJson).toContain("Please confirm the appointment window.");
    expect(listJson).toContain("Arriving tomorrow morning.");
    expect(listJson).not.toContain("landlord-1");
    expect(listJson).not.toContain("Landlord Ops");
    expect(listJson).not.toContain("Private message for another contractor.");

    const forbidden = await invokeRouter(router, {
      method: "POST",
      url: "/contractors/contractor-1/messages",
      params: { contractorId: "contractor-1" },
      headers: { "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor" }) },
      body: { workOrderId: "wo-1", landlordId: "landlord-2", text: "Wrong landlord." },
    });
    expect(forbidden.status).toBe(403);
  });

  it("projects embedded work-order messages without raw landlord context", async () => {
    const router = (await import("../contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/contractors/contractor-1/work-orders/wo-1",
      params: { contractorId: "contractor-1", workOrderId: "wo-1" },
      headers: { "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.messages).toEqual([
      expect.objectContaining({
        id: "msg-1",
        workOrderId: "wo-1",
        senderRole: "landlord",
        text: "Please confirm the appointment window.",
        createdAt: 200,
      }),
    ]);
    const embeddedMessagesJson = JSON.stringify(res.body?.item?.messages || []);
    expect(embeddedMessagesJson).not.toContain("landlord-1");
    expect(embeddedMessagesJson).not.toContain("Landlord Ops");
    expect(embeddedMessagesJson).not.toContain("senderId");
    expect(embeddedMessagesJson).not.toContain("recipientRole");
  });

  it("reads and updates only the authenticated contractor profile", async () => {
    const router = (await import("../contractorPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/contractors/contractor-1/profile",
      params: { contractorId: "contractor-1" },
      headers: { "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor" }) },
      body: { name: "Casey North", specialties: ["plumbing", "hvac"], availability: "limited" },
    });

    expect(res.status).toBe(200);
    expect(res.body?.profile?.name).toBe("Casey North");
    expect(res.body?.profile?.specialties).toEqual(["plumbing", "hvac"]);
    expect(ensureCollection("contractorProfiles").get("contractor-1")?.serviceCategories).toEqual(["plumbing", "hvac"]);
  });
});
