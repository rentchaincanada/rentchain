// @ts-nocheck
// rentchain-api/src/routes/paymentsRoutes.ts
import { Router, Request, Response } from "express";
import {
  CreatePaymentPayload,
  paymentsService,
  Payment,
} from "../services/paymentsService";
import { leaseService } from "../services/leaseService";
import { recordPaymentEvent } from "../services/ledgerEventsService";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { buildDatedExportFilename, setAttachmentExportHeaders } from "../lib/exports/exportResponse";
import { db } from "../config/firebase";

const router = Router();
const paymentsEditRouter = Router();

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const roleForReq = (req: any) => String(req.user?.actorRole || req.user?.role || "").trim().toLowerCase();

function landlordIdForReq(req: any): string {
  return String(req.user?.landlordId || req.user?.id || "").trim();
}

const PAYMENT_OWNER_FIELDS = ["landlordId", "ownerId", "userId", "createdByLandlordId"] as const;
const LEGACY_DEMO_TENANT_IDS = new Set(["t1", "t2", "t3", "t-001"]);
const LEGACY_DEMO_PROPERTY_IDS = new Set(["p-main"]);

type PaymentOwnershipContext = {
  tenantIds: Set<string>;
  propertyIds: Set<string>;
  leaseIds: Set<string>;
};

const emptyPaymentOwnershipContext = (): PaymentOwnershipContext => ({
  tenantIds: new Set(),
  propertyIds: new Set(),
  leaseIds: new Set(),
});

function hasSafeLandlordOwnership(raw: any, landlordId: string): boolean {
  const expected = String(landlordId || "").trim();
  if (!expected) return false;
  return PAYMENT_OWNER_FIELDS.some((field) => String(raw?.[field] || "").trim() === expected);
}

function hasLinkedPaymentOwnership(raw: any, ownership: PaymentOwnershipContext): boolean {
  const tenantId = String(raw?.tenantId || "").trim();
  const propertyId = String(raw?.propertyId || "").trim();
  const leaseId = String(raw?.leaseId || "").trim();
  return (
    (tenantId && ownership.tenantIds.has(tenantId)) ||
    (propertyId && ownership.propertyIds.has(propertyId)) ||
    (leaseId && ownership.leaseIds.has(leaseId))
  );
}

function isBlockedLegacyDemoPayment(raw: any): boolean {
  const tenantId = String(raw?.tenantId || "").trim().toLowerCase();
  const propertyId = String(raw?.propertyId || "").trim().toLowerCase();
  return LEGACY_DEMO_TENANT_IDS.has(tenantId) || LEGACY_DEMO_PROPERTY_IDS.has(propertyId);
}

function hasProvenPaymentOwnership(raw: any, landlordId: string, ownership: PaymentOwnershipContext): boolean {
  return hasSafeLandlordOwnership(raw, landlordId) || hasLinkedPaymentOwnership(raw, ownership);
}

function resolvedLandlordIdForRecord(
  raw: any,
  landlordId?: string,
  ownership: PaymentOwnershipContext = emptyPaymentOwnershipContext()
): string | null {
  const scopedLandlordId = String(landlordId || "").trim();
  if (scopedLandlordId && hasProvenPaymentOwnership(raw, scopedLandlordId, ownership)) return scopedLandlordId;
  return String(raw?.landlordId || "").trim() || null;
}

function resolveTenantLabel(raw: any): string {
  return (
    String(raw?.fullName || raw?.name || raw?.displayName || "").trim() ||
    [String(raw?.firstName || "").trim(), String(raw?.lastName || "").trim()].filter(Boolean).join(" ") ||
    String(raw?.email || "").trim() ||
    "Tenant"
  );
}

function resolvePropertyLabel(raw: any): string {
  return (
    String(raw?.name || raw?.addressLine1 || raw?.address || raw?.displayName || raw?.propertyName || "").trim() ||
    "Property"
  );
}

function toMillis(value: any): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function toIsoString(value: any): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  const millis = toMillis(value);
  return millis == null ? null : new Date(millis).toISOString();
}

function isSameYearMonth(value: any, year: number, month: number) {
  const iso = String(toIsoString(value) || "").trim();
  if (!iso) return false;
  const expectedMonth = String(month).padStart(2, "0");
  const dateOnlyMatch = iso.match(/^(\d{4})-(\d{2})/);
  if (dateOnlyMatch) {
    return Number(dateOnlyMatch[1]) === year && dateOnlyMatch[2] === expectedMonth;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month;
}

function normalizePersistedPayment(
  docId: string,
  raw: any,
  landlordId?: string,
  ownership: PaymentOwnershipContext = emptyPaymentOwnershipContext()
): Payment & {
  status?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
} {
  return {
    id: docId,
    landlordId: resolvedLandlordIdForRecord(raw, landlordId, ownership),
    tenantId: String(raw?.tenantId || "").trim(),
    propertyId: String(raw?.propertyId || "").trim() || null,
    amount: Number(raw?.amount ?? 0),
    paidAt: String(toIsoString(raw?.paidAt) || "").trim(),
    method: String(raw?.method || "").trim(),
    notes: raw?.notes ?? null,
    status: String(raw?.status || "").trim() || "Recorded",
    createdAt: toIsoString(raw?.createdAt),
    updatedAt: toIsoString(raw?.updatedAt),
    leaseId: String(raw?.leaseId || "").trim() || null,
    unitId: String(raw?.unitId || "").trim() || null,
    paymentIntentId: String(raw?.paymentIntentId || "").trim() || null,
    processorPaymentIntentId: String(raw?.processorPaymentIntentId || raw?.stripePaymentIntentId || "").trim() || null,
    processorCheckoutSessionId: String(raw?.processorCheckoutSessionId || raw?.stripeCheckoutSessionId || "").trim() || null,
    source: "payments",
  };
}

async function collectOwnedEntityIds(collectionName: string, landlordId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const collection = db.collection(collectionName);
  await Promise.all(
    PAYMENT_OWNER_FIELDS.map(async (field) => {
      const snap = await collection.where(field, "==", landlordId).limit(1000).get();
      snap.docs.forEach((doc: any) => {
        const data = doc.data() as any;
        if (hasSafeLandlordOwnership(data, landlordId)) ids.add(doc.id);
      });
    })
  );
  return ids;
}

async function buildPaymentOwnershipContext(landlordId: string): Promise<PaymentOwnershipContext> {
  const [tenantIds, propertyIds, leaseIds] = await Promise.all([
    collectOwnedEntityIds("tenants", landlordId),
    collectOwnedEntityIds("properties", landlordId),
    collectOwnedEntityIds("leases", landlordId),
  ]);
  return { tenantIds, propertyIds, leaseIds };
}

async function collectPaymentsByField(
  field: "tenantId" | "propertyId" | "leaseId",
  values: Set<string>,
  tenantId?: string
): Promise<Map<string, any>> {
  const docsById = new Map<string, any>();
  const base = db.collection("payments");
  const filteredValues =
    field === "tenantId" && tenantId
      ? values.has(tenantId)
        ? [tenantId]
        : []
      : Array.from(values);

  await Promise.all(
    filteredValues.map(async (value) => {
      const snap = await base.where(field, "==", value).limit(500).get();
      snap.docs.forEach((doc: any) => {
        const raw = doc.data() as any;
        if (tenantId && String(raw?.tenantId || "").trim() !== tenantId) return;
        docsById.set(doc.id, raw);
      });
    })
  );
  return docsById;
}

async function listPersistedPayments(
  landlordId?: string,
  tenantId?: string
): Promise<Array<ReturnType<typeof normalizePersistedPayment>>> {
  const base = db.collection("payments");
  if (landlordId) {
    const ownership = await buildPaymentOwnershipContext(landlordId);
    const docsById = new Map<string, any>();
    await Promise.all(
      PAYMENT_OWNER_FIELDS.map(async (field) => {
        const snap = await base.where(field, "==", landlordId).limit(500).get();
        snap.docs.forEach((doc: any) => {
          const raw = doc.data() as any;
          if (tenantId && String(raw?.tenantId || "").trim() !== tenantId) return;
          docsById.set(doc.id, raw);
        });
      })
    );

    const [tenantLinked, propertyLinked, leaseLinked] = await Promise.all([
      collectPaymentsByField("tenantId", ownership.tenantIds, tenantId),
      collectPaymentsByField("propertyId", ownership.propertyIds, tenantId),
      collectPaymentsByField("leaseId", ownership.leaseIds, tenantId),
    ]);
    [tenantLinked, propertyLinked, leaseLinked].forEach((linkedDocs) => {
      linkedDocs.forEach((raw, docId) => docsById.set(docId, raw));
    });

    return Array.from(docsById.entries())
      .filter(([, raw]) => !isBlockedLegacyDemoPayment(raw))
      .filter(([, raw]) => hasProvenPaymentOwnership(raw, landlordId, ownership))
      .map(([docId, raw]) => normalizePersistedPayment(docId, raw, landlordId, ownership))
      .sort((a, b) => paymentDateMillis(b) - paymentDateMillis(a));
  }

  const query = tenantId
    ? base.where("tenantId", "==", tenantId).orderBy("paidAt", "desc").limit(200)
    : base.orderBy("paidAt", "desc").limit(500);
  const snap = await query.get();
  return snap.docs.map((doc: any) => normalizePersistedPayment(doc.id, doc.data() as any));
}

function normalizeRentPayment(
  docId: string,
  raw: any,
  landlordId: string
): ReturnType<typeof normalizePersistedPayment> | null {
  if (!hasSafeLandlordOwnership(raw, landlordId)) return null;
  const tenantId = String(raw?.tenantId || "").trim();
  if (!tenantId) return null;

  const rawAmountCents = Number(raw?.amountCents);
  const amount =
    Number.isFinite(rawAmountCents) && rawAmountCents > 0
      ? rawAmountCents / 100
      : Number(raw?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const paidAt = toIsoString(raw?.paidAt) || toIsoString(raw?.updatedAt) || toIsoString(raw?.createdAt);
  if (!paidAt) return null;

  const processor = String(raw?.processor || "").trim();
  return {
    id: docId,
    landlordId: resolvedLandlordIdForRecord(raw, landlordId),
    tenantId,
    propertyId: String(raw?.propertyId || "").trim() || null,
    amount,
    paidAt,
    method: String(raw?.method || processor || "stripe").trim(),
    notes: raw?.notes ?? null,
    status: String(raw?.status || "").trim() || "Recorded",
    createdAt: toIsoString(raw?.createdAt),
    updatedAt: toIsoString(raw?.updatedAt),
    leaseId: String(raw?.leaseId || "").trim() || null,
    unitId: String(raw?.unitId || "").trim() || null,
    rentPaymentId: String(raw?.rentPaymentId || raw?.id || docId || "").trim() || null,
    paymentIntentId: String(raw?.paymentIntentId || "").trim() || null,
    processorPaymentIntentId: String(raw?.processorPaymentIntentId || raw?.stripePaymentIntentId || "").trim() || null,
    processorCheckoutSessionId: String(raw?.processorCheckoutSessionId || raw?.stripeCheckoutSessionId || "").trim() || null,
    source: "rentPayments",
  };
}

async function loadLeasePaymentContexts(leaseIds: string[]): Promise<Map<string, any>> {
  const contexts = new Map<string, any>();
  const uniqueLeaseIds = Array.from(new Set(leaseIds.map((id) => String(id || "").trim()).filter(Boolean)));
  await Promise.all(
    uniqueLeaseIds.map(async (leaseId) => {
      const snap = await db.collection("leases").doc(leaseId).get();
      if (!snap.exists) return;
      contexts.set(leaseId, snap.data() as any);
    })
  );
  return contexts;
}

function normalizeLedgerEntryPayment(
  docId: string,
  raw: any,
  landlordId: string,
  lease: any | null = null
): ReturnType<typeof normalizePersistedPayment> | null {
  if (String(raw?.landlordId || "").trim() !== landlordId) return null;
  if (String(raw?.entryType || "").trim().toLowerCase() !== "payment") return null;

  const amountCents = Math.abs(Math.trunc(Number(raw?.amountCents || 0)));
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

  const paidAt = toIsoString(raw?.effectiveDate) || toIsoString(raw?.paidAt) || toIsoString(raw?.createdAt);
  if (!paidAt) return null;

  const leaseTenantIds = Array.isArray(lease?.tenantIds) ? lease.tenantIds : [];
  const tenantId = String(raw?.tenantId || lease?.tenantId || lease?.primaryTenantId || leaseTenantIds[0] || "").trim();
  const propertyId = String(raw?.propertyId || lease?.propertyId || "").trim() || null;
  const leaseId = String(raw?.leaseId || "").trim() || null;
  const unitId = String(raw?.unitId || lease?.unitId || lease?.unitNumber || "").trim() || null;
  const reference = String(raw?.reference || "").trim();

  return {
    id: docId,
    landlordId,
    tenantId,
    propertyId,
    amount: amountCents / 100,
    paidAt,
    method: String(raw?.method || "manual").trim(),
    notes: raw?.notes ?? null,
    status: String(raw?.status || "").trim() || "Recorded",
    createdAt: toIsoString(raw?.createdAt),
    updatedAt: toIsoString(raw?.updatedAt),
    leaseId,
    unitId,
    rentPaymentId: String(raw?.rentPaymentId || raw?.paymentId || "").trim() || null,
    paymentIntentId: String(raw?.paymentIntentId || "").trim() || null,
    processorPaymentIntentId: String(raw?.processorPaymentIntentId || raw?.stripePaymentIntentId || "").trim() || null,
    processorCheckoutSessionId: String(raw?.processorCheckoutSessionId || raw?.stripeCheckoutSessionId || "").trim() || null,
    reference: reference || null,
    source: "ledgerEntries",
  };
}

async function listRentPayments(
  landlordId: string,
  tenantId?: string
): Promise<Array<ReturnType<typeof normalizePersistedPayment>>> {
  const base = db.collection("rentPayments");
  const docsById = new Map<string, any>();
  await Promise.all(
    PAYMENT_OWNER_FIELDS.map(async (field) => {
      const snap = await base.where(field, "==", landlordId).limit(1000).get();
      snap.docs.forEach((doc: any) => {
        const raw = doc.data() as any;
        if (tenantId && String(raw?.tenantId || "").trim() !== tenantId) return;
        docsById.set(doc.id, raw);
      });
    })
  );

  return Array.from(docsById.entries())
    .map(([docId, raw]) => normalizeRentPayment(docId, raw, landlordId))
    .filter((payment: any): payment is ReturnType<typeof normalizePersistedPayment> => Boolean(payment));
}

async function listLedgerEntryPayments(
  landlordId: string,
  tenantId?: string
): Promise<Array<ReturnType<typeof normalizePersistedPayment>>> {
  const snap = await db
    .collection("ledgerEntries")
    .where("landlordId", "==", landlordId)
    .where("entryType", "==", "payment")
    .limit(1000)
    .get();
  const rawEntries = snap.docs.map((doc: any) => ({ docId: doc.id, raw: doc.data() as any }));
  const leaseContexts = await loadLeasePaymentContexts(rawEntries.map(({ raw }) => raw?.leaseId));
  return rawEntries
    .map(({ docId, raw }) =>
      normalizeLedgerEntryPayment(
        docId,
        raw,
        landlordId,
        String(raw?.leaseId || "").trim() ? leaseContexts.get(String(raw.leaseId).trim()) || null : null
      )
    )
    .filter((payment: any): payment is ReturnType<typeof normalizePersistedPayment> => Boolean(payment))
    .filter((payment) => !tenantId || String(payment.tenantId || "").trim() === tenantId);
}

function paymentDateMillis(payment: Payment): number {
  return toMillis((payment as any).paidAt) || toMillis((payment as any).updatedAt) || toMillis((payment as any).createdAt) || 0;
}

function amountCentsForPayment(payment: Payment): number {
  return Math.round(Number(payment.amount || 0) * 100);
}

function externalDedupeKeysForPayment(payment: Payment): string[] {
  const record = payment as any;
  const landlordId = String(record.landlordId || "").trim();
  return [
    ["rentPaymentId", record.rentPaymentId],
    ["paymentIntentId", record.paymentIntentId],
    ["processorPaymentIntentId", record.processorPaymentIntentId],
    ["processorCheckoutSessionId", record.processorCheckoutSessionId],
  ]
    .map(([label, value]) => {
      const normalized = String(value || "").trim();
      return normalized && landlordId ? `${label}:${landlordId}:${normalized}` : "";
    })
    .filter(Boolean);
}

function fallbackDedupeKeysForPayment(payment: Payment): string[] {
  const record = payment as any;
  const landlordId = String(record.landlordId || "").trim();
  const tenantId = String(payment.tenantId || "").trim();
  const propertyId = String(payment.propertyId || "").trim();
  const leaseId = String(record.leaseId || "").trim();
  const paidAt = String(toIsoString((payment as any).paidAt) || "").trim();
  const paidDate = paidAt.slice(0, 10);
  const amountCents = amountCentsForPayment(payment);
  const keys: string[] = [];

  if (landlordId && tenantId && paidDate && amountCents > 0) {
    if (propertyId) keys.push(`tenant-property-date-amount:${landlordId}:${tenantId}:${propertyId}:${paidDate}:${amountCents}`);
    if (leaseId) keys.push(`tenant-lease-date-amount:${landlordId}:${tenantId}:${leaseId}:${paidDate}:${amountCents}`);
    keys.push(`tenant-date-amount:${landlordId}:${tenantId}:${paidDate}:${amountCents}`);
  }

  return keys;
}

function dedupeKeysForPayment(payment: Payment): string[] {
  return [...externalDedupeKeysForPayment(payment), ...fallbackDedupeKeysForPayment(payment)];
}

function preferPaymentRecord(current: ReturnType<typeof normalizePersistedPayment>, incoming: ReturnType<typeof normalizePersistedPayment>) {
  const currentDate = paymentDateMillis(current);
  const incomingDate = paymentDateMillis(incoming);
  if (incomingDate !== currentDate) return incomingDate > currentDate ? incoming : current;
  if ((incoming as any).source === "ledgerEntries" && (current as any).source !== "ledgerEntries") return incoming;
  if ((incoming as any).source === "rentPayments" && (current as any).source !== "rentPayments") return incoming;
  return current;
}

function mergeVisiblePayments(
  payments: Array<ReturnType<typeof normalizePersistedPayment>>
): Array<ReturnType<typeof normalizePersistedPayment>> {
  const rows: Array<ReturnType<typeof normalizePersistedPayment>> = [];
  const keyToIndex = new Map<string, number>();

  payments.forEach((payment) => {
    const externalKeys = externalDedupeKeysForPayment(payment);
    const fallbackKeys = fallbackDedupeKeysForPayment(payment);
    const externalIndex = externalKeys
      .map((key) => keyToIndex.get(key))
      .find((index): index is number => index != null);
    const fallbackIndex = fallbackKeys
      .map((key) => keyToIndex.get(key))
      .find((index): index is number => index != null && (rows[index] as any)?.source !== (payment as any).source);
    const existingIndex = externalIndex ?? fallbackIndex;
    const keys = [...externalKeys, ...fallbackKeys];
    if (existingIndex == null) {
      const nextIndex = rows.length;
      rows.push(payment);
      keys.forEach((key) => keyToIndex.set(key, nextIndex));
      return;
    }

    const preferred = preferPaymentRecord(rows[existingIndex], payment);
    rows[existingIndex] = preferred;
    dedupeKeysForPayment(preferred).forEach((key) => keyToIndex.set(key, existingIndex));
  });

  return rows.sort((a, b) => paymentDateMillis(b) - paymentDateMillis(a));
}

async function listVisiblePayments(
  landlordId: string,
  tenantId?: string
): Promise<Array<ReturnType<typeof normalizePersistedPayment>>> {
  const [ledgerEntryPayments, rentPayments, legacyPayments] = await Promise.all([
    listLedgerEntryPayments(landlordId, tenantId),
    listRentPayments(landlordId, tenantId),
    listPersistedPayments(landlordId, tenantId),
  ]);
  return mergeVisiblePayments([...ledgerEntryPayments, ...rentPayments, ...legacyPayments]);
}

async function getPersistedPaymentById(paymentId: string) {
  const snap = await db.collection("payments").doc(paymentId).get();
  if (!snap.exists) return null;
  return normalizePersistedPayment(snap.id, snap.data() as any);
}

async function buildPaymentLabelMaps(payments: Payment[]) {
  const tenantIds = Array.from(new Set(payments.map((payment) => String(payment.tenantId || "").trim()).filter(Boolean)));
  const propertyIds = Array.from(new Set(payments.map((payment) => String(payment.propertyId || "").trim()).filter(Boolean)));

  const [tenantSnaps, propertySnaps] = await Promise.all([
    Promise.all(tenantIds.map((id) => db.collection("tenants").doc(id).get())),
    Promise.all(propertyIds.map((id) => db.collection("properties").doc(id).get())),
  ]);

  const tenantLabels = new Map<string, string>();
  tenantSnaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() as any;
    tenantLabels.set(snap.id, resolveTenantLabel(data));
  });

  const propertyLabels = new Map<string, string>();
  propertySnaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() as any;
    propertyLabels.set(snap.id, resolvePropertyLabel(data));
  });

  return { tenantLabels, propertyLabels };
}

async function buildPaymentExportRows(payments: Payment[]) {
  const { tenantLabels, propertyLabels } = await buildPaymentLabelMaps(payments);
  return payments.map((payment) => ({
    paidDate: String(payment.paidAt || "").trim(),
    tenant: tenantLabels.get(String(payment.tenantId || "").trim()) || "Tenant",
    property: propertyLabels.get(String(payment.propertyId || "").trim()) || "Property",
    amount: Number(payment.amount || 0).toFixed(2),
    method: String(payment.method || "").trim(),
    notes: String(payment.notes || "").trim(),
  }));
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPaymentsSpreadsheetTable(rows: Array<Record<string, string>>) {
  const headers = ["Paid Date", "Tenant", "Property", "Amount", "Method", "Notes"];
  const rowHtml = rows
    .map((row) => {
      const cells = [row.paidDate, row.tenant, row.property, row.amount, row.method, row.notes]
        .map((value) => `<td>${htmlEscape(value)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>RentChain Payments Export</title></head>
  <body>
    <table>
      <thead><tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
  </body>
</html>`;
}

async function createPaymentAdjustmentEntry(options: {
  paymentId: string;
  landlordId: string;
  tenantId: string;
  leaseId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  originalAmountCents: number;
  newAmountCents: number;
  method?: string;
  createdBy?: string;
}): Promise<void> {
  const {
    paymentId,
    landlordId,
    tenantId,
    leaseId,
    propertyId,
    unitId,
    originalAmountCents,
    newAmountCents,
    method,
    createdBy,
  } = options;

  // Only create ledger entry if we have lease context
  if (!leaseId) {
    console.log(`[createPaymentAdjustmentEntry] Skipping adjustment entry for payment ${paymentId}: no leaseId`);
    return;
  }

  const amountDeltaCents = newAmountCents - originalAmountCents;
  const now = Date.now();
  const entryRef = db.collection("ledgerEntries").doc();

  const adjustmentEntry = {
    id: entryRef.id,
    landlordId,
    tenantId,
    leaseId,
    propertyId: String(propertyId || "").trim() || null,
    unitId: String(unitId || "").trim() || null,
    entryType: "adjustment" as const,
    category: "payment_adjustment",
    amountCents: amountDeltaCents,
    effectiveDate: new Date().toISOString(),
    method: String(method || "").trim() || null,
    reference: paymentId,
    notes: `Payment adjustment: ${amountDeltaCents > 0 ? '+' : amountDeltaCents < 0 ? '-' : ''}$${Math.abs(amountDeltaCents / 100).toFixed(2)} (${(originalAmountCents / 100).toFixed(2)} → ${(newAmountCents / 100).toFixed(2)})`,
    createdAt: now,
    createdBy: String(createdBy || "").trim() || null,

    // Additional metadata for audit trail
    sourceType: "payment_edit",
    referencePaymentId: paymentId,
    originalAmountCents,
    newAmountCents,
    amountDeltaCents,
  };

  try {
    await entryRef.set(adjustmentEntry, { merge: false });
    console.log(`[createPaymentAdjustmentEntry] Created adjustment entry ${entryRef.id} for payment ${paymentId}: ${amountDeltaCents} cents`);
  } catch (error) {
    console.error(`[createPaymentAdjustmentEntry] Failed to create adjustment entry for payment ${paymentId}:`, error);
    // Don't throw - preserve existing payment edit behavior
  }
}

const parseYearMonth = (req: Request): { year: number; month: number } | null => {
  const year = Number((req.query.year as string) ?? "");
  const month = Number((req.query.month as string) ?? "");
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
};

// GET /api/payments?tenantId=...
router.get("/payments", requireAuth, async (req: any, res: Response) => {
  res.setHeader("x-route-source", "paymentsRoutes.ts");
  res.setHeader("x-payments-route-version", "pr897-real-payment-sources-v4");
  res.setHeader("cache-control", "no-store");
  const tenantId = (req.query.tenantId as string | undefined) ?? undefined;
  const landlordId = landlordIdForReq(req);
  res.setHeader("x-payments-auth-scope", landlordId ? "landlord-resolved" : "landlord-unresolved");
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  try {
    const results = await listVisiblePayments(landlordId, tenantId);
    res.setHeader("x-payments-result-count", String(results.length));
    return res.json(results);
  } catch (err) {
    console.error("[paymentsRoutes] list failed", err);
    return res.status(500).json({ ok: false, error: "PAYMENTS_LIST_FAILED" });
  }
});

router.get("/payments/export.csv", requireAuth, async (req: any, res: Response) => {
  try {
    const role = roleForReq(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const rows = await buildPaymentExportRows(await listPersistedPayments());
    const csv = [
      ["paid_date", "tenant", "property", "amount", "method", "notes"].join(","),
      ...rows.map((row) => [row.paidDate, row.tenant, row.property, row.amount, row.method, row.notes].map(csvEscape).join(",")),
    ].join("\n");

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-payments", format: "csv" }),
      format: "csv",
    });
    return res.status(200).send(csv);
  } catch (err) {
    console.error("[paymentsRoutes] csv export failed", err);
    return res.status(500).json({ ok: false, error: "PAYMENTS_EXPORT_FAILED" });
  }
});

async function handlePaymentSpreadsheetExport(req: any, res: Response) {
  try {
    const role = roleForReq(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const rows = await buildPaymentExportRows(await listPersistedPayments());
    const table = renderPaymentsSpreadsheetTable(rows);

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-payments", format: "xls" }),
      format: "xls",
    });
    return res.status(200).send(table);
  } catch (err) {
    console.error("[paymentsRoutes] xls export failed", err);
    return res.status(500).json({ ok: false, error: "PAYMENTS_EXPORT_FAILED" });
  }
}

router.get("/payments/export.xls", requireAuth, handlePaymentSpreadsheetExport);
router.get("/payments/export.xlsx", requireAuth, handlePaymentSpreadsheetExport);

// POST /api/payments
router.post(
  "/payments",
  requireAuth,
  requirePermission(["payments.record", "ledger.record"]),
  async (req: any, res: Response) => {
  const body = req.body as Partial<CreatePaymentPayload>;
  if (!body.tenantId || typeof body.amount !== "number" || !body.paidAt || !body.method) {
    return res.status(400).json({ error: "tenantId, amount, paidAt, and method are required" });
  }
  const now = new Date().toISOString();
  const paymentPayload = {
    tenantId: body.tenantId,
    amount: body.amount,
    paidAt: body.paidAt,
    method: body.method,
    notes: body.notes ?? null,
    propertyId: body.propertyId ?? null,
    createdAt: now,
    updatedAt: now,
    status: "Recorded",
  };
  const paymentRef = await db.collection("payments").add(paymentPayload);
  const payment = normalizePersistedPayment(paymentRef.id, paymentPayload);

  recordPaymentEvent({
    landlordId: (req as any).user?.id,
    type: "payment_created",
    tenantId: payment.tenantId,
    amountDelta: payment.amount,
    referenceId: payment.id,
    method: payment.method,
    notes: payment.notes ?? undefined,
  });

  return res.status(201).json(payment);
}
);

// POST /api/payments/record (alias for quick entry)
router.post(
  "/payments/record",
  requireAuth,
  requirePermission(["payments.record", "ledger.record"]),
  async (req: any, res: Response) => {
  const body = req.body as Partial<CreatePaymentPayload>;
  if (!body.tenantId || typeof body.amount !== "number" || !body.paidAt || !body.method) {
    return res.status(400).json({ error: "tenantId, amount, paidAt, and method are required" });
  }
  const now = new Date().toISOString();
  const paymentPayload = {
    tenantId: body.tenantId,
    amount: body.amount,
    paidAt: body.paidAt,
    method: body.method,
    notes: body.notes ?? null,
    propertyId: body.propertyId ?? null,
    createdAt: now,
    updatedAt: now,
    status: "Recorded",
  };
  const paymentRef = await db.collection("payments").add(paymentPayload);
  const payment = normalizePersistedPayment(paymentRef.id, paymentPayload);

  recordPaymentEvent({
    landlordId: (req as any).user?.id,
    type: "payment_created",
    tenantId: payment.tenantId,
    amountDelta: payment.amount,
    referenceId: payment.id,
    method: payment.method,
    notes: payment.notes ?? undefined,
  });

  return res.status(201).json(payment);
}
);

// GET /api/payments/tenant/:tenantId/monthly
router.get("/payments/tenant/:tenantId/monthly", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const parsed = parseYearMonth(req);
  if (!parsed) {
    return res.json({ payments: [], total: 0 });
  }
  try {
    const payments = (await listPersistedPayments(undefined, tenantId)).filter((payment) =>
      isSameYearMonth(payment.paidAt, parsed.year, parsed.month)
    );
    const total = payments.reduce((sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0), 0);
    return res.json({ payments, total });
  } catch (err) {
    console.error("[paymentsRoutes] tenant monthly failed", err);
    return res.status(500).json({ ok: false, error: "PAYMENTS_MONTHLY_FAILED" });
  }
});

// GET /api/payments/property/:propertyId/monthly (stubbed to avoid 404/400)
router.get("/payments/property/:propertyId/monthly", requireAuth, (req: any, res: Response) => {
  res.setHeader("x-route-source", "paymentsRoutes.ts");
  const landlordId = req.user?.landlordId || req.user?.id;
  const propertyId = String(req.params.propertyId || "");
  const year = Number(req.query?.year);
  const month = Number(req.query?.month);

  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!propertyId || !Number.isFinite(year) || !Number.isFinite(month)) {
    return res.status(400).json({ ok: false, error: "Missing/invalid params" });
  }

  // Stubbed payload to keep UI stable while payments module is incomplete
  return res.json({
    ok: true,
    propertyId,
    year,
    month,
    totalCents: 0,
    items: [],
    // compatibility fields
    payments: [],
    total: 0,
  });
});

async function handlePaymentEdit(req: any, res: Response) {
  const { paymentId } = req.params;
  const { amount, notes } = req.body as Partial<Payment>;
  const existing = await getPersistedPaymentById(paymentId);
  if (!existing) {
    return res.status(404).json({ ok: false, code: "PAYMENT_NOT_FOUND", error: "Payment not found" });
  }

  const updatedAmount =
    typeof amount === "number" && !Number.isNaN(amount) ? amount : existing.amount;
  const updatedPayload = {
    amount: updatedAmount,
    notes: notes ?? existing.notes ?? null,
    updatedAt: new Date().toISOString(),
  };
  const delta = updatedAmount - existing.amount;
  const landlordId = (req as any).user?.id;
  const userId = (req as any).user?.id || (req as any).user?.email;

  // Use transaction for atomic payment update + adjustment entry
  await db.runTransaction(async (transaction) => {
    const paymentRef = db.collection("payments").doc(paymentId);

    // Read current payment state within transaction for consistency
    const currentPaymentSnap = await transaction.get(paymentRef);
    if (!currentPaymentSnap.exists) {
      throw new Error("Payment not found");
    }
    const currentPayment = currentPaymentSnap.data() as any;
    const currentAmount = Number(currentPayment?.amount || 0);
    const transactionDelta = updatedAmount - currentAmount;

    // Update payment record
    transaction.set(paymentRef, updatedPayload, { merge: true });

    // Create adjustment entry if amount actually changed and lease context exists
    if (transactionDelta !== 0 && (existing as any).leaseId) {
      const adjustmentRef = db.collection("ledgerEntries").doc();
      const amountDeltaCents = Math.round(transactionDelta * 100);
      const originalAmountCents = Math.round(currentAmount * 100);
      const newAmountCents = Math.round(updatedAmount * 100);
      const now = Date.now();

      const adjustmentEntry = {
        id: adjustmentRef.id,
        landlordId,
        tenantId: existing.tenantId,
        leaseId: (existing as any).leaseId,
        propertyId: String(existing.propertyId || "").trim() || null,
        unitId: String((existing as any).unitId || "").trim() || null,
        entryType: "adjustment" as const,
        category: "payment_adjustment",
        amountCents: amountDeltaCents,
        effectiveDate: new Date().toISOString(),
        method: String(existing.method || "").trim() || null,
        reference: existing.id,
        notes: `Payment adjustment: ${amountDeltaCents > 0 ? '+' : amountDeltaCents < 0 ? '-' : ''}$${Math.abs(amountDeltaCents / 100).toFixed(2)} (${(originalAmountCents / 100).toFixed(2)} → ${(newAmountCents / 100).toFixed(2)})`,
        createdAt: now,
        createdBy: String(userId || "").trim() || null,
        sourceType: "payment_edit",
        referencePaymentId: existing.id,
        originalAmountCents,
        newAmountCents,
        amountDeltaCents,
      };

      transaction.set(adjustmentRef, adjustmentEntry, { merge: false });
      console.log(`[paymentEdit] Creating adjustment entry ${adjustmentRef.id} for payment ${existing.id}: ${amountDeltaCents} cents`);
    }
  });

  const updated = {
    ...existing,
    ...updatedPayload,
  };

  // Record payment event after successful transaction (use original delta for event tracking)
  if (delta !== 0) {
    recordPaymentEvent({
      landlordId,
      type: "payment_updated",
      tenantId: existing.tenantId,
      amountDelta: delta,
      referenceId: existing.id,
      method: existing.method,
      notes: updated.notes ?? undefined,
    });
  }

  return res.status(200).json(updated);
}

// PUT /api/payments/:paymentId
router.put("/payments/:paymentId", requireAuth, requirePermission("payments.edit"), handlePaymentEdit);

// PATCH /api/payments/:paymentId
router.patch("/payments/:paymentId", requireAuth, requirePermission("payments.edit"), handlePaymentEdit);

paymentsEditRouter.put("/:paymentId", requireAuth, requirePermission("payments.edit"), handlePaymentEdit);
paymentsEditRouter.patch("/:paymentId", requireAuth, requirePermission("payments.edit"), handlePaymentEdit);

// DELETE /api/payments/:paymentId
router.delete("/payments/:paymentId", requireAuth, requirePermission("payments.edit"), async (req: any, res: Response) => {
  const { paymentId } = req.params;
  if (!paymentId) {
    return res.status(400).json({ error: "paymentId is required" });
  }
  const existing = await getPersistedPaymentById(paymentId);
  if (!existing) {
    return res.status(404).json({ error: "Payment not found" });
  }

  recordPaymentEvent({
    landlordId: (req as any).user?.id,
    type: "payment_deleted",
    tenantId: existing.tenantId,
    amountDelta: -Math.abs(existing.amount),
    referenceId: existing.id,
    method: existing.method,
    notes: existing.notes ?? undefined,
  });

  await db.collection("payments").doc(paymentId).delete();
  return res.status(204).send();
});

export default router;

// Export for testing
export { createPaymentAdjustmentEntry, handlePaymentEdit, paymentsEditRouter };
