import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) {
    collections.set(name, new Map<string, any>());
  }
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function applyMerge(current: any, incoming: any) {
  const next = { ...(current || {}) };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && (value as any).__op === "arrayUnion") {
      const existing = Array.isArray(next[key]) ? next[key] : [];
      next[key] = [...existing, ...(value as any).values.map((entry: any) => clone(entry))];
      return;
    }
    next[key] = clone(value);
  });
  return next;
}

const dbMock = {
  collection: (name: string) => ({
    doc: (id: string) => ({
      id,
      get: async () => ({
        id,
        exists: ensureCollection(name).has(id),
        data: () => clone(ensureCollection(name).get(id)),
      }),
      set: async (value: any, opts?: { merge?: boolean }) => {
        const current = ensureCollection(name).get(id);
        ensureCollection(name).set(id, opts?.merge ? applyMerge(current, value) : clone(value));
      },
      update: async (value: any) => {
        const current = ensureCollection(name).get(id) || {};
        ensureCollection(name).set(id, applyMerge(current, value));
      },
    }),
  }),
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
    arrayUnion: (...values: any[]) => ({ __op: "arrayUnion", values }),
  },
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) {
      req.user = JSON.parse(header);
    }
    next();
  },
}));

vi.mock("../../auth/jwt", () => ({
  verifyAuthToken: vi.fn(),
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("maintenanceRequestsRoutes scheduling access", () => {
  async function invokeRouter(router: any, options: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }) {
    return await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req: any = {
        method: options.method,
        url: options.url,
        originalUrl: options.url,
        path: options.url,
        body: options.body ?? {},
        headers: options.headers ?? {},
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

  beforeEach(() => {
    vi.clearAllMocks();
    collections.clear();
    ensureCollection("maintenanceRequests").set("maint-1", {
      id: "maint-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Broken heater",
      description: "Heat is not turning on.",
      category: "HVAC",
      priority: "urgent",
      status: "assigned",
      assignedContractorId: "contractor-1",
      assignedContractorName: "North Shore HVAC",
      createdAt: 100,
      updatedAt: 200,
      statusHistory: [],
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
    });
  });

  it("persists service window and access coordination through the landlord patch route", async () => {
    const router = (await import("../maintenanceRequestsRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/landlord/maintenance/maint-1",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        serviceWindowStartAt: 500,
        serviceWindowEndAt: 900,
        accessRequired: true,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.status).toBe("scheduled");
    expect(res.body?.item?.serviceWindowStartAt).toBe(500);
    expect(res.body?.item?.serviceWindowEndAt).toBe(900);
    expect(res.body?.item?.accessRequired).toBe(true);

    const savedMaintenance = ensureCollection("maintenanceRequests").get("maint-1");
    expect(savedMaintenance?.status).toBe("scheduled");
    expect(savedMaintenance?.statusHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "scheduled" }),
        expect.objectContaining({ message: "Service window updated." }),
        expect.objectContaining({ message: "Access coordination marked as required." }),
      ])
    );

    const savedWorkOrder = ensureCollection("workOrders").get("maintenance_maint-1");
    expect(savedWorkOrder?.serviceWindowStartAt).toBe(500);
    expect(savedWorkOrder?.accessRequired).toBe(true);
  });
});
