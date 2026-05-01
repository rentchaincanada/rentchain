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
        set: async (value: any, opts?: { merge?: boolean }) => {
          const current = ensureCollection(name).get(id) || {};
          ensureCollection(name).set(id, opts?.merge ? { ...current, ...value } : value);
        },
        delete: async () => {
          ensureCollection(name).delete(id);
        },
      }),
      add: async (value: any) => {
        const id = `${name}-${ensureCollection(name).size + 1}`;
        ensureCollection(name).set(id, value);
        return { id };
      },
      where: (field: string, _op: string, value: any) => ({
        orderBy: (_orderField?: string, _direction?: string) => ({
          limit: (_count?: number) => ({
            get: async () => {
              const docs = Array.from(ensureCollection(name).entries())
                .filter(([, data]) => data?.[field] === value)
                .sort((a, b) => String(b[1]?.paidAt || "").localeCompare(String(a[1]?.paidAt || "")))
                .map(([docId, data]) => ({
                  id: docId,
                  data: () => data,
                }));
              return { docs };
            },
          }),
        }),
      }),
      orderBy: (_field: string, _direction?: string) => ({
        limit: (_count?: number) => ({
          get: async () => {
            const docs = Array.from(ensureCollection(name).entries())
              .sort((a, b) => String(b[1]?.paidAt || "").localeCompare(String(a[1]?.paidAt || "")))
              .map(([docId, data]) => ({
                id: docId,
                data: () => data,
              }));
            return { docs };
          },
        }),
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
    ensureCollection("payments").set("payment-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amount: 1800,
      paidAt: "2026-04-01",
      method: "e-transfer",
      notes: "April rent",
      status: "Recorded",
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
      const parsed = new URL(`http://test${options.url}`);
      const req: any = {
        method: options.method,
        url: options.url,
        originalUrl: options.url,
        path: parsed.pathname,
        headers: {},
        body: {},
        query: Object.fromEntries(parsed.searchParams.entries()),
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
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="rentchain-payments-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect(String(res.body)).toContain("Taylor Tenant");
    expect(String(res.body)).toContain("123 Main St");
    expect(String(res.body)).not.toContain("tenant-1");
    expect(String(res.body)).not.toContain("prop-1");
  });

  it("exports spreadsheet xml from the primary .xls route with safe labels", async () => {
    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments/export.xls" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/vnd.ms-excel");
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="rentchain-payments-\d{4}-\d{2}-\d{2}\.xls"$/
    );
    expect(String(res.body)).toContain("Taylor Tenant");
    expect(String(res.body)).toContain("123 Main St");
  });

  it("keeps the legacy .xlsx spreadsheet route as a compatibility alias", async () => {
    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments/export.xlsx" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/vnd.ms-excel");
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="rentchain-payments-\d{4}-\d{2}-\d{2}\.xls"$/
    );
  });

  it("lists persisted Firestore payments for a tenant", async () => {
    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        id: "payment-1",
        tenantId: "tenant-1",
        propertyId: "prop-1",
        amount: 1800,
        paidAt: "2026-04-01",
        method: "e-transfer",
        notes: "April rent",
        status: "Recorded",
      }),
    ]);
  });

  it("returns monthly totals from the persisted payments source", async () => {
    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/payments/tenant/tenant-1/monthly?year=2026&month=4",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      payments: [
        expect.objectContaining({
          id: "payment-1",
          tenantId: "tenant-1",
          amount: 1800,
        }),
      ],
      total: 1800,
    });
  });
});
