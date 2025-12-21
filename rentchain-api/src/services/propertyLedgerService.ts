import { getPaymentsForProperty } from "./paymentsService";

export type PropertyLedgerEntry = {
  id: string;
  propertyId: string;
  tenantId?: string | null;
  date: string | null;
  label: string;
  type: "charge" | "payment" | "adjustment";
  amount: number;
  runningBalance: number;
};

/**
 * Build a property ledger. Event-based ledger could be wired later; for now we fall back to payments.
 */
export async function getPropertyLedger(
  propertyId: string
): Promise<PropertyLedgerEntry[]> {
  // Fallback: synthesize ledger entries from payments
  const payments = await getPaymentsForProperty(propertyId);

  // Sort oldest first to calculate running balance
  const sortedAsc = payments
    .slice()
    .sort((a, b) => {
      const da = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const db = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return da - db;
    });

  let balance = 0;
  const entries: PropertyLedgerEntry[] = sortedAsc.map((p, idx) => {
    const amount = typeof p.amount === "number" ? p.amount : Number(p.amount) || 0;
    balance += amount;

    return {
      id: p.id || `${propertyId}-p-${idx}`,
      propertyId,
      tenantId: (p as any).tenantId ?? null,
      date: (p as any).paidAt ?? (p as any).date ?? null,
      label: p.notes || "Rent payment",
      type: "payment",
      amount,
      runningBalance: balance,
    };
  });

  // For display: newest first
  entries.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return entries;
}
