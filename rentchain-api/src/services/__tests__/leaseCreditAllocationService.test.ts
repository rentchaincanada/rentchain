import { beforeEach, describe, expect, it } from "vitest";
import type { PaymentObligationLedgerRow } from "../../lib/payments/paymentObligationLedger";
import {
  applyLeaseCreditAllocation,
  buildLeaseCreditAllocationObligationKey,
  buildLeaseCreditAllocationPreview,
  LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION,
  listLeaseCreditAllocationRecords,
  reverseLeaseCreditAllocation,
  validateLeaseCreditAllocationRequest,
  type FirestoreLike,
  type LeaseCreditAllocationRecord,
} from "../leaseCreditAllocationService";

const { fakeDb, resetFakeDb, listDocs } = (() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      if (op === "==") return doc?.data?.[field] === value;
      return false;
    });
  }

  function queryFor(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => queryFor(name, [...filters, { field, op, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({
            id: doc.id,
            exists: true,
            data: () => doc.data,
          }));
        return { docs };
      },
      doc: (id: string) => {
        const col = ensureCollection(name);
        return {
          id,
          get: async () => {
            const doc = col.get(id);
            return { id, exists: Boolean(doc), data: () => doc?.data };
          },
          create: async (data: any) => {
            if (col.has(id)) throw new Error("already_exists");
            col.set(id, { id, data });
          },
          set: async (data: any, options?: { merge?: boolean }) => {
            const previous = col.get(id)?.data || {};
            col.set(id, { id, data: options?.merge ? { ...previous, ...data } : data });
          },
        };
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    fakeDb: {
      collection: (name: string) => queryFor(name),
    },
    listDocs: (name: string) => Array.from(ensureCollection(name).values()).map((doc) => doc.data),
  };
})();

function row(overrides: Partial<PaymentObligationLedgerRow> = {}): PaymentObligationLedgerRow {
  return {
    rowId: "obligation:lease-1:2026-06-01",
    leaseId: "lease-1",
    paymentIntentId: null,
    rentPaymentId: null,
    paymentDocumentId: null,
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    periodStart: "2026-06-01T00:00:00.000Z",
    periodEnd: "2026-06-30T00:00:00.000Z",
    dueDate: "2026-06-01",
    expectedAmountCents: 200000,
    paidAmountCents: 0,
    currency: "cad",
    obligationStatus: "missing",
    paymentIntentStatus: null,
    rentPaymentStatus: null,
    reconciliationStatus: null,
    evidenceStatus: "none",
    source: "lease_lifecycle",
    reasons: ["expected_payment_missing"],
    ...overrides,
  };
}

function allocation(
  overrides: Partial<LeaseCreditAllocationRecord> & Pick<Partial<LeaseCreditAllocationRecord>, "obligationKey"> = {}
): LeaseCreditAllocationRecord {
  const baseRow = row();
  const obligationKey = overrides.obligationKey || buildLeaseCreditAllocationObligationKey(baseRow);
  return {
    allocationId: `allocation-${obligationKey}`,
    landlordId: "landlord-1",
    leaseId: "lease-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    obligationRowId: baseRow.rowId,
    obligationKey,
    paymentIntentId: null,
    rentPaymentId: null,
    paymentDocumentId: null,
    allocationAmountCents: 100000,
    currency: "cad",
    sourceType: "lease_credit_allocation",
    status: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
    createdBy: "operator-1",
    createdByEmail: "operator@example.com",
    reason: "operator_credit_allocation",
    note: null,
    beforeAvailableCreditCents: 876900,
    beforeOutstandingAmountCents: 200000,
    afterAvailableCreditCents: 776900,
    afterOutstandingAmountCents: 100000,
    previewFingerprint: "preview-1",
    idempotencyKey: null,
    reversedAt: null,
    reversedBy: null,
    reversedByEmail: null,
    reversalReason: null,
    reversalOfAllocationId: null,
    auditEventId: null,
    canonicalEventId: null,
    ...overrides,
  };
}

describe("leaseCreditAllocationService", () => {
  beforeEach(() => {
    resetFakeDb();
  });

  it("previews the Bailey-style credit allocation case without mutating ledger rows", () => {
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows: [row()],
    });

    expect(preview.allowed).toBe(true);
    expect(preview.availableCreditCents).toBe(876900);
    expect(preview.totalOutstandingAmountCents).toBe(200000);
    expect(preview.totalSuggestedAllocationAmountCents).toBe(200000);
    expect(preview.remainingAvailableCreditCents).toBe(676900);
    expect(preview.obligations[0]).toEqual(
      expect.objectContaining({
        suggestedAllocationAmountCents: 200000,
        afterAvailableCreditCents: 676900,
        obligationOutstandingAfterCents: 0,
      })
    );
  });

  it("applies a full allocation as an append-safe allocation record only", async () => {
    const obligationRows = [row()];
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows,
    });

    const result = await applyLeaseCreditAllocation({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows,
      obligationKey: preview.obligations[0].obligationKey,
      allocationAmountCents: 200000,
      expectedPreviewFingerprint: preview.previewFingerprint,
      createdBy: "operator-1",
      createdByEmail: "operator@example.com",
      idempotencyKey: "apply:lease-1:june",
      now: "2026-07-01T00:00:00.000Z",
      firestore: fakeDb as FirestoreLike,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        leaseId: "lease-1",
        allocationAmountCents: 200000,
        sourceType: "lease_credit_allocation",
        status: "active",
        beforeAvailableCreditCents: 876900,
        beforeOutstandingAmountCents: 200000,
        afterAvailableCreditCents: 676900,
        afterOutstandingAmountCents: 0,
        auditEventId: null,
        canonicalEventId: null,
      })
    );
    expect(listDocs(LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION)).toHaveLength(1);
    expect(listDocs("ledgerEntries")).toEqual([]);
    expect(listDocs("payments")).toEqual([]);
  });

  it("supports partial allocation when requested amount is below outstanding amount", async () => {
    const obligationRows = [row()];
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows,
    });

    const result = await applyLeaseCreditAllocation({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows,
      obligationKey: preview.obligations[0].obligationKey,
      allocationAmountCents: 75000,
      expectedPreviewFingerprint: preview.previewFingerprint,
      createdBy: "operator-1",
      now: "2026-07-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.afterAvailableCreditCents).toBe(801900);
    expect(result.record.afterOutstandingAmountCents).toBe(125000);
  });

  it("suggests allocations across multiple obligations in due-date order", () => {
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -300000,
      obligationRows: [
        row({ rowId: "obligation:lease-1:2026-07-01", dueDate: "2026-07-01", periodStart: "2026-07-01" }),
        row({ rowId: "obligation:lease-1:2026-06-01", dueDate: "2026-06-01", periodStart: "2026-06-01" }),
      ],
    });

    expect(preview.obligations.map((item) => item.dueDate)).toEqual(["2026-06-01", "2026-07-01"]);
    expect(preview.obligations.map((item) => item.suggestedAllocationAmountCents)).toEqual([200000, 100000]);
    expect(preview.remainingAvailableCreditCents).toBe(0);
  });

  it("limits suggestions when credit is insufficient", () => {
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -100000,
      obligationRows: [row()],
    });

    expect(preview.allowed).toBe(true);
    expect(preview.obligations[0]).toEqual(
      expect.objectContaining({
        suggestedAllocationAmountCents: 100000,
        obligationOutstandingAfterCents: 100000,
      })
    );
  });

  it("blocks when there is no aggregate credit", () => {
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: 0,
      obligationRows: [row()],
    });

    expect(preview.allowed).toBe(false);
    expect(preview.availableCreditCents).toBe(0);
    expect(preview.blockedReasons).toContain("aggregate_balance_is_not_credit");
  });

  it("blocks when there are no outstanding obligations", () => {
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows: [row({ paidAmountCents: 200000, obligationStatus: "paid" })],
    });

    expect(preview.allowed).toBe(false);
    expect(preview.obligations).toEqual([]);
    expect(preview.blockedReasons).toContain("no_outstanding_obligations");
  });

  it("reduces available credit and obligation outstanding for existing active allocations", () => {
    const baseRow = row();
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows: [baseRow],
      allocationRecords: [allocation({ obligationKey: buildLeaseCreditAllocationObligationKey(baseRow) })],
    });

    expect(preview.activeAllocationAmountCents).toBe(100000);
    expect(preview.availableCreditCents).toBe(776900);
    expect(preview.obligations[0]).toEqual(
      expect.objectContaining({
        existingActiveAllocationAmountCents: 100000,
        outstandingAmountCents: 100000,
        suggestedAllocationAmountCents: 100000,
      })
    );
  });

  it("ignores reversed allocation records in current derivation", () => {
    const baseRow = row();
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows: [baseRow],
      allocationRecords: [
        allocation({
          obligationKey: buildLeaseCreditAllocationObligationKey(baseRow),
          status: "reversed",
          reversedAt: "2026-07-02T00:00:00.000Z",
        }),
      ],
    });

    expect(preview.activeAllocationAmountCents).toBe(0);
    expect(preview.availableCreditCents).toBe(876900);
    expect(preview.obligations[0].outstandingAmountCents).toBe(200000);
  });

  it("rejects stale preview fingerprints with the future API error code", async () => {
    const obligationRows = [row()];
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows,
    });

    const validation = validateLeaseCreditAllocationRequest({
      preview,
      obligationKey: preview.obligations[0].obligationKey,
      allocationAmountCents: 200000,
      expectedPreviewFingerprint: "stale",
    });

    expect(validation).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "CREDIT_ALLOCATION_STATE_STALE" }),
    });

    const applied = await applyLeaseCreditAllocation({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows,
      obligationKey: preview.obligations[0].obligationKey,
      allocationAmountCents: 200000,
      expectedPreviewFingerprint: "stale",
      createdBy: "operator-1",
    });
    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.error.code).toBe("CREDIT_ALLOCATION_STATE_STALE");
  });

  it("returns the existing record on idempotent duplicate apply", async () => {
    const obligationRows = [row()];
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows,
    });
    const first = await applyLeaseCreditAllocation({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows,
      obligationKey: preview.obligations[0].obligationKey,
      allocationAmountCents: 200000,
      expectedPreviewFingerprint: preview.previewFingerprint,
      createdBy: "operator-1",
      idempotencyKey: "same-submit",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await applyLeaseCreditAllocation({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows,
      allocationRecords: [first.record],
      obligationKey: preview.obligations[0].obligationKey,
      allocationAmountCents: 200000,
      expectedPreviewFingerprint: preview.previewFingerprint,
      createdBy: "operator-1",
      idempotencyKey: "same-submit",
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotentReplay).toBe(true);
    expect(second.record).toEqual(first.record);
  });

  it("scopes allocation records by landlord and lease", async () => {
    const baseRow = row();
    const foreignRecord = allocation({
      allocationId: "foreign",
      landlordId: "landlord-2",
      obligationKey: buildLeaseCreditAllocationObligationKey(baseRow),
    });
    const preview = buildLeaseCreditAllocationPreview({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      aggregateBalanceCents: -876900,
      obligationRows: [baseRow, row({ leaseId: "lease-2", rowId: "other-lease-row" })],
      allocationRecords: [foreignRecord],
    });

    expect(preview.activeAllocationAmountCents).toBe(0);
    expect(preview.obligations).toHaveLength(1);

    await fakeDb.collection(LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION).doc("foreign").set(foreignRecord);
    await fakeDb
      .collection(LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION)
      .doc("local")
      .set(allocation({ allocationId: "local" }));
    const listed = await listLeaseCreditAllocationRecords({
      landlordId: "landlord-1",
      leaseId: "lease-1",
      firestore: fakeDb as FirestoreLike,
    });
    expect(listed.map((record) => record.allocationId)).toEqual(["local"]);
  });

  it("supports reversal by marking the allocation reversed without deleting the record", async () => {
    const active = allocation({ allocationId: "allocation-1" });
    await fakeDb.collection(LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION).doc(active.allocationId).set(active);

    const reversed = await reverseLeaseCreditAllocation({
      record: active,
      reversedBy: "operator-2",
      reversedByEmail: "operator2@example.com",
      reversalReason: "corrected obligation",
      now: "2026-07-02T00:00:00.000Z",
      firestore: fakeDb as FirestoreLike,
    });

    expect(reversed).toEqual(
      expect.objectContaining({
        allocationId: "allocation-1",
        status: "reversed",
        allocationAmountCents: 100000,
        reversedBy: "operator-2",
        reversalReason: "corrected obligation",
      })
    );
    const stored = listDocs(LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION)[0];
    expect(stored).toEqual(
      expect.objectContaining({
        allocationId: "allocation-1",
        status: "reversed",
        allocationAmountCents: 100000,
      })
    );
  });
});
