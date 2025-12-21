import { v4 as uuid } from "uuid";
import { TenantLedgerEntry } from "./tenantLedgerService";

export type LedgerEventType =
  | "payment_created"
  | "payment_updated"
  | "payment_deleted"
  | "screening_credit_used"
  | "charge_created";

export interface LedgerEvent {
  id: string;
  landlordId?: string;
  tenantId: string;
  type: LedgerEventType;
  amountDelta: number; // positive reduces balance owed, negative increases
  occurredAt: string;
  reference?: {
    kind: string;
    id: string;
  };
  method?: string | null;
  notes?: string | null;
}

const LEDGER_EVENTS: LedgerEvent[] = [];

function sortDesc(events: LedgerEvent[]): LedgerEvent[] {
  return [...events].sort((a, b) => {
    const da = Date.parse(a.occurredAt) || 0;
    const db = Date.parse(b.occurredAt) || 0;
    return db - da;
  });
}

export interface LedgerEventCreateInput {
  landlordId?: string;
  tenantId: string;
  type: LedgerEventType;
  amountDelta: number;
  occurredAt?: string;
  reference?: {
    kind: string;
    id: string;
  };
  method?: string | null;
  notes?: string | null;
}

export function createLedgerEvent(
  input: LedgerEventCreateInput
): LedgerEvent {
  const event: LedgerEvent = {
    id: uuid(),
    landlordId: input.landlordId,
    tenantId: input.tenantId,
    type: input.type,
    amountDelta: input.amountDelta,
    occurredAt: input.occurredAt || new Date().toISOString(),
    reference: input.reference,
    method: input.method ?? null,
    notes: input.notes ?? null,
  };
  LEDGER_EVENTS.push(event);
  return event;
}

export function recordPaymentEvent(options: {
  landlordId?: string;
  type: Extract<
    LedgerEventType,
    "payment_created" | "payment_updated" | "payment_deleted"
  >;
  tenantId: string;
  amountDelta: number;
  referenceId?: string;
  method?: string | null;
  notes?: string | null;
}): LedgerEvent {
  return createLedgerEvent({
    landlordId: options.landlordId,
    tenantId: options.tenantId,
    type: options.type,
    amountDelta: options.amountDelta,
    reference: options.referenceId
      ? { kind: "payment", id: options.referenceId }
      : undefined,
    method: options.method,
    notes: options.notes,
  });
}

export function listEventsForTenant(tenantId: string): LedgerEvent[] {
  return sortDesc(LEDGER_EVENTS.filter((e) => e.tenantId === tenantId));
}

export function listAllEvents(): LedgerEvent[] {
  return sortDesc(LEDGER_EVENTS);
}

export function getLedgerEventsByTenant(
  landlordId: string | undefined,
  tenantId: string
): LedgerEvent[] {
  return sortDesc(
    LEDGER_EVENTS.filter(
      (e) => e.tenantId === tenantId && (!landlordId || e.landlordId === landlordId)
    )
  );
}

export function getLedgerSummaryForTenant(tenantId: string): {
  currentBalance: number;
  lastPaymentDate: string | null;
  entryCount: number;
} {
  const events = listEventsForTenant(tenantId);
  let balance = 0;
  let lastPaymentDate: string | null = null;

  events
    .slice()
    .sort((a, b) => {
      const da = Date.parse(a.occurredAt) || 0;
      const db = Date.parse(b.occurredAt) || 0;
      return da - db;
    })
    .forEach((event) => {
      // Balance rule: balance = -SUM(amountDelta)
      balance -= event.amountDelta;
      if (!lastPaymentDate) {
        lastPaymentDate = event.occurredAt;
      } else {
        const current = Date.parse(lastPaymentDate) || 0;
        const candidate = Date.parse(event.occurredAt) || 0;
        if (candidate > current) {
          lastPaymentDate = event.occurredAt;
        }
      }
    });

  return {
    currentBalance: balance,
    lastPaymentDate,
    entryCount: events.length,
  };
}

export function toLedgerEntries(events: LedgerEvent[]): TenantLedgerEntry[] {
  const sortedAsc = [...events].sort((a, b) => {
    const da = Date.parse(a.occurredAt) || 0;
    const db = Date.parse(b.occurredAt) || 0;
    return da - db;
  });

  let balance = 0;
  const entries = sortedAsc.map((event) => {
    balance -= event.amountDelta;
    const isPayment = event.amountDelta > 0;
    return {
      id: event.id,
      tenantId: event.tenantId,
      type: isPayment ? "payment" : "charge",
      amount: Math.abs(event.amountDelta),
      date: event.occurredAt,
      method: event.method ?? undefined,
      notes: event.notes ?? undefined,
      direction: isPayment ? "credit" : "debit",
      label: event.type.replace("_", " "),
      runningBalance: balance,
      referenceId: event.reference?.id,
    } as TenantLedgerEntry;
  });

  return entries.sort((a, b) => {
    const da = Date.parse(a.date) || 0;
    const db = Date.parse(b.date) || 0;
    return db - da;
  });
}
