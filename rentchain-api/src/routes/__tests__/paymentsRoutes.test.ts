import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

vi.mock("../../config/firebase", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const value = ensureCollection(name).get(id);
          return {
            id,
            exists: Boolean(value),
            data: () => value,
          };
        },
      }),
    }),
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/ledgerEventsService", () => ({
  recordPaymentEvent: vi.fn(),
}));

vi.mock("../../services/leaseService", () => ({
  leaseService: {},
}));

describe("paymentsRoutes exports", () => {
  beforeEach(async () => {
    collections.clear();
    ensureCollection("tenants").set("tenant-1", {
      id: "tenant-1",
      fullName: "Taylor Tenant",
    });
    ensureCollection("properties").set("prop-1", {
      id: "prop-1",
      name: "123 Main St",
    });
    const { paymentsService } = await import("../../services/paymentsService");
    paymentsService.getAll().splice(0, paymentsService.getAll().length);
    paymentsService.create({
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amount: 1800,
      paidAt: "2026-04-01",
      method: "e-transfer",
      notes: "April rent",
    });
  });

  async function invokeRouter(
    router: any,
    options: {
      method: string;
      url: string;
    }
  ) {
    return await new Promise<{ status: number; body: any; headers: Record<string, string> }>((resolve, reject) => {
      const req: any = {
        method: options.method,
        url: options.url,
        originalUrl: options.url,
        path: options.url,
        headers: {},
        body: {},
        query: {},
        params: {},
      };
      const res: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[String(name).toLowerCase()] = value;
        },
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          resolve({ status: this.statusCode, body: payload, headers: this.headers });
          return this;
        },
        send(payload: any) {
          resolve({ status: this.statusCode, body: payload, headers: this.headers });
          return this;
        },
      };
      router.handle(req, res, (error: any) => {
        if (error) reject(error);
      });
    });
  }

  it("exports csv with safe tenant and property labels", async () => {
    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments/export.csv" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(String(res.body)).toContain("Taylor Tenant");
    expect(String(res.body)).toContain("123 Main St");
    expect(String(res.body)).not.toContain("tenant-1");
    expect(String(res.body)).not.toContain("prop-1");
  });

  it("exports spreadsheet xml with safe labels", async () => {
    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments/export.xlsx" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/vnd.ms-excel");
    expect(String(res.body)).toContain("Taylor Tenant");
    expect(String(res.body)).toContain("123 Main St");
  });
});
