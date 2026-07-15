import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, listDocs, resetFakeDb, seedDoc } = vi.hoisted(() => {
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
      return false;
    });
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      orderBy: () => makeQuery(name, filters),
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
      create: async (value: any) => {
        if (col.has(actualId)) throw new Error("already exists");
        col.set(actualId, { id: actualId, data: value });
      },
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
    listDocs: (name: string) => Array.from(ensureCollection(name).values()).map((doc) => ({ id: doc.id, data: doc.data })),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        orderBy: () => makeQuery(name),
        limit: () => makeQuery(name),
        get: async () => makeQuery(name).get(),
        doc: (id?: string) => makeDoc(name, id),
      }),
    },
  };
});

vi.mock("../../firebase", () => ({
  db: fakeDb,
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user ||= { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "ll@example.com" };
    next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const header = String(req.headers?.["x-test-user"] || "").trim();
    req.user = header
      ? JSON.parse(header)
      : { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "ll@example.com" };
    if (req.user.role !== "landlord" && req.user.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    req.user.landlordId = req.user.landlordId || req.user.id;
    next();
  },
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  return await new Promise<{ status: number; body: any; headers: Record<string, any> }>((resolve, reject) => {
    const headers: Record<string, any> = {};
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
      setHeader: (key: string, value: any) => {
        headers[key.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
      else resolve({ status: 404, body: { ok: false, error: "not_found" }, headers });
    });
  });
}

function seedLease(overrides: Record<string, any> = {}) {
  seedDoc("leases", overrides.id || "lease-1", {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    primaryTenantId: "tenant-1",
    monthlyRent: 2000,
    startDate: "2026-06-01",
    endDate: "2027-05-31",
    status: "active",
    dueDay: 1,
    ...overrides,
  });
}

function seedBaileyCredit(overrides: Record<string, any> = {}) {
  seedLease(overrides.lease || {});
  seedDoc("ledgerEntries", overrides.ledgerId || "credit-adjustment-1", {
    landlordId: "landlord-1",
    leaseId: "lease-1",
    entryType: "adjustment",
    amountCents: -876900,
    effectiveDate: "2026-06-15",
    createdAt: "2026-06-15T00:00:00.000Z",
    ...overrides.ledger,
  });
}

async function loadPreview(router: any) {
  return invokeRouter(router, { method: "GET", url: "/leases/lease-1/credit-allocation-preview" });
}

async function applyFirstSuggestion(router: any, overrides: Record<string, any> = {}) {
  const preview = await loadPreview(router);
  const obligation = preview.body.eligibleObligations[0];
  return invokeRouter(router, {
    method: "POST",
    url: "/leases/lease-1/credit-allocations",
    body: {
      obligationRowId: obligation.obligationRowId,
      allocationAmountCents: obligation.suggestedAllocationAmountCents,
      previewFingerprint: preview.body.previewFingerprint,
      idempotencyKey: "idem-1",
      ...overrides,
    },
  });
}

describe("landlordLeaseCreditAllocationRoutes", () => {
  beforeEach(() => {
    resetFakeDb();
  });

  it("returns the Bailey-style credit allocation preview", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;

    const res = await loadPreview(router);

    expect(res.status).toBe(200);
    expect(res.body.availableCreditCents).toBe(876900);
    expect(res.body.eligibleObligations[0]).toEqual(
      expect.objectContaining({
        outstandingAmountCents: 200000,
        suggestedAllocationAmountCents: 200000,
        obligationOutstandingAfterCents: 0,
      })
    );
    expect(res.body.suggestedAllocations[0]).toEqual(
      expect.objectContaining({
        allocationAmountCents: 200000,
        afterAvailableCreditCents: 676900,
      })
    );
    expect(res.body.noLegalOrLifecycleEffect).toBe(true);
  });

  it("returns blocked preview when there is no available credit", async () => {
    seedLease();
    seedDoc("ledgerEntries", "charge-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "charge",
      amountCents: 200000,
      effectiveDate: "2026-06-01",
    });
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;

    const res = await loadPreview(router);

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
    expect(res.body.availableCreditCents).toBe(0);
    expect(res.body.blockedReasons).toContain("aggregate_balance_is_not_credit");
  });

  it("returns blocked preview when there is credit but no outstanding obligation", async () => {
    seedBaileyCredit();
    seedDoc("payments", "payment-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      amountCents: 200000,
      status: "recorded",
      effectiveDate: "2026-06-01",
    });
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;

    const res = await loadPreview(router);

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
    expect(res.body.eligibleObligations).toEqual([]);
    expect(res.body.blockedReasons).toContain("no_outstanding_obligations");
  });

  it("applies an allocation append-safely without mutating ledger, payments, or reconciliation records", async () => {
    seedBaileyCredit();
    seedDoc("payments", "unrelated-payment", { landlordId: "landlord-1", leaseId: "other-lease", amountCents: 1 });
    seedDoc("paymentReconciliationRecords", "rec-1", { leaseId: "lease-1", reconciliationStatus: "not_started" });
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const ledgerBefore = listDocs("ledgerEntries");
    const paymentsBefore = listDocs("payments");
    const reconciliationBefore = listDocs("paymentReconciliationRecords");

    const res = await applyFirstSuggestion(router);

    expect(res.status).toBe(201);
    expect(res.body.allocation).toEqual(
      expect.objectContaining({
        leaseId: "lease-1",
        allocationAmountCents: 200000,
        status: "active",
        beforeAvailableCreditCents: 876900,
        afterAvailableCreditCents: 676900,
        afterOutstandingAmountCents: 0,
      })
    );
    expect(res.body.preview.availableCreditCents).toBe(676900);
    expect(listDocs("leaseCreditAllocationRecords")).toHaveLength(1);
    expect(listDocs("canonicalEvents")).toHaveLength(1);
    expect(listDocs("ledgerEntries")).toEqual(ledgerBefore);
    expect(listDocs("payments")).toEqual(paymentsBefore);
    expect(listDocs("paymentReconciliationRecords")).toEqual(reconciliationBefore);
    expect(res.body.noLegalOrLifecycleEffect).toBe(true);
  });

  it("rejects stale preview fingerprints with a 409", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const preview = await loadPreview(router);
    const obligation = preview.body.eligibleObligations[0];

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/credit-allocations",
      body: {
        obligationRowId: obligation.obligationRowId,
        allocationAmountCents: 200000,
        previewFingerprint: "stale",
        idempotencyKey: "stale-fingerprint",
      },
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("CREDIT_ALLOCATION_STATE_STALE");
  });

  it("requires obligationRowId for apply requests", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const preview = await loadPreview(router);

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/credit-allocations",
      body: {
        allocationAmountCents: 200000,
        previewFingerprint: preview.body.previewFingerprint,
        idempotencyKey: "missing-obligation",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CREDIT_ALLOCATION_OBLIGATION_NOT_ELIGIBLE");
  });

  it("requires allocationAmountCents for apply requests", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const preview = await loadPreview(router);
    const obligation = preview.body.eligibleObligations[0];

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/credit-allocations",
      body: {
        obligationRowId: obligation.obligationRowId,
        previewFingerprint: preview.body.previewFingerprint,
        idempotencyKey: "missing-amount",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CREDIT_ALLOCATION_AMOUNT_INVALID");
  });

  it("requires idempotencyKey for apply requests", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const preview = await loadPreview(router);
    const obligation = preview.body.eligibleObligations[0];

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/credit-allocations",
      body: {
        obligationRowId: obligation.obligationRowId,
        allocationAmountCents: 200000,
        previewFingerprint: preview.body.previewFingerprint,
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CREDIT_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED");
  });

  it("rejects amounts exceeding available credit", async () => {
    seedBaileyCredit({ ledger: { amountCents: -100000 } });
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const preview = await loadPreview(router);
    const obligation = preview.body.eligibleObligations[0];

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/credit-allocations",
      body: {
        obligationRowId: obligation.obligationRowId,
        allocationAmountCents: 150000,
        previewFingerprint: preview.body.previewFingerprint,
        idempotencyKey: "exceeds-credit",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CREDIT_ALLOCATION_AMOUNT_EXCEEDS_CREDIT");
  });

  it("rejects amounts exceeding selected obligation outstanding amount", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const preview = await loadPreview(router);
    const obligation = preview.body.eligibleObligations[0];

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/credit-allocations",
      body: {
        obligationRowId: obligation.obligationRowId,
        allocationAmountCents: 200001,
        previewFingerprint: preview.body.previewFingerprint,
        idempotencyKey: "exceeds-outstanding",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CREDIT_ALLOCATION_AMOUNT_EXCEEDS_OUTSTANDING");
  });

  it("rejects invalid obligations", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const preview = await loadPreview(router);

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/credit-allocations",
      body: {
        obligationRowId: "not-this-lease",
        allocationAmountCents: 200000,
        previewFingerprint: preview.body.previewFingerprint,
        idempotencyKey: "invalid-obligation",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CREDIT_ALLOCATION_OBLIGATION_NOT_ELIGIBLE");
  });

  it("returns idempotent replay for the same apply request", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const preview = await loadPreview(router);
    const obligation = preview.body.eligibleObligations[0];
    const body = {
      obligationRowId: obligation.obligationRowId,
      allocationAmountCents: 200000,
      previewFingerprint: preview.body.previewFingerprint,
      idempotencyKey: "idem-1",
    };

    const first = await invokeRouter(router, { method: "POST", url: "/leases/lease-1/credit-allocations", body });
    const second = await invokeRouter(router, { method: "POST", url: "/leases/lease-1/credit-allocations", body });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.idempotentReplay).toBe(true);
    expect(second.body.allocation.allocationId).toBe(first.body.allocation.allocationId);
    expect(listDocs("leaseCreditAllocationRecords")).toHaveLength(1);
  });

  it("rejects conflicting idempotency replay", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const preview = await loadPreview(router);
    const obligation = preview.body.eligibleObligations[0];
    await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/credit-allocations",
      body: {
        obligationRowId: obligation.obligationRowId,
        allocationAmountCents: 200000,
        previewFingerprint: preview.body.previewFingerprint,
        idempotencyKey: "idem-1",
      },
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/credit-allocations",
      body: {
        obligationRowId: obligation.obligationRowId,
        allocationAmountCents: 100000,
        previewFingerprint: preview.body.previewFingerprint,
        idempotencyKey: "idem-1",
      },
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("CREDIT_ALLOCATION_IDEMPOTENCY_CONFLICT");
  });

  it("blocks cross-landlord preview access", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/leases/lease-1/credit-allocation-preview",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-2", landlordId: "landlord-2", role: "landlord" }) },
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("reduces available credit and obligation exposure for active allocations in the next preview", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    await applyFirstSuggestion(router, { allocationAmountCents: 100000 });

    const res = await loadPreview(router);

    expect(res.body.availableCreditCents).toBe(776900);
    expect(res.body.eligibleObligations[0].outstandingAmountCents).toBe(100000);
    expect(res.body.existingActiveAllocations).toHaveLength(1);
  });

  it("reverses an active allocation and excludes it from the next preview exposure", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const applied = await applyFirstSuggestion(router, { allocationAmountCents: 100000 });

    const res = await invokeRouter(router, {
      method: "POST",
      url: `/leases/lease-1/credit-allocations/${encodeURIComponent(applied.body.allocation.allocationId)}/reverse`,
      body: { reason: "operator correction" },
    });

    expect(res.status).toBe(200);
    expect(res.body.allocation.status).toBe("reversed");
    expect(res.body.allocation.reversalReason).toBe("operator correction");
    expect(res.body.preview.availableCreditCents).toBe(876900);
    expect(res.body.preview.eligibleObligations[0].outstandingAmountCents).toBe(200000);
    expect(res.body.preview.reversedAllocations).toHaveLength(1);
    expect(listDocs("ledgerEntries")).toHaveLength(1);
  });

  it("returns already reversed for repeated reversal", async () => {
    seedBaileyCredit();
    const router = (await import("../landlordLeaseCreditAllocationRoutes")).default;
    const applied = await applyFirstSuggestion(router);
    const url = `/leases/lease-1/credit-allocations/${encodeURIComponent(applied.body.allocation.allocationId)}/reverse`;
    await invokeRouter(router, { method: "POST", url, body: { reason: "operator correction" } });

    const res = await invokeRouter(router, { method: "POST", url, body: { reason: "repeat" } });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("CREDIT_ALLOCATION_ALREADY_REVERSED");
  });
});
