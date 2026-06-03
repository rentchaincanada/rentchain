import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();
const authState = vi.hoisted(() => ({
  user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" } as any,
}));

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

function buildQuery(name: string, filters: Array<{ field: string; value: any }> = []) {
  const applyFilters = () =>
    Array.from(ensureCollection(name).entries()).filter(([, data]) =>
      filters.every((filter) => data?.[filter.field] === filter.value)
    );
  return {
    where: (field: string, _op: string, value: any) =>
      buildQuery(name, [...filters, { field, value }]),
    limit: (_count?: number) => ({
      get: async () => {
        const docs = applyFilters().map(([docId, data]) => ({
          id: docId,
          data: () => data,
        }));
        return { docs };
      },
    }),
    orderBy: (_orderField?: string, _direction?: string) => ({
      limit: (_count?: number) => ({
        get: async () => {
          const docs = applyFilters()
            .sort((a, b) => String(b[1]?.paidAt || "").localeCompare(String(a[1]?.paidAt || "")))
            .map(([docId, data]) => ({
              id: docId,
              data: () => data,
            }));
          return { docs };
        },
      }),
    }),
  };
}

vi.mock("../../firebase", () => ({
  db: {
    runTransaction: async (handler: any) =>
      handler({
        get: async (ref: any) => ref.get(),
        set: async (ref: any, value: any, opts?: { merge?: boolean }) => ref.set(value, opts),
      }),
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
      where: (field: string, _op: string, value: any) => buildQuery(name, [{ field, value }]),
      limit: buildQuery(name).limit,
      orderBy: buildQuery(name).orderBy,
    }),
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    if (!authState.user) {
      return _res.status(401).json({ ok: false, error: "unauthenticated" });
    }
    req.user = authState.user;
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
    authState.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    ensureCollection("tenants").set("tenant-1", {
      id: "tenant-1",
      fullName: "Taylor Tenant",
    });
    ensureCollection("properties").set("prop-1", {
      id: "prop-1",
      name: "123 Main St",
    });
    ensureCollection("leases").set("lease-1", {
      id: "lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
    });
    ensureCollection("payments").set("payment-1", {
      landlordId: "landlord-1",
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
      body?: any;
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
        body: options.body ?? {},
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

  it("exports spreadsheet table from the primary .xls route with safe labels", async () => {
    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments/export.xls" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/vnd.ms-excel");
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="rentchain-payments-\d{4}-\d{2}-\d{2}\.xls"$/
    );
    expect(String(res.body)).toContain("Taylor Tenant");
    expect(String(res.body)).toContain("123 Main St");
    expect(String(res.body)).toContain("<table>");
    expect(String(res.body)).toContain("<th>Paid Date</th>");
    expect(String(res.body)).not.toContain("<?xml");
    expect(String(res.body)).not.toContain("<Workbook");
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
    expect(res.headers["x-route-source"]).toBe("paymentsRoutes.ts");
    expect(res.headers["x-payments-route-version"]).toBe("pr897-real-payment-sources-v4");
    expect(res.headers["x-payments-auth-scope"]).toBe("landlord-resolved");
    expect(res.headers["x-payments-result-count"]).toBe("1");
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

  it("preserves landlord payment scope fallback from user id when landlordId is absent", async () => {
    authState.user = { id: "landlord-1", role: "landlord" };
    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    expect(res.headers["x-payments-auth-scope"]).toBe("landlord-resolved");
    expect(res.body).toEqual([
      expect.objectContaining({
        id: "payment-1",
        tenantId: "tenant-1",
      }),
    ]);
  });

  it("returns unauthorized instead of global payments when auth is missing", async () => {
    authState.user = null;
    ensureCollection("payments").set("global-seed-t1", {
      tenantId: "t1",
      propertyId: "p-main",
      amount: 1000,
      paidAt: "2026-05-07",
      method: "seed",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("returns unauthorized instead of global payments when landlord context is unresolved", async () => {
    authState.user = { role: "landlord" };
    ensureCollection("payments").set("global-seed-t2", {
      tenantId: "t2",
      propertyId: "p-main",
      amount: 1200,
      paidAt: "2026-05-08",
      method: "seed",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments" });

    expect(res.status).toBe(401);
    expect(res.headers["x-payments-auth-scope"]).toBe("landlord-unresolved");
    expect(res.body).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("lists legacy payments and modern rentPayments for a tenant", async () => {
    ensureCollection("rentPayments").set("rent-payment-2026", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      amountCents: 195000,
      currency: "cad",
      status: "paid",
      processor: "stripe",
      paidAt: "2026-05-03T12:00:00.000Z",
      createdAt: "2026-05-03T11:55:00.000Z",
      updatedAt: "2026-05-03T12:00:00.000Z",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        id: "rent-payment-2026",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        propertyId: "prop-1",
        amount: 1950,
        paidAt: "2026-05-03T12:00:00.000Z",
        method: "stripe",
        status: "paid",
        source: "rentPayments",
      }),
      expect.objectContaining({
        id: "payment-1",
        tenantId: "tenant-1",
        amount: 1800,
        paidAt: "2026-04-01",
        source: "payments",
      }),
    ]);
  });

  it("includes landlord-owned lease ledger payment rows", async () => {
    ensureCollection("ledgerEntries").set("ledger-payment-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "payment",
      category: "payment",
      amountCents: 205000,
      effectiveDate: "2026-05-15",
      method: "etransfer",
      reference: "manual-ref-1",
      notes: "May ledger payment",
      createdAt: 1778846400000,
    });
    ensureCollection("ledgerEntries").set("ledger-charge-ignored", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "charge",
      amountCents: 205000,
      effectiveDate: "2026-05-15",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ledger-payment-1",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          leaseId: "lease-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          amount: 2050,
          paidAt: "2026-05-15",
          method: "etransfer",
          notes: "May ledger payment",
          status: "Recorded",
          source: "ledgerEntries",
        }),
      ])
    );
    expect(res.body.map((payment: any) => payment.id)).not.toContain("ledger-charge-ignored");
  });

  it("excludes ledger payment rows for other landlords", async () => {
    ensureCollection("leases").set("lease-b", {
      id: "lease-b",
      landlordId: "landlord-2",
      tenantId: "tenant-b",
      propertyId: "prop-b",
    });
    ensureCollection("ledgerEntries").set("ledger-payment-a", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "payment",
      amountCents: 180000,
      effectiveDate: "2026-05-01",
      method: "cash",
    });
    ensureCollection("ledgerEntries").set("ledger-payment-b", {
      landlordId: "landlord-2",
      leaseId: "lease-b",
      entryType: "payment",
      amountCents: 180000,
      effectiveDate: "2026-05-01",
      method: "cash",
    });

    const router = (await import("../paymentsRoutes")).default;
    const landlordARes = await invokeRouter(router, { method: "GET", url: "/payments" });
    authState.user = { id: "landlord-2", landlordId: "landlord-2", role: "landlord" };
    const landlordBRes = await invokeRouter(router, { method: "GET", url: "/payments" });

    expect(landlordARes.status).toBe(200);
    expect(landlordARes.body.map((payment: any) => payment.id)).toEqual([
      "ledger-payment-a",
      "payment-1",
    ]);
    expect(landlordBRes.status).toBe(200);
    expect(landlordBRes.body.map((payment: any) => payment.id)).toEqual(["ledger-payment-b"]);
  });

  it("scopes landlord A payments to landlord A legacy and rentPayments records", async () => {
    ensureCollection("payments").set("payment-landlord-b", {
      landlordId: "landlord-2",
      tenantId: "tenant-b",
      propertyId: "prop-b",
      amount: 2200,
      paidAt: "2026-05-01",
      method: "e-transfer",
    });
    ensureCollection("rentPayments").set("rent-payment-a", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amountCents: 190000,
      status: "paid",
      processor: "stripe",
      paidAt: "2026-05-02T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
    });
    ensureCollection("rentPayments").set("rent-payment-b", {
      landlordId: "landlord-2",
      tenantId: "tenant-b",
      propertyId: "prop-b",
      amountCents: 220000,
      status: "paid",
      processor: "stripe",
      paidAt: "2026-05-03T00:00:00.000Z",
      updatedAt: "2026-05-03T00:00:00.000Z",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments" });

    expect(res.status).toBe(200);
    expect(res.body.map((payment: any) => payment.id)).toEqual(["rent-payment-a", "payment-1"]);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "payment-1", landlordId: "landlord-1", source: "payments" }),
        expect.objectContaining({ id: "rent-payment-a", landlordId: "landlord-1", source: "rentPayments" }),
      ])
    );
    expect(res.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ landlordId: "landlord-2" }),
      ])
    );
  });

  it("scopes landlord B payments to landlord B legacy and rentPayments records", async () => {
    authState.user = { id: "landlord-2", landlordId: "landlord-2", role: "landlord" };
    ensureCollection("payments").set("payment-landlord-b", {
      landlordId: "landlord-2",
      tenantId: "tenant-b",
      propertyId: "prop-b",
      amount: 2200,
      paidAt: "2026-05-01",
      method: "e-transfer",
    });
    ensureCollection("rentPayments").set("rent-payment-a", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amountCents: 190000,
      status: "paid",
      processor: "stripe",
      paidAt: "2026-05-02T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
    });
    ensureCollection("rentPayments").set("rent-payment-b", {
      landlordId: "landlord-2",
      tenantId: "tenant-b",
      propertyId: "prop-b",
      amountCents: 220000,
      status: "paid",
      processor: "stripe",
      paidAt: "2026-05-03T00:00:00.000Z",
      updatedAt: "2026-05-03T00:00:00.000Z",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments" });

    expect(res.status).toBe(200);
    expect(res.body.map((payment: any) => payment.id)).toEqual(["rent-payment-b", "payment-landlord-b"]);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "payment-landlord-b", landlordId: "landlord-2", source: "payments" }),
        expect.objectContaining({ id: "rent-payment-b", landlordId: "landlord-2", source: "rentPayments" }),
      ])
    );
    expect(res.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ landlordId: "landlord-1" }),
      ])
    );
  });

  it("does not leak or dedupe same tenant date amount rows across landlords", async () => {
    ensureCollection("leases").set("lease-b", {
      landlordId: "landlord-2",
      tenantId: "tenant-1",
      propertyId: "prop-1",
    });
    ensureCollection("payments").set("payment-landlord-b-same", {
      landlordId: "landlord-2",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amount: 1800,
      paidAt: "2026-04-01",
      method: "e-transfer",
    });
    ensureCollection("rentPayments").set("rent-payment-landlord-b-same", {
      landlordId: "landlord-2",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amountCents: 180000,
      status: "paid",
      processor: "stripe",
      paidAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("ledgerEntries").set("ledger-payment-landlord-a-same", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "payment",
      amountCents: 180000,
      effectiveDate: "2026-04-01",
      method: "cash",
    });
    ensureCollection("ledgerEntries").set("ledger-payment-landlord-b-same", {
      landlordId: "landlord-2",
      leaseId: "lease-b",
      entryType: "payment",
      amountCents: 180000,
      effectiveDate: "2026-04-01",
      method: "cash",
    });

    const router = (await import("../paymentsRoutes")).default;
    const landlordARes = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });
    authState.user = { id: "landlord-2", landlordId: "landlord-2", role: "landlord" };
    const landlordBRes = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(landlordARes.status).toBe(200);
    expect(landlordARes.body.map((payment: any) => payment.id)).toEqual(["payment-1"]);
    expect(landlordARes.body).toEqual([
      expect.objectContaining({ landlordId: "landlord-1", source: "payments" }),
    ]);
    expect(landlordBRes.status).toBe(200);
    expect(landlordBRes.body.map((payment: any) => payment.id)).toEqual([
      "payment-landlord-b-same",
    ]);
    expect(landlordBRes.body).toEqual([
      expect.objectContaining({ landlordId: "landlord-2", source: "payments" }),
    ]);
  });

  it("excludes records without landlord ownership from the landlord payments response", async () => {
    ensureCollection("payments").set("payment-without-landlord", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amount: 1800,
      paidAt: "2026-05-01",
      method: "cash",
    });
    ensureCollection("rentPayments").set("rent-payment-without-landlord", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amountCents: 200000,
      processor: "stripe",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    expect(res.body.map((payment: any) => payment.id)).toEqual(["payment-1"]);
  });

  it("excludes legacy payments without direct or linked landlord ownership", async () => {
    ensureCollection("payments").set("global-seed-t1", {
      tenantId: "t1",
      propertyId: "p-main",
      amount: 1000,
      paidAt: "2026-05-07",
      method: "seed",
    });
    ensureCollection("payments").set("global-seed-t-001", {
      tenantId: "t-001",
      propertyId: "p-main",
      amount: 1200,
      paidAt: "2026-05-08",
      method: "seed",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments" });

    expect(res.status).toBe(200);
    expect(res.body.map((payment: any) => payment.id)).toEqual(["payment-1"]);
  });

  it("excludes generic legacy demo rows even when accidental ownership linkage exists", async () => {
    ensureCollection("tenants").set("t1", {
      landlordId: "landlord-1",
      fullName: "Demo Tenant",
    });
    ensureCollection("properties").set("p-main", {
      landlordId: "landlord-1",
      name: "Demo Property",
    });
    ensureCollection("payments").set("legacy-demo-direct-owned", {
      landlordId: "landlord-1",
      tenantId: "t1",
      propertyId: "p-main",
      amount: 1000,
      paidAt: "2026-05-07",
      method: "seed",
    });
    ensureCollection("payments").set("legacy-demo-linked-owned", {
      tenantId: "t-001",
      propertyId: "p-main",
      amount: 1200,
      paidAt: "2026-05-08",
      method: "seed",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments" });

    expect(res.status).toBe(200);
    expect(res.body.map((payment: any) => payment.id)).toEqual(["payment-1"]);
    expect(res.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "legacy-demo-direct-owned" }),
        expect.objectContaining({ id: "legacy-demo-linked-owned" }),
      ])
    );
  });

  it("includes legacy payments without landlordId only when property ownership is proven", async () => {
    ensureCollection("properties").set("prop-owned", {
      landlordId: "landlord-1",
      name: "Owned Property",
    });
    ensureCollection("properties").set("prop-other", {
      landlordId: "landlord-2",
      name: "Other Property",
    });
    ensureCollection("payments").set("legacy-owned-property-payment", {
      tenantId: "tenant-linked",
      propertyId: "prop-owned",
      amount: 2300,
      paidAt: "2026-05-08",
      method: "cheque",
    });
    ensureCollection("payments").set("legacy-other-property-payment", {
      tenantId: "tenant-linked",
      propertyId: "prop-other",
      amount: 2400,
      paidAt: "2026-05-09",
      method: "cheque",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments" });

    expect(res.status).toBe(200);
    expect(res.body.map((payment: any) => payment.id)).toEqual([
      "legacy-owned-property-payment",
      "payment-1",
    ]);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "legacy-owned-property-payment",
          landlordId: "landlord-1",
          source: "payments",
        }),
      ])
    );
    expect(res.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "legacy-other-property-payment" }),
      ])
    );
  });

  it("includes legacy payments without landlordId only when tenant or lease ownership is proven", async () => {
    ensureCollection("tenants").set("tenant-owned", {
      landlordId: "landlord-1",
      fullName: "Owned Tenant",
    });
    ensureCollection("leases").set("lease-owned", {
      landlordId: "landlord-1",
      tenantId: "tenant-lease",
    });
    ensureCollection("payments").set("legacy-owned-tenant-payment", {
      tenantId: "tenant-owned",
      propertyId: "prop-unlinked",
      amount: 2500,
      paidAt: "2026-05-10",
      method: "cash",
    });
    ensureCollection("payments").set("legacy-owned-lease-payment", {
      tenantId: "tenant-lease",
      leaseId: "lease-owned",
      amount: 2600,
      paidAt: "2026-05-11",
      method: "cash",
    });
    ensureCollection("payments").set("legacy-unlinked-payment", {
      tenantId: "tenant-unlinked",
      leaseId: "lease-unlinked",
      amount: 2700,
      paidAt: "2026-05-12",
      method: "cash",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments" });

    expect(res.status).toBe(200);
    expect(res.body.map((payment: any) => payment.id)).toEqual([
      "legacy-owned-lease-payment",
      "legacy-owned-tenant-payment",
      "payment-1",
    ]);
    expect(res.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "legacy-unlinked-payment" }),
      ])
    );
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "legacy-owned-tenant-payment", landlordId: "landlord-1" }),
        expect.objectContaining({ id: "legacy-owned-lease-payment", landlordId: "landlord-1" }),
      ])
    );
  });

  it("accepts only explicit owner fields when landlordId is absent", async () => {
    ensureCollection("payments").set("payment-owned-by-owner-id", {
      ownerId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amount: 1750,
      paidAt: "2026-05-04",
      method: "e-transfer",
    });
    ensureCollection("rentPayments").set("rent-payment-owned-by-created-by", {
      createdByLandlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amountCents: 210000,
      processor: "stripe",
      paidAt: "2026-05-05T00:00:00.000Z",
    });
    ensureCollection("rentPayments").set("rent-payment-unowned-same-tenant", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amountCents: 220000,
      processor: "stripe",
      paidAt: "2026-05-06T00:00:00.000Z",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    expect(res.body.map((payment: any) => payment.id)).toEqual([
      "rent-payment-owned-by-created-by",
      "payment-owned-by-owner-id",
      "payment-1",
    ]);
    expect(res.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "rent-payment-unowned-same-tenant" }),
      ])
    );
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "payment-owned-by-owner-id", landlordId: "landlord-1" }),
        expect.objectContaining({ id: "rent-payment-owned-by-created-by", landlordId: "landlord-1" }),
      ])
    );
  });

  it("sorts unified payments by payment date descending across both sources", async () => {
    ensureCollection("payments").set("payment-old", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amount: 1700,
      paidAt: "2026-02-01",
      method: "cheque",
    });
    ensureCollection("rentPayments").set("rent-payment-new", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amountCents: 200000,
      status: "paid",
      processor: "stripe",
      paidAt: "2026-06-01T00:00:00.000Z",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    ensureCollection("ledgerEntries").set("ledger-payment-middle", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "payment",
      amountCents: 190000,
      effectiveDate: "2026-05-15",
      method: "cash",
      createdAt: 1778846400000,
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    expect(res.body.map((payment: any) => payment.id)).toEqual([
      "rent-payment-new",
      "ledger-payment-middle",
      "payment-1",
      "payment-old",
    ]);
  });

  it("deduplicates the same payment and keeps canonical payments editable when it exists in payments and rentPayments", async () => {
    ensureCollection("payments").set("legacy-stripe-payment", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amount: 1900,
      paidAt: "2026-04-02T00:00:00.000Z",
      method: "stripe",
      status: "Recorded",
      paymentIntentId: "intent-dup-1",
    });
    ensureCollection("rentPayments").set("rent-payment-dup", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      amountCents: 190000,
      status: "paid",
      processor: "stripe",
      paymentIntentId: "intent-dup-1",
      paidAt: "2026-04-02T00:00:00.000Z",
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    const duplicateRows = res.body.filter((payment: any) =>
      ["legacy-stripe-payment", "rent-payment-dup"].includes(payment.id)
    );
    expect(duplicateRows).toHaveLength(1);
    expect(duplicateRows[0]).toEqual(
      expect.objectContaining({
        id: "legacy-stripe-payment",
        canonicalPaymentId: "legacy-stripe-payment",
        paymentDocumentId: "legacy-stripe-payment",
        amount: 1900,
        source: "payments",
      })
    );
  });

  it("deduplicates matching ledger payment rows while keeping canonical payments editable", async () => {
    ensureCollection("payments").set("legacy-ledger-duplicate", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      amount: 1800,
      paidAt: "2026-04-01T00:00:00.000Z",
      method: "cash",
      status: "Recorded",
    });
    ensureCollection("ledgerEntries").set("ledger-payment-duplicate", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      entryType: "payment",
      amountCents: 180000,
      effectiveDate: "2026-04-01",
      method: "cash",
      createdAt: 1775001600000,
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    const duplicateRows = res.body.filter((payment: any) =>
      ["legacy-ledger-duplicate", "ledger-payment-duplicate"].includes(payment.id)
    );
    expect(duplicateRows).toHaveLength(1);
    expect(duplicateRows[0]).toEqual(
      expect.objectContaining({
        id: "legacy-ledger-duplicate",
        canonicalPaymentId: "legacy-ledger-duplicate",
        paymentDocumentId: "legacy-ledger-duplicate",
        source: "payments",
      })
    );
  });

  it("surfaces cents-native canonical payments with editable document ids", async () => {
    ensureCollection("payments").set("canonical-cents-payment", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      amountCents: 185000,
      paidAt: "2026-05-14",
      effectiveDate: "2026-05-14",
      method: "etransfer",
      status: "recorded",
      ledgerEntryId: "ledger-linked-payment",
    });
    ensureCollection("ledgerEntries").set("ledger-linked-payment", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "payment",
      category: "payment",
      amountCents: 185000,
      effectiveDate: "2026-05-14",
      method: "etransfer",
      paymentDocumentId: "canonical-cents-payment",
      createdAt: 1778716800000,
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    const duplicateRows = res.body.filter((payment: any) =>
      ["canonical-cents-payment", "ledger-linked-payment"].includes(payment.id)
    );
    expect(duplicateRows).toHaveLength(1);
    expect(duplicateRows[0]).toEqual(
      expect.objectContaining({
        id: "canonical-cents-payment",
        canonicalPaymentId: "canonical-cents-payment",
        paymentDocumentId: "canonical-cents-payment",
        amount: 1850,
        source: "payments",
      })
    );
  });

  it("normalizes rentPayments with missing optional fields without crashing", async () => {
    ensureCollection("rentPayments").set("rent-payment-minimal", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      amountCents: 210000,
      processor: "stripe",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/payments?tenantId=tenant-1" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rent-payment-minimal",
          tenantId: "tenant-1",
          propertyId: null,
          amount: 2100,
          paidAt: "2026-07-01T00:00:00.000Z",
          method: "stripe",
          status: "Recorded",
          source: "rentPayments",
        }),
      ])
    );
  });

  it("patches canonical payments through the same edit handler as put", async () => {
    ensureCollection("payments").set("payment-put", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amount: 1800,
      paidAt: "2026-04-01",
      method: "e-transfer",
      notes: "Original",
      status: "Recorded",
    });
    ensureCollection("payments").set("payment-patch", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      amount: 1800,
      paidAt: "2026-04-01",
      method: "e-transfer",
      notes: "Original",
      status: "Recorded",
    });

    const router = (await import("../paymentsRoutes")).default;
    const putRes = await invokeRouter(router, {
      method: "PUT",
      url: "/payments/payment-put",
      body: { amount: 1900, notes: "Updated" },
    });
    const patchRes = await invokeRouter(router, {
      method: "PATCH",
      url: "/payments/payment-patch",
      body: { amount: 1900, notes: "Updated" },
    });

    expect(putRes.status).toBe(200);
    expect(patchRes.status).toBe(200);
    expect(ensureCollection("payments").get("payment-put")).toEqual(
      expect.objectContaining({ amount: 1900, notes: "Updated" })
    );
    expect(ensureCollection("payments").get("payment-patch")).toEqual(
      expect.objectContaining({ amount: 1900, notes: "Updated" })
    );
  });

  it("does not create or update persisted payments when patch receives a rentPayments uuid", async () => {
    const rentPaymentId = "f871db5d-16b3-4818-92e6-99c43d0f58e3";
    ensureCollection("rentPayments").set(rentPaymentId, {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      amountCents: 180000,
      processor: "stripe",
      status: "checkout_created",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: `/payments/${rentPaymentId}`,
      body: { amount: 1900 },
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, code: "PAYMENT_NOT_FOUND", error: "Payment not found" });
    expect(ensureCollection("payments").has(rentPaymentId)).toBe(false);
    expect(ensureCollection("rentPayments").get(rentPaymentId)).toEqual(
      expect.objectContaining({ amountCents: 180000, status: "checkout_created" })
    );
  });

  it("returns a clear 404 for unsupported payment edit ids", async () => {
    const router = (await import("../paymentsRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/payments/not-a-payment-id",
      body: { amount: 1900 },
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, code: "PAYMENT_NOT_FOUND", error: "Payment not found" });
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
