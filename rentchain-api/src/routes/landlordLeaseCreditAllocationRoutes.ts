import { Router, Response } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { deriveLeaseLifecycleState } from "../lib/leases/leaseLifecycle";
import {
  buildPaymentObligationLedgerRows,
  type PaymentObligationLedgerRow,
} from "../lib/payments/paymentObligationLedger";
import {
  buildCanonicalPaymentEvidenceFromLedgerEntries,
  loadLeaseCanonicalPaymentsForObligationLedger,
} from "../lib/payments/leasePaymentObligationEvidence";
import {
  applyLeaseCreditAllocation,
  buildLeaseCreditAllocationPreview,
  CREDIT_ALLOCATION_STATE_STALE,
  LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION,
  listLeaseCreditAllocationRecords,
  reverseLeaseCreditAllocation,
  type LeaseCreditAllocationPreview,
  type LeaseCreditAllocationRecord,
  type LeaseCreditAllocationValidationError,
} from "../services/leaseCreditAllocationService";
import type { RentPaymentRecord } from "../services/rentPayments/rentPaymentService";

const router = Router();
const LEDGER_COLLECTION = "ledgerEntries";
const NO_LEGAL_OR_LIFECYCLE_EFFECT = true;

type LeaseAllocationContext = {
  landlordId: string;
  leaseId: string;
  lease: Record<string, any>;
  entries: any[];
  aggregateBalanceCents: number;
  obligationRows: PaymentObligationLedgerRow[];
  allocationRecords: LeaseCreditAllocationRecord[];
  preview: LeaseCreditAllocationPreview;
};

type LeaseAllocationContextError = { ok: false; status: number; code: string };

function cleanString(value: unknown, max = 500): string | null {
  const text = String(value ?? "").trim().slice(0, max);
  return text || null;
}

function normalizeAmountCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount);
}

function normalizeLeaseRentAmountCents(lease: Record<string, any>): number {
  const amountCents = normalizeAmountCents(lease?.amountCents);
  if (amountCents > 0) return amountCents;
  const monthlyRent = Number(lease?.monthlyRent ?? lease?.currentRent ?? lease?.rent);
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return 0;
  return Math.round(monthlyRent * 100);
}

function signedLedgerAmountCents(entry: any): number {
  const entryType = String(entry?.entryType || entry?.type || "").trim().toLowerCase();
  if (entryType === "payment") return -Math.abs(Number(entry?.amountCents || 0));
  if (entryType === "adjustment") return Math.round(Number(entry?.amountCents || 0));
  return Math.abs(Math.round(Number(entry?.amountCents || 0)));
}

function actorTypeForRole(role: unknown): "admin" | "landlord" | "user" {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "landlord") return "landlord";
  return "user";
}

function getActor(req: any, landlordId: string) {
  return {
    id: cleanString(req.user?.id, 240) || cleanString(req.user?.uid, 240) || landlordId,
    email: cleanString(req.user?.email, 320),
    role: cleanString(req.user?.role, 80) || "landlord",
  };
}

function allocationSummary(record: LeaseCreditAllocationRecord) {
  return {
    allocationId: record.allocationId,
    landlordId: record.landlordId,
    leaseId: record.leaseId,
    propertyId: record.propertyId,
    unitId: record.unitId,
    tenantId: record.tenantId,
    obligationRowId: record.obligationRowId,
    obligationKey: record.obligationKey,
    allocationAmountCents: record.allocationAmountCents,
    currency: record.currency,
    status: record.status,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    createdByEmail: record.createdByEmail,
    reason: record.reason,
    note: record.note,
    beforeAvailableCreditCents: record.beforeAvailableCreditCents,
    beforeOutstandingAmountCents: record.beforeOutstandingAmountCents,
    afterAvailableCreditCents: record.afterAvailableCreditCents,
    afterOutstandingAmountCents: record.afterOutstandingAmountCents,
    previewFingerprint: record.previewFingerprint,
    idempotencyKey: record.idempotencyKey,
    reversedAt: record.reversedAt,
    reversedBy: record.reversedBy,
    reversedByEmail: record.reversedByEmail,
    reversalReason: record.reversalReason,
    sourceType: record.sourceType,
  };
}

function previewResponse(preview: LeaseCreditAllocationPreview, allocationRecords: LeaseCreditAllocationRecord[]) {
  const active = allocationRecords.filter((record) => record.status === "active").map(allocationSummary);
  const reversed = allocationRecords.filter((record) => record.status === "reversed").map(allocationSummary);
  return {
    leaseId: preview.leaseId,
    landlordId: preview.landlordId,
    sourceType: preview.sourceType,
    aggregateBalanceCents: preview.aggregateBalanceCents,
    sourceBalanceBeforeCents: preview.sourceBalanceBeforeCents,
    grossAvailableCreditCents: preview.grossAvailableCreditCents,
    activeAllocationAmountCents: preview.activeAllocationAmountCents,
    availableCreditCents: preview.availableCreditCents,
    eligibleObligations: preview.obligations,
    obligations: preview.obligations,
    suggestedAllocations: preview.obligations
      .filter((obligation) => obligation.suggestedAllocationAmountCents > 0)
      .map((obligation) => ({
        obligationRowId: obligation.obligationRowId,
        obligationKey: obligation.obligationKey,
        allocationAmountCents: obligation.suggestedAllocationAmountCents,
        beforeAvailableCreditCents: preview.availableCreditCents,
        beforeOutstandingAmountCents: obligation.outstandingAmountCents,
        afterAvailableCreditCents: obligation.afterAvailableCreditCents,
        afterOutstandingAmountCents: obligation.obligationOutstandingAfterCents,
      })),
    totalOutstandingAmountCents: preview.totalOutstandingAmountCents,
    totalSuggestedAllocationAmountCents: preview.totalSuggestedAllocationAmountCents,
    remainingAvailableCreditCents: preview.remainingAvailableCreditCents,
    previewFingerprint: preview.previewFingerprint,
    blockedReasons: preview.blockedReasons,
    allowed: preview.allowed,
    existingActiveAllocations: active,
    reversedAllocations: reversed,
    noLegalOrLifecycleEffect: NO_LEGAL_OR_LIFECYCLE_EFFECT,
  };
}

function routeErrorFromValidation(error: LeaseCreditAllocationValidationError): { status: number; code: string; message: string } {
  const code = error.code;
  if (code === CREDIT_ALLOCATION_STATE_STALE) {
    return { status: 409, code: "CREDIT_ALLOCATION_STATE_STALE", message: error.message };
  }
  if (code === "LEASE_CREDIT_ALLOCATION_AMOUNT_REQUIRED") {
    return { status: 400, code: "CREDIT_ALLOCATION_AMOUNT_INVALID", message: error.message };
  }
  if (code === "LEASE_CREDIT_ALLOCATION_AMOUNT_EXCEEDS_AVAILABLE_CREDIT") {
    return { status: 400, code: "CREDIT_ALLOCATION_AMOUNT_EXCEEDS_CREDIT", message: error.message };
  }
  if (code === "LEASE_CREDIT_ALLOCATION_AMOUNT_EXCEEDS_OUTSTANDING") {
    return { status: 400, code: "CREDIT_ALLOCATION_AMOUNT_EXCEEDS_OUTSTANDING", message: error.message };
  }
  if (code === "LEASE_CREDIT_ALLOCATION_OBLIGATION_NOT_FOUND") {
    return { status: 400, code: "CREDIT_ALLOCATION_OBLIGATION_NOT_ELIGIBLE", message: error.message };
  }
  if (code === "LEASE_CREDIT_ALLOCATION_DUPLICATE_CONFLICT") {
    return { status: 409, code: "CREDIT_ALLOCATION_IDEMPOTENCY_CONFLICT", message: error.message };
  }
  if (code === "LEASE_CREDIT_ALLOCATION_NO_CREDIT") {
    return { status: 400, code: "CREDIT_ALLOCATION_AMOUNT_EXCEEDS_CREDIT", message: error.message };
  }
  if (code === "LEASE_CREDIT_ALLOCATION_NO_OUTSTANDING_OBLIGATION") {
    return { status: 400, code: "CREDIT_ALLOCATION_OBLIGATION_NOT_ELIGIBLE", message: error.message };
  }
  return { status: 400, code: "CREDIT_ALLOCATION_AMOUNT_INVALID", message: error.message };
}

function routeValidationError(res: Response, code: string, preview?: ReturnType<typeof previewResponse>) {
  return res.status(400).json({
    ok: false,
    error: code,
    code,
    ...(preview ? { preview } : {}),
  });
}

async function loadLeaseForLandlord(leaseId: string, landlordId: string) {
  const snap = await db.collection("leases").doc(leaseId).get();
  if (!snap.exists) return { ok: false as const, status: 404, code: "LEASE_NOT_FOUND" };
  const lease = (snap.data() as any) || {};
  if (String(lease?.landlordId || "").trim() !== landlordId) {
    return { ok: false as const, status: 403, code: "FORBIDDEN" };
  }
  return { ok: true as const, lease };
}

async function loadLedgerEntries(leaseId: string, landlordId: string) {
  const snap = await db
    .collection(LEDGER_COLLECTION)
    .where("landlordId", "==", landlordId)
    .where("leaseId", "==", leaseId)
    .get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }));
}

async function loadLeaseRentPaymentsForObligationLedger(leaseId: string, landlordId: string): Promise<RentPaymentRecord[]> {
  const snap = await db
    .collection("rentPayments")
    .where("leaseId", "==", leaseId)
    .get()
    .catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record: any) => String(record?.landlordId || "").trim() === landlordId)
    .map((record: any) => ({
      id: cleanString(record?.id || record?.rentPaymentId || record?.paymentId || "", 240) || cleanString(record?.id, 240) || "",
      leaseId: cleanString(record?.leaseId, 240) || "",
      tenantId: cleanString(record?.tenantId, 240) || "",
      landlordId: cleanString(record?.landlordId, 240) || "",
      propertyId: cleanString(record?.propertyId, 240),
      unitId: cleanString(record?.unitId, 240),
      paymentIntentId: cleanString(record?.paymentIntentId, 240),
      amountCents: normalizeAmountCents(record?.amountCents),
      currency: "cad" as const,
      status: cleanString(record?.status, 80) as RentPaymentRecord["status"] || "setup_required",
      processor: "stripe" as const,
      processorCheckoutSessionId: cleanString(record?.processorCheckoutSessionId, 240),
      processorPaymentIntentId: cleanString(record?.processorPaymentIntentId, 240),
      createdAt: cleanString(record?.createdAt, 120) || "",
      updatedAt: cleanString(record?.updatedAt, 120) || "",
      paidAt: cleanString(record?.paidAt, 120),
    }));
}

async function loadLeasePaymentIntentsForObligationLedger(leaseId: string, landlordId: string) {
  const snap = await db
    .collection("paymentIntents")
    .where("leaseId", "==", leaseId)
    .get()
    .catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ paymentIntentId: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record: any) => String(record?.landlordId || "").trim() === landlordId);
}

async function loadLeaseReconciliationRecordsForObligationLedger(params: {
  leaseId: string;
  paymentIntentIds: string[];
  rentPaymentIds: string[];
}) {
  const records = new Map<string, any>();
  async function collect(field: string, value: string) {
    const normalizedValue = cleanString(value, 240);
    if (!normalizedValue) return;
    const snap = await db
      .collection("paymentReconciliationRecords")
      .where(field, "==", normalizedValue)
      .get()
      .catch(() => null);
    for (const doc of snap?.docs || []) {
      records.set(doc.id, { reconciliationId: doc.id, ...((doc.data() as any) || {}) });
    }
  }
  await collect("leaseId", params.leaseId);
  await collect("subjectId", params.leaseId);
  for (const paymentIntentId of params.paymentIntentIds) await collect("paymentIntentId", paymentIntentId);
  for (const rentPaymentId of params.rentPaymentIds) {
    await collect("rentPaymentId", rentPaymentId);
    await collect("subjectId", rentPaymentId);
  }
  return Array.from(records.values());
}

function isAllocationContextError(value: LeaseAllocationContext | LeaseAllocationContextError): value is LeaseAllocationContextError {
  return (value as LeaseAllocationContextError).ok === false;
}

async function loadAllocationContext(leaseId: string, landlordId: string): Promise<LeaseAllocationContext | LeaseAllocationContextError> {
  const leaseResult = await loadLeaseForLandlord(leaseId, landlordId);
  if (!leaseResult.ok) return leaseResult;
  const lease = leaseResult.lease;
  const [entries, rentPayments, paymentIntents, canonicalPayments] = await Promise.all([
    loadLedgerEntries(leaseId, landlordId),
    loadLeaseRentPaymentsForObligationLedger(leaseId, landlordId),
    loadLeasePaymentIntentsForObligationLedger(leaseId, landlordId),
    loadLeaseCanonicalPaymentsForObligationLedger(leaseId, landlordId),
  ]);
  const ledgerPaymentEvidence = buildCanonicalPaymentEvidenceFromLedgerEntries(entries, canonicalPayments);
  const reconciliationRecords = await loadLeaseReconciliationRecordsForObligationLedger({
    leaseId,
    paymentIntentIds: paymentIntents.map((record: any) => cleanString(record?.paymentIntentId, 240)).filter(Boolean) as string[],
    rentPaymentIds: rentPayments.map((record) => cleanString(record?.id, 240)).filter(Boolean) as string[],
  });
  const lifecycle = deriveLeaseLifecycleState({ id: leaseId, ...lease });
  const obligationRows = buildPaymentObligationLedgerRows({
    leases: [
      {
        id: leaseId,
        ...lease,
        amountCents: normalizeLeaseRentAmountCents(lease),
        derivedLifecycleState: lifecycle.state,
      },
    ],
    paymentIntents,
    rentPayments,
    canonicalPayments: [...canonicalPayments, ...ledgerPaymentEvidence],
    reconciliationRecords,
  });
  const allocationRecords = await listLeaseCreditAllocationRecords({ landlordId, leaseId });
  const aggregateBalanceCents = entries.reduce((sum, entry) => sum + signedLedgerAmountCents(entry), 0);
  const preview = buildLeaseCreditAllocationPreview({
    landlordId,
    leaseId,
    aggregateBalanceCents,
    obligationRows,
    allocationRecords,
  });
  return {
    landlordId,
    leaseId,
    lease,
    entries,
    aggregateBalanceCents,
    obligationRows,
    allocationRecords,
    preview,
  };
}

async function recordAllocationEvent(input: {
  action: "lease_credit_allocation_created" | "lease_credit_allocation_reversed";
  req: any;
  landlordId: string;
  leaseId: string;
  record: LeaseCreditAllocationRecord;
}) {
  const actor = getActor(input.req, input.landlordId);
  await writeCanonicalEvent({
    domain: "payment",
    action: input.action,
    status: input.record.status,
    actor: {
      type: actorTypeForRole(actor.role),
      id: actor.id,
      role: actor.role,
      displayName: actor.email,
    },
    resource: {
      type: "lease_credit_allocation",
      id: input.record.allocationId,
      parentType: "lease",
      parentId: input.leaseId,
    },
    visibility: "internal",
    summary:
      input.action === "lease_credit_allocation_reversed"
        ? "Lease credit allocation was reversed by an operator."
        : "Lease credit was allocated to an eligible obligation by an operator.",
    metadata: {
      landlordId: input.landlordId,
      leaseId: input.leaseId,
      obligationRowId: input.record.obligationRowId,
      obligationKey: input.record.obligationKey,
      allocationAmountCents: input.record.allocationAmountCents,
      beforeAvailableCreditCents: input.record.beforeAvailableCreditCents,
      beforeOutstandingAmountCents: input.record.beforeOutstandingAmountCents,
      afterAvailableCreditCents: input.record.afterAvailableCreditCents,
      afterOutstandingAmountCents: input.record.afterOutstandingAmountCents,
      noLegalOrLifecycleEffect: NO_LEGAL_OR_LIFECYCLE_EFFECT,
    },
    tags: ["lease_credit_allocation"],
  });
}

async function tryRecordAllocationEvent(input: Parameters<typeof recordAllocationEvent>[0]): Promise<boolean> {
  try {
    await recordAllocationEvent(input);
    return true;
  } catch (err) {
    console.warn("[landlordLeaseCreditAllocationRoutes] canonical event write skipped", {
      action: input.action,
      leaseId: input.leaseId,
      allocationId: input.record.allocationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function mergeAllocationRecords(records: LeaseCreditAllocationRecord[], next: LeaseCreditAllocationRecord) {
  const byId = new Map(records.map((record) => [record.allocationId, record]));
  byId.set(next.allocationId, next);
  return Array.from(byId.values());
}

function nextPreviewForContext(context: LeaseAllocationContext, allocationRecords: LeaseCreditAllocationRecord[]) {
  return buildLeaseCreditAllocationPreview({
    landlordId: context.landlordId,
    leaseId: context.leaseId,
    aggregateBalanceCents: context.aggregateBalanceCents,
    obligationRows: context.obligationRows,
    allocationRecords,
  });
}

router.get("/leases/:leaseId/credit-allocation-preview", requireAuth, requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = cleanString(req.user?.landlordId || req.user?.id, 240);
    const leaseId = cleanString(req.params?.leaseId, 240);
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" });
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required", code: "LEASE_ID_REQUIRED" });
    const context = await loadAllocationContext(leaseId, landlordId);
    if (isAllocationContextError(context)) {
      return res.status(context.status).json({ ok: false, error: context.code, code: context.code });
    }
    return res.status(200).json({ ok: true, ...previewResponse(context.preview, context.allocationRecords) });
  } catch (err) {
    console.error("[landlordLeaseCreditAllocationRoutes] preview failed", err);
    return res.status(500).json({ ok: false, error: "CREDIT_ALLOCATION_PREVIEW_FAILED", code: "CREDIT_ALLOCATION_PREVIEW_FAILED" });
  }
});

router.post("/leases/:leaseId/credit-allocations", requireAuth, requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = cleanString(req.user?.landlordId || req.user?.id, 240);
    const leaseId = cleanString(req.params?.leaseId, 240);
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" });
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required", code: "LEASE_ID_REQUIRED" });
    const context = await loadAllocationContext(leaseId, landlordId);
    if (isAllocationContextError(context)) {
      return res.status(context.status).json({ ok: false, error: context.code, code: context.code });
    }
    const currentPreview = previewResponse(context.preview, context.allocationRecords);
    const obligationRef = cleanString(req.body?.obligationRowId, 500);
    if (!obligationRef) {
      return routeValidationError(res, "CREDIT_ALLOCATION_OBLIGATION_NOT_ELIGIBLE", currentPreview);
    }
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, "allocationAmountCents")) {
      return routeValidationError(res, "CREDIT_ALLOCATION_AMOUNT_INVALID", currentPreview);
    }
    if (!cleanString(req.body?.previewFingerprint, 240)) {
      return res.status(409).json({
        ok: false,
        error: "CREDIT_ALLOCATION_STATE_STALE",
        code: "CREDIT_ALLOCATION_STATE_STALE",
        preview: currentPreview,
      });
    }
    const idempotencyKey = cleanString(req.body?.idempotencyKey, 500);
    if (!idempotencyKey) {
      return routeValidationError(res, "CREDIT_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED", currentPreview);
    }
    const existingForIdempotency = idempotencyKey
      ? context.allocationRecords.find((record: LeaseCreditAllocationRecord) => record.idempotencyKey === idempotencyKey)
      : null;
    const selectedObligation = context.preview.obligations.find(
      (obligation) => obligation.obligationRowId === obligationRef
    );
    const obligationKey = selectedObligation?.obligationKey || existingForIdempotency?.obligationKey;
    if (!obligationKey) {
      return res.status(400).json({
        ok: false,
        error: "CREDIT_ALLOCATION_OBLIGATION_NOT_ELIGIBLE",
        code: "CREDIT_ALLOCATION_OBLIGATION_NOT_ELIGIBLE",
        preview: previewResponse(context.preview, context.allocationRecords),
      });
    }
    const actor = getActor(req, landlordId);
    const result = await applyLeaseCreditAllocation({
      landlordId,
      leaseId,
      aggregateBalanceCents: context.aggregateBalanceCents,
      obligationRows: context.obligationRows,
      allocationRecords: context.allocationRecords,
      obligationKey,
      allocationAmountCents: Number(req.body?.allocationAmountCents),
      expectedPreviewFingerprint: cleanString(req.body?.previewFingerprint, 240) || "",
      createdBy: actor.id,
      createdByEmail: actor.email,
      note: cleanString(req.body?.note, 1000),
      reason: "operator_credit_allocation",
      idempotencyKey,
      firestore: db as any,
    });
    if (!result.ok) {
      const routeError = routeErrorFromValidation(result.error);
      return res.status(routeError.status).json({
        ok: false,
        error: routeError.code,
        code: routeError.code,
        message: routeError.message,
        preview: previewResponse(result.preview, context.allocationRecords),
      });
    }
    if (!result.idempotentReplay) {
      await tryRecordAllocationEvent({ action: "lease_credit_allocation_created", req, landlordId, leaseId, record: result.record });
    }
    const nextRecords = mergeAllocationRecords(context.allocationRecords, result.record);
    const nextPreview = nextPreviewForContext(context, nextRecords);
    return res.status(result.idempotentReplay ? 200 : 201).json({
      ok: true,
      allocation: allocationSummary(result.record),
      idempotentReplay: result.idempotentReplay,
      beforePreview: previewResponse(result.preview, context.allocationRecords),
      preview: previewResponse(nextPreview, nextRecords),
      noLegalOrLifecycleEffect: NO_LEGAL_OR_LIFECYCLE_EFFECT,
    });
  } catch (err: any) {
    if (String(err?.message || "") === "lease_credit_allocation_record_exists") {
      return res.status(409).json({
        ok: false,
        error: "CREDIT_ALLOCATION_IDEMPOTENCY_CONFLICT",
        code: "CREDIT_ALLOCATION_IDEMPOTENCY_CONFLICT",
      });
    }
    console.error("[landlordLeaseCreditAllocationRoutes] apply failed", err);
    return res.status(500).json({ ok: false, error: "CREDIT_ALLOCATION_APPLY_FAILED", code: "CREDIT_ALLOCATION_APPLY_FAILED" });
  }
});

router.post("/leases/:leaseId/credit-allocations/:allocationId/reverse", requireAuth, requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = cleanString(req.user?.landlordId || req.user?.id, 240);
    const leaseId = cleanString(req.params?.leaseId, 240);
    const allocationId = cleanString(req.params?.allocationId, 500);
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" });
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required", code: "LEASE_ID_REQUIRED" });
    if (!allocationId) {
      return res.status(400).json({ ok: false, error: "CREDIT_ALLOCATION_NOT_FOUND", code: "CREDIT_ALLOCATION_NOT_FOUND" });
    }
    const context = await loadAllocationContext(leaseId, landlordId);
    if (isAllocationContextError(context)) {
      return res.status(context.status).json({ ok: false, error: context.code, code: context.code });
    }
    const record = context.allocationRecords.find((allocation: LeaseCreditAllocationRecord) => allocation.allocationId === allocationId);
    if (!record) {
      return res.status(404).json({ ok: false, error: "CREDIT_ALLOCATION_NOT_FOUND", code: "CREDIT_ALLOCATION_NOT_FOUND" });
    }
    if (record.status !== "active") {
      return res.status(409).json({
        ok: false,
        error: "CREDIT_ALLOCATION_ALREADY_REVERSED",
        code: "CREDIT_ALLOCATION_ALREADY_REVERSED",
        allocation: allocationSummary(record),
        preview: previewResponse(context.preview, context.allocationRecords),
        noLegalOrLifecycleEffect: NO_LEGAL_OR_LIFECYCLE_EFFECT,
      });
    }
    const actor = getActor(req, landlordId);
    const reversed = await reverseLeaseCreditAllocation({
      record,
      reversedBy: actor.id,
      reversedByEmail: actor.email,
      reversalReason: cleanString(req.body?.reason || req.body?.reversalReason, 1000) || "operator_reversal",
      firestore: db as any,
    });
    await tryRecordAllocationEvent({ action: "lease_credit_allocation_reversed", req, landlordId, leaseId, record: reversed });
    const nextRecords = mergeAllocationRecords(context.allocationRecords, reversed);
    const nextPreview = nextPreviewForContext(context, nextRecords);
    return res.status(200).json({
      ok: true,
      allocation: allocationSummary(reversed),
      preview: previewResponse(nextPreview, nextRecords),
      noLegalOrLifecycleEffect: NO_LEGAL_OR_LIFECYCLE_EFFECT,
    });
  } catch (err) {
    console.error("[landlordLeaseCreditAllocationRoutes] reverse failed", err);
    return res.status(500).json({ ok: false, error: "CREDIT_ALLOCATION_REVERSE_FAILED", code: "CREDIT_ALLOCATION_REVERSE_FAILED" });
  }
});

export default router;
