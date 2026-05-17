import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc, writeTracker } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  const writeTracker = { writes: 0 };

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function makeQuery(name: string, filters: Array<{ field: string; value: any }> = []) {
    return {
      where: (field: string, _op: string, value: any) => makeQuery(name, [...filters, { field, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(name).entries())
          .filter(([, data]) => filters.every((filter) => data?.[filter.field] === filter.value))
          .map(([id, data]) => ({ id, exists: true, data: () => data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      doc: (id: string) => ({
        id,
        set: async () => {
          writeTracker.writes += 1;
        },
      }),
      add: async () => {
        writeTracker.writes += 1;
        return { id: "new-doc" };
      },
    };
  }

  return {
    writeTracker,
    resetFakeDb: () => {
      store.clear();
      writeTracker.writes = 0;
    },
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, data),
    fakeDb: {
      collection: (name: string) => makeQuery(name),
      runTransaction: async () => {
        writeTracker.writes += 1;
      },
    },
  };
});

vi.mock("../../config/firebase", () => ({ db: fakeDb }));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/ledger/ledgerService", () => ({
  appendLedgerEvent: vi.fn(),
  verifyLedgerChain: vi.fn(),
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
}));

function buildApp(router: any) {
  const app = express();
  app.use("/api/ledger", router);
  return app;
}

describe("ledger payment CSV import routes", () => {
  beforeEach(() => {
    resetFakeDb();
    seedDoc("tenants", "tenant-1", {
      landlordId: "landlord-1",
      fullName: "Bailey Blinkers",
      email: "bailey@example.com",
    });
    seedDoc("properties", "property-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitNumber: "1",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      status: "active",
    });
    seedDoc("tenants", "other-tenant", {
      landlordId: "landlord-2",
      fullName: "Other Tenant",
      email: "other@example.com",
    });
  });

  it("previews CSV matches through /api/ledger without writing payment or ledger records", async () => {
    const router = (await import("../ledgerRoutes")).default;
    const app = buildApp(router);
    const csv = [
      "tenantName,property,unit,amount,paymentDate,method,reference",
      "Bailey Blinkers,Harbour View,1,150,2026-05-15,etransfer,may",
    ].join("\n");

    const res = await request(app)
      .post("/api/ledger/imports/payment-csv/preview")
      .attach("file", Buffer.from(csv), {
        filename: "payments.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(200);
    expect(res.headers["x-payment-import-mode"]).toBe("preview-only");
    expect(res.body.summary).toMatchObject({
      totalRows: 1,
      matchedRows: 1,
      preselectedRows: 1,
    });
    expect(res.body.rows[0]).toMatchObject({
      matchedTenantId: "tenant-1",
      leaseId: "lease-1",
      confidence: "high",
    });
    expect(writeTracker.writes).toBe(0);
  });

  it("does not match tenants outside the authenticated landlord scope", async () => {
    const router = (await import("../ledgerRoutes")).default;
    const app = buildApp(router);
    const csv = "tenantName,tenantEmail,amount,paymentDate\nOther Tenant,other@example.com,150,2026-05-15";

    const res = await request(app)
      .post("/api/ledger/imports/payment-csv/preview")
      .attach("file", Buffer.from(csv), {
        filename: "payments.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(200);
    expect(res.body.rows[0]).toMatchObject({
      matchStatus: "unmatched",
      matchedTenantId: null,
      preselected: false,
    });
    expect(writeTracker.writes).toBe(0);
  });
});
