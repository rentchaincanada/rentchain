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
    limit: (_limit: number) => ({
      get: async () => ({
        docs: Array.from(ensureCollection(name).entries()).map(([id, value]) => ({
          id,
          data: () => clone(value),
        })),
      }),
    }),
  }),
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) req.user = JSON.parse(header);
    next();
  },
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; body?: any; headers?: Record<string, string>; query?: Record<string, string> }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      query: options.query ?? {},
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

describe("marketplaceContractorRoutes", () => {
  beforeEach(() => {
    collections.clear();
    autoId = 0;
    ensureCollection("contractorProfiles").set("contractor-1", {
      id: "contractor-1",
      displayName: "Harbor Plumbing",
      businessName: "Harbor Plumbing Ltd.",
      serviceCategories: ["plumbing"],
      serviceAreas: ["Halifax"],
      availabilityStatus: "active",
      contact: { email: "crew@harbor.test" },
      metadata: { landlordNetworkIds: ["landlord-1"], createdByLandlordId: "landlord-1" },
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
    });
    ensureCollection("workOrders").set("wo-1", {
      id: "wo-1",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      category: "plumbing",
      status: "open",
      title: "Leak",
    });
  });

  it("creates a contractor profile for a landlord network", async () => {
    const router = (await import("../marketplaceContractorRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/marketplace/contractors",
      headers: {
        "x-test-user": JSON.stringify({ id: "landlord-1", role: "landlord", landlordId: "landlord-1" }),
      },
      body: {
        displayName: "North Shore Electric",
        serviceCategories: ["electrical"],
        serviceAreas: ["Halifax"],
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.contractor?.displayName).toBe("North Shore Electric");
    expect(res.body?.contractor?.metadata?.landlordNetworkIds).toContain("landlord-1");
  });

  it("filters contractors by category and area for landlord-safe discovery", async () => {
    const router = (await import("../marketplaceContractorRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/marketplace/contractors",
      headers: {
        "x-test-user": JSON.stringify({ id: "landlord-1", role: "landlord", landlordId: "landlord-1" }),
      },
      query: {
        serviceCategory: "plumbing",
        serviceArea: "Halifax",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.items).toHaveLength(1);
    expect(res.body?.items?.[0]?.id).toBe("contractor-1");
  });

  it("updates contractor profiles in-network", async () => {
    const router = (await import("../marketplaceContractorRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/marketplace/contractors/contractor-1",
      headers: {
        "x-test-user": JSON.stringify({ id: "landlord-1", role: "landlord", landlordId: "landlord-1" }),
      },
      body: {
        availabilityStatus: "limited",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.contractor?.availabilityStatus).toBe("limited");
  });

  it("assigns a contractor to a work order additively", async () => {
    const router = (await import("../marketplaceContractorRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/marketplace/work-orders/wo-1/assign-contractor",
      headers: {
        "x-test-user": JSON.stringify({ id: "landlord-1", role: "landlord", landlordId: "landlord-1" }),
      },
      body: {
        contractorId: "contractor-1",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.assignedContractorId).toBe("contractor-1");
    expect(res.body?.item?.contractorAssignment?.displayName).toBe("Harbor Plumbing");
    expect(ensureCollection("workOrders").get("wo-1")?.status).toBe("assigned");
  });

  it("enforces landlord/admin access", async () => {
    const router = (await import("../marketplaceContractorRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/marketplace/contractors",
      headers: {
        "x-test-user": JSON.stringify({ id: "contractor-1", role: "contractor" }),
      },
    });

    expect(res.status).toBe(403);
  });
});
