import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignedDownloadUrlMock = vi.fn(async () => "https://signed.example.com/reference.pdf");

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let idSeq = 0;

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.data?.[field];
      if (op === "==") return actual === value;
      if (op === "array-contains") return Array.isArray(actual) && actual.includes(value);
      if (op === ">=") return actual >= value;
      if (op === "<=") return actual <= value;
      return false;
    });
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      orderBy: () => {
        throw new Error("orderBy should not be called in this fake query");
      },
      limit: () => makeQuery(name, filters),
      get: async () => {
        const col = ensureCollection(name);
        const docs = Array.from(col.values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, forEach: (fn: any) => docs.forEach(fn), size: docs.length };
      },
      doc: (id?: string) => makeDoc(name, id),
    };
  }

  function makeDoc(name: string, id?: string) {
    const actualId = id || `doc_${++idSeq}`;
    const col = ensureCollection(name);
    return {
      id: actualId,
      set: async (value: any, options?: { merge?: boolean }) => {
        const current = col.get(actualId)?.data || {};
        col.set(actualId, { id: actualId, data: options?.merge ? { ...current, ...value } : value });
      },
      get: async () => {
        const entry = col.get(actualId);
        return { id: actualId, exists: Boolean(entry), data: () => entry?.data };
      },
    };
  }

  return {
    resetFakeDb: () => {
      store.clear();
      idSeq = 0;
    },
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        orderBy: () => {
          throw new Error("top-level orderBy should not be called");
        },
        limit: () => makeQuery(name),
        get: async () => makeQuery(name).get(),
        doc: (id?: string) => makeDoc(name, id),
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: fakeDb,
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../services/leaseDraftsService", () => ({
  NS_PROVINCE: "NS",
  NS_TEMPLATE_VERSION: "ns-schedule-a-v1",
  applyPatch: vi.fn((existing: any) => existing),
  validateCreateInput: vi.fn(),
  getDraftById: vi.fn(),
  getSnapshotById: vi.fn(),
  generateScheduleA: vi.fn(),
}));

vi.mock("../../services/leaseCanonicalizationService", () => ({
  CURRENT_LEASE_STATUSES: new Set(["active", "notice_pending", "renewal_pending", "renewal_accepted", "move_out_pending"]),
  loadCanonicalPropertyLeases: vi.fn(),
  loadUnitsForProperty: vi.fn(async (_db: any, propertyId: string) => {
    const snap = await fakeDb.collection("units").where("propertyId", "==", propertyId).get();
    return (snap.docs || []).map((doc: any) => ({
      id: doc.id,
      raw: doc.data(),
      unitNumber: String(doc.data()?.unitNumber || "").trim(),
      label: String(doc.data()?.unitNumber || "").trim(),
    }));
  }),
  resolveUnitReference: vi.fn((units: any[], reference: any) => {
    const target = String(reference || "").trim().toLowerCase();
    const unit = units.find((candidate) =>
      [candidate.id, candidate.unitNumber, candidate.label]
        .map((value) => String(value || "").trim().toLowerCase())
        .includes(target)
    );
    return {
      unit: unit || null,
      matchedBy: unit ? "test" : null,
      ambiguous: false,
      candidateIds: unit ? [unit.id] : [],
    };
  }),
  toCanonicalLeaseRecord: vi.fn((id: string, raw: any) => ({
    id,
    status: String(raw?.status || "").trim().toLowerCase(),
    unitId: String(raw?.unitId || "").trim() || null,
    unitNumber: String(raw?.unitNumber || raw?.unit || "").trim() || null,
    propertyId: String(raw?.propertyId || "").trim() || null,
  })),
}));

vi.mock("../../services/leasePartyConsolidationService", () => ({
  evaluateSameLeaseAgreement: vi.fn(() => ({ decision: "separate" })),
  groupLeaseAgreementCandidates: vi.fn(() => ({ mergeGroups: [], ambiguousGroups: [], singles: [] })),
  pickAgreementWinner: vi.fn((candidate: any) => candidate),
}));

vi.mock("../../services/leaseIntegrityService", () => ({
  loadPropertyLeaseIntegrityDiagnostics: vi.fn(async () => ({ diagnostics: [] })),
}));

vi.mock("../../services/risk/recomputeLeaseRisk", () => ({
  computeLeaseRiskSnapshot: vi.fn(async () => null),
  buildLeaseRiskPersistenceFields: vi.fn(() => ({ risk: null, riskTimeline: [] })),
}));

vi.mock("../../services/risk/propertyCredibilitySummary", () => ({
  loadPropertyCredibilitySummary: vi.fn(async () => null),
}));

vi.mock("../../services/risk/propertyLeaseIsolation", () => ({
  dedupePropertyScopedLeasesByUnit: vi.fn((items: any[]) => items),
  filterPropertyScopedLeases: vi.fn((input: any) => ({ included: input.leases || [] })),
}));

vi.mock("../../lib/events/buildEvent", () => ({
  writeCanonicalEvent: vi.fn(async () => null),
}));

vi.mock("../../lib/gcsSignedUrl", () => ({
  getSignedDownloadUrl: getSignedDownloadUrlMock,
}));

describe("leaseRoutes integrity repairs", () => {
  beforeEach(() => {
    resetFakeDb();
    getSignedDownloadUrlMock.mockClear();
  });

  async function makeApp() {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
      next();
    });
    app.use(router);
    return app;
  }

  it("loads lease ledger without relying on orderBy queries", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      status: "active",
      dueDate: "2026-04-01",
    });
    seedDoc("ledgerEntries", "entry-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "charge",
      category: "rent",
      amountCents: 180000,
      effectiveDate: "2026-04-01",
      createdAt: 10,
    });

    const app = await makeApp();
    const res = await request(app).get("/lease-1/ledger");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.entries).toHaveLength(1);
    expect(res.body?.totals?.chargesCents).toBe(180000);
  });

  it("enriches lease ledger payment rows with PaymentIntent linkage when available", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      status: "active",
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
    });
    seedDoc("ledgerEntries", "entry-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "payment",
      reference: "rp-1",
      amountCents: 180000,
      effectiveDate: "2026-04-05",
      createdAt: 10,
    });
    seedDoc("rentPayments", "rp-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      paymentIntentId: "pi_rent_1",
      amountCents: 180000,
      currency: "cad",
      status: "paid",
    });
    seedDoc("paymentIntents", "pi_rent_1", {
      paymentIntentId: "pi_rent_1",
      rentPaymentId: "rp-1",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      purpose: "rent",
      amountCents: 180000,
      currency: "cad",
      status: "confirmed",
      source: "rent_payment_checkout",
      lifecycleState: "complete",
      requiresReview: false,
      createdAt: "2026-04-27T10:00:00.000Z",
      updatedAt: "2026-04-27T10:00:00.000Z",
    });

    const app = await makeApp();
    const res = await request(app).get("/lease-1/ledger");

    expect(res.status).toBe(200);
    expect(res.body?.entries?.[0]).toEqual(
      expect.objectContaining({
        entryType: "payment",
        rentPaymentId: "rp-1",
        paymentIntentId: "pi_rent_1",
        paymentIntentStatus: "confirmed",
        signedAmountCents: -180000,
      })
    );
    expect(res.body?.obligationRows?.[0]).toEqual(
      expect.objectContaining({
        leaseId: "lease-1",
        paymentIntentId: "pi_rent_1",
        rentPaymentId: "rp-1",
        expectedAmountCents: 180000,
        paidAmountCents: 180000,
        obligationStatus: "paid",
        paymentIntentStatus: "confirmed",
        rentPaymentStatus: "paid",
      })
    );
    expect(res.body?.obligationSummary).toEqual(
      expect.objectContaining({
        totalRows: 1,
        expectedAmountCents: 180000,
        paidAmountCents: 180000,
        outstandingAmountCents: 0,
      })
    );
    expect(res.body?.delinquencySignals).toEqual([]);
    expect(res.body?.delinquencySummary).toEqual(
      expect.objectContaining({
        totalSignals: 0,
        totalOutstandingCents: 0,
      })
    );
  });

  it("adds read-only obligation rows without changing existing ledger rows when payment is missing", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1800,
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      dueDate: "2026-04-01",
      status: "active",
    });
    seedDoc("ledgerEntries", "entry-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "charge",
      category: "rent",
      amountCents: 180000,
      effectiveDate: "2026-04-01",
      createdAt: 10,
    });

    const app = await makeApp();
    const res = await request(app).get("/lease-1/ledger");

    expect(res.status).toBe(200);
    expect(res.body?.entries).toEqual([
      expect.objectContaining({
        id: "entry-1",
        entryType: "charge",
        amountCents: 180000,
        signedAmountCents: 180000,
        balanceCents: 180000,
      }),
    ]);
    expect(res.body?.totals).toEqual(
      expect.objectContaining({
        chargesCents: 180000,
        paymentsCents: 0,
        balanceCents: 180000,
      })
    );
    expect(res.body?.obligationRows).toEqual([
      expect.objectContaining({
        leaseId: "lease-1",
        paymentIntentId: null,
        rentPaymentId: null,
        expectedAmountCents: 180000,
        paidAmountCents: 0,
        obligationStatus: "missing",
        source: "lease_lifecycle",
      }),
    ]);
    expect(res.body?.obligationSummary).toEqual(
      expect.objectContaining({
        totalRows: 1,
        expectedAmountCents: 180000,
        paidAmountCents: 0,
        outstandingAmountCents: 180000,
      })
    );
    expect(res.body?.delinquencySignals).toEqual([
      expect.objectContaining({
        leaseId: "lease-1",
        signalType: "overdue",
        severity: "critical",
        expectedAmountCents: 180000,
        paidAmountCents: 0,
        outstandingAmountCents: 180000,
      }),
      expect.objectContaining({
        leaseId: "lease-1",
        signalType: "missing_payment",
        severity: "warning",
        expectedAmountCents: 180000,
        paidAmountCents: 0,
        outstandingAmountCents: 180000,
      }),
    ]);
    expect(res.body?.delinquencySummary).toEqual(
      expect.objectContaining({
        totalSignals: 2,
        overdueCount: 1,
        missingCount: 1,
        totalOutstandingCents: 180000,
      })
    );
  });

  it("includes canonical imported payments in read-only obligation reconciliation", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1980,
      startDate: "2026-05-01",
      endDate: "2027-04-30",
      dueDate: "2026-05-01",
      status: "active",
    });
    seedDoc("payments", "payment-import-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      amountCents: 198000,
      status: "recorded",
      paidAt: "2026-05-17",
      effectiveDate: "2026-05-17",
      source: "payment_csv_import",
      ledgerEntryId: "entry-import-1",
    });
    seedDoc("ledgerEntries", "entry-import-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "payment",
      category: "payment",
      amountCents: 198000,
      effectiveDate: "2026-05-17",
      paymentDocumentId: "payment-import-1",
      source: "payment_csv_import",
      createdAt: 20,
    });

    const app = await makeApp();
    const res = await request(app).get("/lease-1/ledger");

    expect(res.status).toBe(200);
    expect(res.body?.entries?.[0]).toEqual(
      expect.objectContaining({
        id: "entry-import-1",
        entryType: "payment",
        signedAmountCents: -198000,
      })
    );
    expect(res.body?.obligationRows).toEqual([
      expect.objectContaining({
        leaseId: "lease-1",
        paymentDocumentId: "payment-import-1",
        dueDate: "2026-05-01",
        expectedAmountCents: 198000,
        paidAmountCents: 198000,
        obligationStatus: "paid",
        evidenceStatus: "reconciled",
        source: "canonical_payment",
      }),
    ]);
    expect(res.body?.obligationSummary).toEqual(
      expect.objectContaining({
        totalRows: 1,
        expectedAmountCents: 198000,
        paidAmountCents: 198000,
        outstandingAmountCents: 0,
      })
    );
    expect(res.body?.delinquencySignals).toEqual([]);
  });

  it("uses same-lease pre-start ledger payment entries as obligation prepayment evidence", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      unitId: "unit-101",
      unitNumber: "101",
      monthlyRent: 1640,
      startDate: "2026-05-31",
      endDate: "2027-05-29",
      dueDate: "2026-05-31",
      status: "active",
    });
    seedDoc("ledgerEntries", "entry-prepaid-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      unitId: "unit-101",
      entryType: "payment",
      category: "payment",
      amountCents: 164000,
      effectiveDate: "2026-05-05",
      method: "etransfer",
      reference: "1001",
      source: "payment_csv_import",
      createdAt: 20,
    });
    seedDoc("ledgerEntries", "entry-prepaid-2", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      unitId: "unit-101",
      entryType: "payment",
      category: "payment",
      amountCents: 164000,
      effectiveDate: "2026-05-05",
      method: "other",
      createdAt: 21,
    });
    seedDoc("ledgerEntries", "entry-prepaid-3", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      propertyId: "prop-1",
      unitId: "unit-101",
      entryType: "payment",
      category: "payment",
      amountCents: 164000,
      effectiveDate: "2026-05-17",
      method: "etransfer",
      createdAt: 22,
    });

    const app = await makeApp();
    const res = await request(app).get("/lease-1/ledger");

    expect(res.status).toBe(200);
    expect(res.body?.totals).toEqual(
      expect.objectContaining({
        paymentsCents: 492000,
        balanceCents: -492000,
      })
    );
    expect(res.body?.obligationRows).toEqual([
      expect.objectContaining({
        leaseId: "lease-1",
        dueDate: "2026-06-01",
        expectedAmountCents: 164000,
        paidAmountCents: 492000,
        obligationStatus: "overpaid",
        evidenceStatus: "reconciled",
        source: "canonical_payment",
        reasons: expect.arrayContaining(["canonical_payment_recorded"]),
      }),
    ]);
    expect(res.body?.obligationSummary).toEqual(
      expect.objectContaining({
        totalRows: 1,
        expectedAmountCents: 164000,
        paidAmountCents: 492000,
        outstandingAmountCents: 0,
      })
    );
    expect(res.body?.delinquencySignals).toEqual([]);
  });

  it("exports lease ledger csv with property and unit labels instead of raw ids", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      propertyAddress: "123 Main St",
      name: "Harbour View",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      status: "active",
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
    });
    seedDoc("ledgerEntries", "entry-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "charge",
      category: "rent",
      amountCents: 180000,
      effectiveDate: "2026-04-01",
      propertyId: "prop-1",
      unitId: "unit-1",
      createdAt: 10,
    });

    const app = await makeApp();
    const res = await request(app).get("/lease-1/ledger/export.csv");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("Date,Type,Category,Amount,Balance,Method,Reference,Notes,Property,Unit");
    expect(res.text).toContain("Charge");
    expect(res.text).toContain("Rent");
    expect(res.text).toContain("$1,800.00");
    expect(res.text).toContain("123 Main St");
    expect(res.text).toContain("101");
    expect(res.text).not.toContain("amountCents");
    expect(res.text).not.toContain("signedAmountCents");
    expect(res.text).not.toContain("balanceCents");
    expect(res.text).not.toContain("createdAt");
    expect(res.text).not.toContain("propertyId");
    expect(res.text).not.toContain("unitId");
    expect(res.text).not.toContain("prop-1");
    expect(res.text).not.toContain("unit-1");
  });

  it("exports lease ledger pdf for landlord-visible ledger rows", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      propertyAddress: "123 Main St",
      name: "Harbour View",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      status: "active",
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
    });
    seedDoc("ledgerEntries", "entry-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "charge",
      category: "rent",
      amountCents: 145000,
      effectiveDate: "2026-04-01",
      createdAt: 10,
    });
    seedDoc("ledgerEntries", "entry-2", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "payment",
      category: "rent",
      amountCents: 10000,
      effectiveDate: "2026-04-05",
      method: "etransfer",
      notes: "April partial payment",
      createdAt: 11,
    });

    const app = await makeApp();
    const res = await request(app).get("/lease-1/ledger/export.pdf");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("lease-ledger-123-main-st-101.pdf");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(500);
  });

  it("converts an occupied unit reference into a canonical lease and tenant", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "occupied",
      occupantName: "Recovered Tenant",
      rent: 1850,
      leaseDocument: {
        fileName: "lease.pdf",
        bucket: "bucket-1",
        path: "leases/lease.pdf",
      },
    });

    const app = await makeApp();
    const res = await request(app)
      .post("/reconciliation-candidates/unit-1/convert")
      .send({
        startDate: "2026-04-01",
        monthlyRent: 1850,
        tenantPhone: "(902) 555-1111 ext 9",
        coApplicantEmail: "coapplicant@example.com",
        coApplicantPhone: "902-555-3333",
      });

    expect(res.status).toBe(201);
    expect(res.body?.ok).toBe(true);
    expect(String(res.body?.lease?.tenantName || "")).toContain("Recovered Tenant");

    const leaseSnap = await fakeDb.collection("leases").doc(String(res.body?.lease?.id || "")).get();
    expect(leaseSnap.exists).toBe(true);
    expect(leaseSnap.data()?.referenceDocument?.fileName).toBe("lease.pdf");
    expect(leaseSnap.data()?.coApplicant).toEqual({
      email: "coapplicant@example.com",
      phone: "9025553333",
    });
    expect(res.body?.tenant?.phone).toBe("90255511119");
  });

  it("lists only active occupied reconciliation candidates from non-archived properties", async () => {
    seedDoc("properties", "prop-active", {
      landlordId: "landlord-1",
      name: "Harbour View",
      portfolioStatus: "active",
      archivedAt: null,
    });
    seedDoc("properties", "prop-archived", {
      landlordId: "landlord-1",
      name: "Property_test",
      portfolioStatus: "archived",
      archivedAt: "2026-04-01T00:00:00.000Z",
    });
    seedDoc("units", "unit-active", {
      landlordId: "landlord-1",
      propertyId: "prop-active",
      unitNumber: "101",
      status: "occupied",
      occupantName: "Recovered Tenant",
      rent: 1850,
    });
    seedDoc("units", "unit-archived", {
      landlordId: "landlord-1",
      propertyId: "prop-archived",
      unitNumber: "1",
      status: "occupied",
      occupantName: "Synthetic Occupant",
      rent: 1800,
    });

    const app = await makeApp();
    const res = await request(app).get("/reconciliation-candidates");

    expect(res.status).toBe(200);
    expect(res.body?.candidates).toHaveLength(1);
    expect(res.body?.candidates?.[0]).toEqual(
      expect.objectContaining({
        propertyId: "prop-active",
        propertyName: "Harbour View",
        unitId: "unit-active",
      })
    );
  });

  it("excludes units whose explicit unit status is vacant even if occupancyStatus is stale occupied", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Coburg Rd",
      portfolioStatus: "active",
      archivedAt: null,
    });
    seedDoc("units", "unit-stale", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "1",
      status: "vacant",
      occupancyStatus: "occupied",
      occupantName: "Stale Occupant",
      rent: 1700,
    });

    const app = await makeApp();
    const res = await request(app).get("/reconciliation-candidates");

    expect(res.status).toBe(200);
    expect(res.body?.candidates).toEqual([]);
  });

  it("excludes occupied units whose linked tenant reference is hidden cleanup data", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Coburg Rd",
      portfolioStatus: "active",
      archivedAt: null,
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "1",
      status: "occupied",
      occupantName: "Synthetic Occupant",
      rent: 1750,
    });
    seedDoc("tenants", "bcea70bf3f353746c8895bc9", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      unit: "1",
      hiddenFromActiveLists: true,
      fullName: "Unnamed Tenant",
    });

    const app = await makeApp();
    const res = await request(app).get("/reconciliation-candidates");

    expect(res.status).toBe(200);
    expect(res.body?.candidates).toEqual([]);
  });

  it("lists notes and archive visibility metadata for landlord leases", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      archivedAt: "2026-04-01T00:00:00.000Z",
    });

    const app = await makeApp();
    const noteRes = await request(app).post("/lease-1/notes").send({ note: "Keep this for audit." });
    expect(noteRes.status).toBe(201);
    const archivedRes = await request(app).get("/archived");
    expect(archivedRes.status).toBe(200);
    expect(archivedRes.body?.leases?.[0]?.isArchived).toBe(true);
    const notesRes = await request(app).get("/lease-1/notes");
    expect(notesRes.status).toBe(200);
    expect(notesRes.body?.notes?.[0]?.note).toBe("Keep this for audit.");
  });
});
