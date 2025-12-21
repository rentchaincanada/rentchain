// src/services/tenantLedgerService.ts

export type LedgerEventType = "RentCharge" | "PaymentReceived" | "LateFee";

export interface TenantLedgerEvent {
  id: string;
  tenantId: string;
  type: LedgerEventType;
  amount: number;
  date: string; // ISO date, e.g. "2025-12-03"
  description: string;
  balanceAfter: number;
}

export interface TenantLedgerEntry {
  id: string;
  tenantId: string;
  date: string | null;
  type: string;
  amount: number;
  direction?: "debit" | "credit";
  method?: string | null;
  label?: string | null;
  notes?: string | null;
  referenceId?: string | null;
  runningBalance?: number;
}

// In-memory store for now (perfect for dev)
// Seed with the same sample data you already saw from /tenantLedger/t1
const ledgerStore: Record<string, TenantLedgerEvent[]> = {
  t1: [
    {
      id: "evt-1",
      tenantId: "t1",
      type: "RentCharge",
      amount: 1200,
      date: "2025-12-01",
      description: "December rent",
      balanceAfter: 1200,
    },
    {
      id: "evt-2",
      tenantId: "t1",
      type: "PaymentReceived",
      amount: -500,
      date: "2025-12-03",
      description: "Partial payment - e-transfer",
      balanceAfter: 700,
    },
    {
      id: "evt-3",
      tenantId: "t1",
      type: "LateFee",
      amount: 25,
      date: "2025-12-06",
      description: "Late fee",
      balanceAfter: 725,
    },
  ],
};

function getNextId(prefix: string = "evt"): string {
  const now = Date.now();
  const rand = Math.floor(Math.random() * 100000);
  return `${prefix}-${now}-${rand}`;
}

export function getLedgerForTenant(tenantId: string) {
  const events = ledgerStore[tenantId] ?? [];

  // sort by date then id (stable-ish ordering)
  const sorted = [...events].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    // tie-breaker
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  return {
    tenantId,
    events: sorted,
  };
}

export function addPaymentReceivedEvent(opts: {
  tenantId: string;
  amount: number; // positive amount paid
  date: string;   // ISO string, e.g. "2025-12-03"
  description?: string;
}): TenantLedgerEvent {
  const { tenantId, amount, date, description } = opts;

  const existing = ledgerStore[tenantId] ?? [];
  const lastBalance =
    existing.length > 0 ? existing[existing.length - 1].balanceAfter : 0;

  // In your sample data, payments are recorded as NEGATIVE amounts
  const signedAmount = -Math.abs(amount);
  const balanceAfter = lastBalance + signedAmount;

  const event: TenantLedgerEvent = {
    id: getNextId("payment"),
    tenantId,
    type: "PaymentReceived",
    amount: signedAmount,
    date,
    description: description ?? "Payment received",
    balanceAfter,
  };

  ledgerStore[tenantId] = [...existing, event];

  console.log("[Ledger] Appended payment event:", event);

  return event;
}

/**
 * Build a unified tenant ledger. If event-based ledger is empty, fall back to payments.
 */
export async function getTenantLedger(
  tenantId: string
): Promise<TenantLedgerEntry[]> {
  const { listEventsForTenant, toLedgerEntries } = await import(
    "./ledgerEventsService"
  );
  const ledgerEvents = listEventsForTenant(tenantId);
  if (ledgerEvents.length > 0) {
    return toLedgerEntries(ledgerEvents);
  }

  // Start with any existing event-based ledger entries
  const eventLedger = getLedgerForTenant(tenantId).events ?? [];

  let entries: TenantLedgerEntry[] = eventLedger.map((evt) => ({
    id: evt.id,
    tenantId: evt.tenantId,
    date: evt.date,
    type: evt.type,
    amount: evt.amount,
    direction: evt.amount < 0 ? "credit" : "debit",
    method: null,
    label: evt.description,
    notes: evt.description,
  }));

  if (!entries || entries.length === 0) {
    // Fallback: synthesize ledger entries from payments
    // Lazy import to avoid circular deps
    const { getPaymentsForTenant } = await import("./paymentsService");
    const payments = await getPaymentsForTenant(tenantId);

    entries = payments.map((p) => ({
      id: `payment-${p.id}`,
      tenantId: p.tenantId ?? tenantId,
      date: p.paidAt ?? null,
      type: "payment",
      amount: p.amount,
      direction: "credit",
      method: p.method ?? null,
      label: "Rent payment received",
      notes: p.notes ?? null,
    }));
  }

  // Sort newest first by date if present
  entries.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return entries;
}
