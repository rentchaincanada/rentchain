import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeSource } from "../../middleware/routeSource";

const { fakeDb, resetFakeDb, seedDoc, writeTracker } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let nextId = 1;
  const writeTracker = { writes: 0, paymentWrites: 0, ledgerEntryWrites: 0 };

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function makeDocRef(name: string, id = `${name}-${nextId++}`) {
    return {
      id,
      get: async () => {
        const data = ensureCollection(name).get(id);
        return { id, exists: Boolean(data), data: () => data };
      },
      set: async (data: any) => {
        writeTracker.writes += 1;
        if (name === "payments") writeTracker.paymentWrites += 1;
        if (name === "ledgerEntries") writeTracker.ledgerEntryWrites += 1;
        ensureCollection(name).set(id, data);
      },
    };
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
      doc: (id?: string) => makeDocRef(name, id),
      add: async () => {
        writeTracker.writes += 1;
        const ref = makeDocRef(name);
        ensureCollection(name).set(ref.id, {});
        return { id: ref.id };
      },
    };
  }

  return {
    writeTracker,
    resetFakeDb: () => {
      store.clear();
      nextId = 1;
      writeTracker.writes = 0;
      writeTracker.paymentWrites = 0;
      writeTracker.ledgerEntryWrites = 0;
    },
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, data),
    fakeDb: {
      collection: (name: string) => makeQuery(name),
      runTransaction: async (fn: any) => {
        const transaction = {
          get: (ref: any) => ref.get(),
          set: (ref: any, data: any) => ref.set(data),
        };
        await fn(transaction);
      },
    },
  };
});

vi.mock("../../firebase", () => ({ db: fakeDb }));

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
  app.use(express.json());
  app.use("/api/ledger", routeSource("ledgerRoutes.ts"), router);
  return app;
}

function buildAppWithBroadScreeningFallback(router: any) {
  const app = buildApp(router);
  const screeningFallback = express.Router();
  screeningFallback.use((_req, res) => res.status(404).json({ ok: false, error: "Not Found" }));
  app.use("/api", routeSource("screeningJobsAdminRoutes.ts"), screeningFallback);
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
    expect(writeTracker.paymentWrites).toBe(0);
    expect(writeTracker.ledgerEntryWrites).toBe(0);
    const batches = await fakeDb.collection("ledgerImportBatches").get();
    expect(batches.docs).toHaveLength(1);
    expect(JSON.stringify(batches.docs[0].data())).not.toContain("tenantName,property,unit");
  });

  it("keeps payment CSV preview route ahead of broad screening fallback routes", async () => {
    const router = (await import("../ledgerRoutes")).default;
    const app = buildAppWithBroadScreeningFallback(router);
    const csv = "tenantName,property,unit,amount,paymentDate\nBailey Blinkers,Harbour View,1,150,2026-05-15";

    const res = await request(app)
      .post("/api/ledger/imports/payment-csv/preview")
      .attach("file", Buffer.from(csv), {
        filename: "payments.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("ledgerRoutes.ts");
    expect(res.headers["x-route-source"]).not.toBe("screeningJobsAdminRoutes.ts");
    expect(res.body.rows[0]).toMatchObject({
      matchStatus: "matched",
      confidence: "high",
    });
    expect(writeTracker.paymentWrites).toBe(0);
    expect(writeTracker.ledgerEntryWrites).toBe(0);
  });

  it("keeps payment CSV confirm route ahead of broad screening fallback routes", async () => {
    const router = (await import("../ledgerRoutes")).default;
    const app = buildAppWithBroadScreeningFallback(router);
    const csv = "tenantName,property,unit,amount,paymentDate\nBailey Blinkers,Harbour View,1,150,2026-05-15";

    const preview = await request(app)
      .post("/api/ledger/imports/payment-csv/preview")
      .attach("file", Buffer.from(csv), {
        filename: "payments.csv",
        contentType: "text/csv",
      });

    const res = await request(app).post("/api/ledger/imports/payment-csv/confirm").send({
      importBatchId: preview.body.importBatchId,
      selectedRowIds: [preview.body.rows[0].rowId],
    });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("ledgerRoutes.ts");
    expect(res.headers["x-route-source"]).not.toBe("screeningJobsAdminRoutes.ts");
    expect(res.body).toMatchObject({ ok: true, importedCount: 1 });
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
    expect(writeTracker.paymentWrites).toBe(0);
    expect(writeTracker.ledgerEntryWrites).toBe(0);
  });

  it("confirms selected high-confidence rows into linked payments and ledger entries", async () => {
    const router = (await import("../ledgerRoutes")).default;
    const app = buildApp(router);
    const csv = "tenantName,property,unit,amount,paymentDate,method,reference\nBailey Blinkers,Harbour View,1,150,2026-05-15,etransfer,may";

    const preview = await request(app)
      .post("/api/ledger/imports/payment-csv/preview")
      .attach("file", Buffer.from(csv), {
        filename: "payments.csv",
        contentType: "text/csv",
      });

    const res = await request(app).post("/api/ledger/imports/payment-csv/confirm").send({
      importBatchId: preview.body.importBatchId,
      selectedRowIds: [preview.body.rows[0].rowId],
    });

    expect(res.status).toBe(200);
    expect(res.headers["x-payment-import-mode"]).toBe("confirm");
    expect(res.body).toMatchObject({ ok: true, importedCount: 1, duplicateCount: 0, failedCount: 0 });
    const payments = await fakeDb.collection("payments").get();
    const ledgerEntries = await fakeDb.collection("ledgerEntries").get();
    expect(payments.docs).toHaveLength(1);
    expect(ledgerEntries.docs).toHaveLength(1);
    const paymentDoc = payments.docs[0];
    const entryDoc = ledgerEntries.docs[0];
    expect(paymentDoc.data()).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        propertyId: "property-1",
        unitId: "unit-1",
        amountCents: 15000,
        amount: 150,
        status: "recorded",
        paidAt: "2026-05-15",
        effectiveDate: "2026-05-15",
        method: "etransfer",
        reference: "may",
        ledgerEntryId: entryDoc.id,
        source: "payment_csv_import",
      })
    );
    expect(entryDoc.data()).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        propertyId: "property-1",
        unitId: "unit-1",
        entryType: "payment",
        category: "payment",
        amountCents: 15000,
        paymentDocumentId: paymentDoc.id,
        source: "payment_csv_import",
      })
    );
  });

  it("rejects unmatched selected rows and does not create payment records", async () => {
    const router = (await import("../ledgerRoutes")).default;
    const app = buildApp(router);
    const csv = "tenantName,amount,paymentDate\nUnknown Tenant,150,2026-05-15";

    const preview = await request(app)
      .post("/api/ledger/imports/payment-csv/preview")
      .attach("file", Buffer.from(csv), {
        filename: "payments.csv",
        contentType: "text/csv",
      });
    const res = await request(app).post("/api/ledger/imports/payment-csv/confirm").send({
      importBatchId: preview.body.importBatchId,
      selectedRowIds: [preview.body.rows[0].rowId],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ importedCount: 0, failedCount: 1 });
    expect(res.body.results[0]).toMatchObject({ status: "failed" });
    expect(writeTracker.paymentWrites).toBe(0);
    expect(writeTracker.ledgerEntryWrites).toBe(0);
  });

  it("allows manual confirmation of single-candidate review-required rows", async () => {
    const router = (await import("../ledgerRoutes")).default;
    const app = buildApp(router);
    const csv = "tenantName,amount,paymentDate,method,reference\nBailey Blinkers,150,2026-05-15,etransfer,manual-review";

    const preview = await request(app)
      .post("/api/ledger/imports/payment-csv/preview")
      .attach("file", Buffer.from(csv), {
        filename: "payments.csv",
        contentType: "text/csv",
      });

    expect(preview.body.rows[0]).toMatchObject({
      matchStatus: "matched",
      confidence: "medium",
      preselected: false,
      warning: "Tenant matched by name only. Please confirm before import.",
    });

    const res = await request(app).post("/api/ledger/imports/payment-csv/confirm").send({
      importBatchId: preview.body.importBatchId,
      selectedRowIds: [preview.body.rows[0].rowId],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ importedCount: 1, duplicateCount: 0, failedCount: 0 });
    const payments = await fakeDb.collection("payments").get();
    expect(payments.docs[0].data()).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        leaseId: "lease-1",
        propertyId: "property-1",
        unitId: "unit-1",
        amountCents: 15000,
      })
    );
  });

  it("skips exact duplicates without mutating existing records", async () => {
    seedDoc("payments", "existing-payment", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      amountCents: 15000,
      paidAt: "2026-05-15",
      effectiveDate: "2026-05-15",
      method: "etransfer",
      reference: "may",
    });
    const router = (await import("../ledgerRoutes")).default;
    const app = buildApp(router);
    const csv = "tenantName,property,unit,amount,paymentDate,method,reference\nBailey Blinkers,Harbour View,1,150,2026-05-15,etransfer,may";

    const preview = await request(app)
      .post("/api/ledger/imports/payment-csv/preview")
      .attach("file", Buffer.from(csv), {
        filename: "payments.csv",
        contentType: "text/csv",
      });
    const res = await request(app).post("/api/ledger/imports/payment-csv/confirm").send({
      importBatchId: preview.body.importBatchId,
      selectedRowFingerprints: [preview.body.rows[0].rowFingerprint],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ importedCount: 0, duplicateCount: 1, failedCount: 0 });
    expect(res.body.results[0]).toMatchObject({ status: "duplicate" });
    const payments = await fakeDb.collection("payments").get();
    expect(payments.docs).toHaveLength(1);
    expect(writeTracker.ledgerEntryWrites).toBe(0);
  });

  it("does not store raw CSV text or sensitive ignored values in import batch metadata", async () => {
    const router = (await import("../ledgerRoutes")).default;
    const app = buildApp(router);
    const csv = [
      "Date,First Name,Last Name,Rent Amount,Property,Unit,Reference,Bank Account Number,Running Balance",
      "2026-05-15,Bailey,Blinkers,150,Harbour View,1,may,123456789,99999.99",
    ].join("\n");

    const res = await request(app)
      .post("/api/ledger/imports/payment-csv/preview")
      .attach("file", Buffer.from(csv), {
        filename: "bank-export.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(200);
    expect(res.body.notices.sensitiveColumnsOmitted).toBe(true);
    const batch = await fakeDb.collection("ledgerImportBatches").doc(res.body.importBatchId).get();
    const serialized = JSON.stringify(batch.data());
    expect(serialized).not.toContain("Bank Account Number");
    expect(serialized).not.toContain("Running Balance");
    expect(serialized).not.toContain("123456789");
    expect(serialized).not.toContain("99999.99");
    expect(serialized).not.toContain("Date,First Name,Last Name");
  });

  it("prevents cross-landlord confirmation of another landlord import batch", async () => {
    seedDoc("ledgerImportBatches", "foreign-batch", {
      landlordId: "landlord-2",
      rows: [],
    });
    const router = (await import("../ledgerRoutes")).default;
    const app = buildApp(router);

    const res = await request(app).post("/api/ledger/imports/payment-csv/confirm").send({
      importBatchId: "foreign-batch",
      selectedRowIds: ["row-1"],
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("IMPORT_BATCH_NOT_FOUND");
    expect(writeTracker.paymentWrites).toBe(0);
    expect(writeTracker.ledgerEntryWrites).toBe(0);
  });
});
