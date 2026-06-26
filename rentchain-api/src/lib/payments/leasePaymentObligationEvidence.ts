import { db } from "../../firebase";
import type { PaymentObligationCanonicalPaymentInput } from "./paymentObligationLedger";

const LEDGER_COLLECTION = "ledgerEntries";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function paymentEntryAmountCents(value: unknown): number {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.abs(Math.round(amount));
}

export async function loadLeaseLedgerEntriesForObligationEvidence(
  leaseId: string,
  landlordId: string
): Promise<any[]> {
  const snap = await db
    .collection(LEDGER_COLLECTION)
    .where("landlordId", "==", landlordId)
    .where("leaseId", "==", leaseId)
    .get()
    .catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
    .sort((a: any, b: any) => {
      const dateDiff = asString(a?.effectiveDate, 120).localeCompare(asString(b?.effectiveDate, 120));
      if (dateDiff !== 0) return dateDiff;
      return asString(a?.createdAt, 120).localeCompare(asString(b?.createdAt, 120));
    });
}

export async function loadLeaseCanonicalPaymentsForObligationLedger(
  leaseId: string,
  landlordId: string
): Promise<PaymentObligationCanonicalPaymentInput[]> {
  const snap = await db
    .collection("payments")
    .where("leaseId", "==", leaseId)
    .get()
    .catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record: any) => asString(record?.landlordId, 240) === landlordId)
    .filter((record: any) => {
      const source = asString(record?.source, 120).toLowerCase();
      const status = asString(record?.status, 120).toLowerCase();
      if (source === "rent_payment_checkout") return false;
      return !status || status === "recorded" || status === "paid" || status === "completed" || status === "reconciled";
    })
    .map((record: any) => ({
      id: asString(record?.id, 240),
      paymentDocumentId: asString(record?.paymentDocumentId || record?.id, 240) || null,
      leaseId: asString(record?.leaseId, 240),
      tenantId: asString(record?.tenantId, 240),
      landlordId: asString(record?.landlordId, 240),
      propertyId: asString(record?.propertyId, 240) || null,
      unitId: asString(record?.unitId, 240) || null,
      amountCents: Math.max(0, Math.round(Number(record?.amountCents || 0))),
      currency: asString(record?.currency || "cad", 20).toLowerCase() || "cad",
      status: asString(record?.status || "recorded", 80).toLowerCase() || "recorded",
      paidAt: asString(record?.paidAt, 120) || null,
      effectiveDate: asString(record?.effectiveDate || record?.paidAt, 120) || null,
      method: asString(record?.method, 120) || null,
      reference: asString(record?.reference, 240) || null,
      source: asString(record?.source, 120) || null,
      ledgerEntryId: asString(record?.ledgerEntryId, 240) || null,
    }));
}

export function buildCanonicalPaymentEvidenceFromLedgerEntries(
  entries: any[],
  existingPayments: PaymentObligationCanonicalPaymentInput[]
): PaymentObligationCanonicalPaymentInput[] {
  const existingPaymentDocumentIds = new Set(
    existingPayments.map((payment) => asString(payment.paymentDocumentId || payment.id, 240)).filter(Boolean)
  );
  const existingLedgerEntryIds = new Set(
    existingPayments.map((payment) => asString(payment.ledgerEntryId, 240)).filter(Boolean)
  );
  return (entries || [])
    .filter((entry: any) => asString(entry?.entryType || entry?.type, 80).toLowerCase() === "payment")
    .filter((entry: any) => {
      const entryId = asString(entry?.id, 240);
      const paymentDocumentId = asString(entry?.paymentDocumentId, 240);
      if (entryId && existingLedgerEntryIds.has(entryId)) return false;
      if (paymentDocumentId && existingPaymentDocumentIds.has(paymentDocumentId)) return false;
      return true;
    })
    .map((entry: any) => ({
      id: asString(entry?.paymentDocumentId || entry?.id, 240),
      paymentDocumentId: asString(entry?.paymentDocumentId, 240) || null,
      leaseId: asString(entry?.leaseId, 240),
      tenantId: asString(entry?.tenantId, 240) || null,
      landlordId: asString(entry?.landlordId, 240) || null,
      propertyId: asString(entry?.propertyId, 240) || null,
      unitId: asString(entry?.unitId, 240) || null,
      amountCents: paymentEntryAmountCents(entry?.amountCents),
      currency: "cad",
      status: "recorded",
      paidAt: asString(entry?.paidAt || entry?.effectiveDate, 120) || null,
      effectiveDate: asString(entry?.effectiveDate || entry?.paidAt, 120) || null,
      method: asString(entry?.method, 120) || null,
      reference: asString(entry?.reference, 240) || null,
      source: asString(entry?.source || "ledger_entry_payment", 120) || "ledger_entry_payment",
      ledgerEntryId: asString(entry?.id, 240) || null,
    }));
}

export async function loadLeaseCanonicalPaymentEvidenceForObligationLedger(
  leaseId: string,
  landlordId: string,
  entries?: any[] | null
): Promise<PaymentObligationCanonicalPaymentInput[]> {
  const canonicalPayments = await loadLeaseCanonicalPaymentsForObligationLedger(leaseId, landlordId);
  const ledgerEntries = entries || (await loadLeaseLedgerEntriesForObligationEvidence(leaseId, landlordId));
  return [...canonicalPayments, ...buildCanonicalPaymentEvidenceFromLedgerEntries(ledgerEntries, canonicalPayments)];
}
