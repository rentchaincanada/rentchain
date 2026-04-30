import { db } from "../config/firebase";

export type FinancialProjectionSourceType =
  | "recorded_payment"
  | "lease_charge"
  | "lease_credit"
  | "ledger_payment_unmatched";

export type FinancialProjectionDirection = "credit" | "debit";

export type FinancialProjectionRow = {
  id: string;
  sourceType: FinancialProjectionSourceType;
  sourceId: string;
  leaseId: string | null;
  tenantId: string | null;
  propertyId: string | null;
  unitId: string | null;
  propertyLabel: string | null;
  unitLabel: string | null;
  amount: number;
  direction: FinancialProjectionDirection;
  occurredAt: string;
  displayLabel: string;
  sourceBadge: string;
};

export type FinancialProjectionQuery = {
  landlordId: string;
  tenantId?: string | null;
  leaseId?: string | null;
  propertyId?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number | null;
};

export type FinancialProjectionResult = {
  rows: FinancialProjectionRow[];
  counts: Record<FinancialProjectionSourceType, number>;
};

type NormalizedPayment = {
  id: string;
  tenantId: string | null;
  propertyId: string | null;
  amount: number;
  paidAt: string | null;
  method: string | null;
  notes: string | null;
};

type NormalizedLedgerEntry = {
  id: string;
  leaseId: string | null;
  landlordId: string | null;
  propertyId: string | null;
  unitId: string | null;
  entryType: string | null;
  category: string | null;
  amountCents: number;
  effectiveDate: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAtMillis: number;
};

type LeaseContext = {
  id: string;
  tenantId: string | null;
  propertyId: string | null;
  unitId: string | null;
  propertyLabel: string | null;
  unitLabel: string | null;
};

type PropertyContext = {
  id: string;
  label: string | null;
  hiddenFromActiveLists: boolean;
  archived: boolean;
};

type UnitContext = {
  id: string;
  propertyId: string | null;
  label: string | null;
  unitNumber: string | null;
};

function asTrimmedString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function toMillis(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof (value as any)?.toMillis === "function") {
    try {
      const millis = Number((value as any).toMillis());
      return Number.isFinite(millis) ? millis : 0;
    } catch {
      return 0;
    }
  }
  if (typeof (value as any)?.seconds === "number") {
    return Number((value as any).seconds) * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoString(value: unknown): string | null {
  const millis = toMillis(value);
  if (!millis) {
    const trimmed = asTrimmedString(value);
    return trimmed || null;
  }
  return new Date(millis).toISOString();
}

function toDateOnly(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const iso = toIsoString(value);
  return iso ? iso.slice(0, 10) : null;
}

function toAmount(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildPropertyLabel(raw: Record<string, unknown> | null | undefined): string | null {
  return (
    asTrimmedString(raw?.name) ||
    asTrimmedString(raw?.addressLine1) ||
    asTrimmedString(raw?.address) ||
    null
  );
}

function buildUnitLabel(raw: Record<string, unknown> | null | undefined): string | null {
  return (
    asTrimmedString(raw?.label) ||
    asTrimmedString(raw?.displayLabel) ||
    asTrimmedString(raw?.unitNumber) ||
    asTrimmedString(raw?.unitLabel) ||
    asTrimmedString(raw?.unit) ||
    asTrimmedString(raw?.name) ||
    null
  );
}

function sourceBadgeFor(type: FinancialProjectionSourceType): string {
  switch (type) {
    case "recorded_payment":
      return "Recorded payment";
    case "lease_charge":
      return "Lease charge";
    case "lease_credit":
      return "Lease credit";
    case "ledger_payment_unmatched":
      return "Lease ledger payment";
    default:
      return "Financial item";
  }
}

function displayLabelForPayment(payment: NormalizedPayment): string {
  const method = asTrimmedString(payment.method);
  return method ? `Recorded payment (${method})` : "Recorded payment";
}

function displayLabelForLedger(entry: NormalizedLedgerEntry, type: FinancialProjectionSourceType): string {
  if (type === "ledger_payment_unmatched") {
    const method = asTrimmedString(entry.method);
    return method ? `Lease ledger payment (${method})` : "Lease ledger payment";
  }
  if (type === "lease_credit") {
    return "Lease credit";
  }
  const category = String(entry.category || "").trim().toLowerCase();
  if (category === "rent") return "Rent charge";
  if (category === "fee") return "Fee charge";
  if (category === "adjustment") return "Adjustment charge";
  return "Lease charge";
}

function normalizePayment(id: string, raw: any): NormalizedPayment {
  return {
    id,
    tenantId: asTrimmedString(raw?.tenantId),
    propertyId: asTrimmedString(raw?.propertyId),
    amount: toAmount(raw?.amount),
    paidAt: toIsoString(raw?.paidAt),
    method: asTrimmedString(raw?.method),
    notes: asTrimmedString(raw?.notes),
  };
}

function normalizeLedgerEntry(id: string, raw: any): NormalizedLedgerEntry {
  return {
    id,
    leaseId: asTrimmedString(raw?.leaseId),
    landlordId: asTrimmedString(raw?.landlordId),
    propertyId: asTrimmedString(raw?.propertyId),
    unitId: asTrimmedString(raw?.unitId),
    entryType: asTrimmedString(raw?.entryType),
    category: asTrimmedString(raw?.category),
    amountCents: Math.abs(Math.trunc(Number(raw?.amountCents || 0))),
    effectiveDate: toDateOnly(raw?.effectiveDate),
    method: asTrimmedString(raw?.method),
    reference: asTrimmedString(raw?.reference),
    notes: asTrimmedString(raw?.notes),
    createdAtMillis: toMillis(raw?.createdAt),
  };
}

function normalizeLeaseContext(id: string, raw: any): LeaseContext {
  return {
    id,
    tenantId: asTrimmedString(raw?.tenantId),
    propertyId: asTrimmedString(raw?.propertyId),
    unitId:
      asTrimmedString(raw?.unitId) ||
      asTrimmedString(raw?.unitNumber) ||
      asTrimmedString(raw?.unitLabel) ||
      asTrimmedString(raw?.unit),
    propertyLabel:
      asTrimmedString(raw?.propertyName) ||
      asTrimmedString(raw?.propertyLabel) ||
      null,
    unitLabel:
      asTrimmedString(raw?.unitLabel) ||
      asTrimmedString(raw?.unitNumber) ||
      asTrimmedString(raw?.unit) ||
      null,
  };
}

async function loadPayments(): Promise<NormalizedPayment[]> {
  const snap = await db.collection("payments").orderBy("paidAt", "desc").limit(500).get();
  return snap.docs.map((doc: any) => normalizePayment(doc.id, doc.data() as any));
}

async function loadLedgerEntries(landlordId: string): Promise<NormalizedLedgerEntry[]> {
  const snap = await db.collection("ledgerEntries").where("landlordId", "==", landlordId).get();
  return snap.docs.map((doc: any) => normalizeLedgerEntry(doc.id, doc.data() as any));
}

async function loadLeaseContexts(leaseIds: string[]): Promise<Map<string, LeaseContext>> {
  const uniqueIds = Array.from(new Set(leaseIds.map((value) => String(value || "").trim()).filter(Boolean)));
  const results = await Promise.all(
    uniqueIds.map(async (leaseId) => {
      const snap = await db.collection("leases").doc(leaseId).get();
      if (!snap.exists) return null;
      return [leaseId, normalizeLeaseContext(snap.id, snap.data() as any)] as const;
    })
  );
  return new Map(results.filter(Boolean) as Array<readonly [string, LeaseContext]>);
}

async function loadPropertyContexts(propertyIds: string[]): Promise<Map<string, PropertyContext>> {
  const uniqueIds = Array.from(new Set(propertyIds.map((value) => String(value || "").trim()).filter(Boolean)));
  const results = await Promise.all(
    uniqueIds.map(async (propertyId) => {
      const snap = await db.collection("properties").doc(propertyId).get();
      if (!snap.exists) return null;
      const raw = (snap.data() || {}) as Record<string, unknown>;
      return [
        propertyId,
        {
          id: propertyId,
          label: buildPropertyLabel(raw),
          hiddenFromActiveLists: raw.hiddenFromActiveLists === true,
          archived: String(raw.portfolioStatus || "").trim().toLowerCase() === "archived",
        } satisfies PropertyContext,
      ] as const;
    })
  );
  return new Map(results.filter(Boolean) as Array<readonly [string, PropertyContext]>);
}

async function loadUnitContexts(unitIds: string[]): Promise<Map<string, UnitContext>> {
  const uniqueIds = Array.from(new Set(unitIds.map((value) => String(value || "").trim()).filter(Boolean)));
  const results = await Promise.all(
    uniqueIds.map(async (unitId) => {
      const snap = await db.collection("units").doc(unitId).get();
      if (!snap.exists) return null;
      const raw = (snap.data() || {}) as Record<string, unknown>;
      return [
        unitId,
        {
          id: unitId,
          propertyId: asTrimmedString(raw.propertyId),
          label: buildUnitLabel(raw),
          unitNumber: asTrimmedString(raw.unitNumber ?? raw.unit ?? raw.name),
        } satisfies UnitContext,
      ] as const;
    })
  );
  return new Map(results.filter(Boolean) as Array<readonly [string, UnitContext]>);
}

function buildDateWindow(query: FinancialProjectionQuery) {
  const from = toDateOnly(query.from);
  const to = toDateOnly(query.to);
  return { from, to };
}

function isWithinDateWindow(date: string | null, range: { from: string | null; to: string | null }): boolean {
  if (!date) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function resolveRowLabels(input: {
  propertyId: string | null;
  unitId: string | null;
  lease: LeaseContext | null;
  properties: Map<string, PropertyContext>;
  units: Map<string, UnitContext>;
}): { propertyLabel: string | null; unitLabel: string | null } {
  const unit = input.unitId ? input.units.get(input.unitId) || null : null;
  const property =
    (input.propertyId ? input.properties.get(input.propertyId) || null : null) ||
    (unit?.propertyId ? input.properties.get(unit.propertyId) || null : null) ||
    null;
  return {
    propertyLabel: property?.label || input.lease?.propertyLabel || null,
    unitLabel: unit?.label || input.lease?.unitLabel || null,
  };
}

function determineLedgerProjectionType(entry: NormalizedLedgerEntry): FinancialProjectionSourceType {
  if (String(entry.entryType || "").trim().toLowerCase() === "payment") {
    return "ledger_payment_unmatched";
  }
  const category = String(entry.category || "").trim().toLowerCase();
  if (category === "credit") return "lease_credit";
  return "lease_charge";
}

function buildPaymentMatchKey(input: {
  tenantId: string | null;
  propertyId: string | null;
  amount: number;
  occurredAt: string | null;
}): string | null {
  const tenantId = asTrimmedString(input.tenantId);
  const occurredAt = toDateOnly(input.occurredAt);
  if (!tenantId || !occurredAt || !(input.amount > 0)) return null;
  const propertyId = asTrimmedString(input.propertyId) || "";
  return `${tenantId}__${propertyId}__${input.amount.toFixed(2)}__${occurredAt}`;
}

function compareProjectionRows(a: FinancialProjectionRow, b: FinancialProjectionRow): number {
  const dateDiff = String(b.occurredAt || "").localeCompare(String(a.occurredAt || ""));
  if (dateDiff !== 0) return dateDiff;
  const order = {
    recorded_payment: 0,
    ledger_payment_unmatched: 1,
    lease_credit: 2,
    lease_charge: 3,
  } satisfies Record<FinancialProjectionSourceType, number>;
  const typeDiff = order[a.sourceType] - order[b.sourceType];
  if (typeDiff !== 0) return typeDiff;
  return a.sourceId.localeCompare(b.sourceId);
}

export async function deriveFinancialProjectionRows(
  query: FinancialProjectionQuery
): Promise<FinancialProjectionResult> {
  const landlordId = String(query.landlordId || "").trim();
  if (!landlordId) {
    return {
      rows: [],
      counts: {
        recorded_payment: 0,
        lease_charge: 0,
        lease_credit: 0,
        ledger_payment_unmatched: 0,
      },
    };
  }

  const range = buildDateWindow(query);
  const [payments, ledgerEntries] = await Promise.all([
    loadPayments(),
    loadLedgerEntries(landlordId),
  ]);

  const relevantLeaseIds = ledgerEntries.map((entry) => entry.leaseId).filter(Boolean) as string[];
  const leaseContexts = await loadLeaseContexts(relevantLeaseIds);
  const propertyIds = new Set<string>();
  const unitIds = new Set<string>();

  for (const lease of leaseContexts.values()) {
    if (lease.propertyId) propertyIds.add(lease.propertyId);
    if (lease.unitId) unitIds.add(lease.unitId);
  }
  for (const entry of ledgerEntries) {
    if (entry.propertyId) propertyIds.add(entry.propertyId);
    if (entry.unitId) unitIds.add(entry.unitId);
  }
  for (const payment of payments) {
    if (payment.propertyId) propertyIds.add(payment.propertyId);
  }

  const [propertyContexts, unitContexts] = await Promise.all([
    loadPropertyContexts(Array.from(propertyIds)),
    loadUnitContexts(Array.from(unitIds)),
  ]);

  const matchedPaymentKeys = new Map<string, number>();
  for (const payment of payments) {
    const key = buildPaymentMatchKey({
      tenantId: payment.tenantId,
      propertyId: payment.propertyId,
      amount: payment.amount,
      occurredAt: payment.paidAt,
    });
    if (!key) continue;
    matchedPaymentKeys.set(key, (matchedPaymentKeys.get(key) || 0) + 1);
  }

  const rows: FinancialProjectionRow[] = [];

  for (const payment of payments) {
    const occurredAt = toDateOnly(payment.paidAt);
    if (!isWithinDateWindow(occurredAt, range)) continue;

    const property = payment.propertyId ? propertyContexts.get(payment.propertyId) || null : null;
    if (query.tenantId && String(query.tenantId).trim() !== String(payment.tenantId || "").trim()) continue;
    if (query.propertyId && String(query.propertyId).trim() !== String(payment.propertyId || "").trim()) continue;
    if (query.leaseId) continue;
    if (property?.archived || property?.hiddenFromActiveLists) continue;

    rows.push({
      id: `recorded_payment:${payment.id}`,
      sourceType: "recorded_payment",
      sourceId: payment.id,
      leaseId: null,
      tenantId: payment.tenantId,
      propertyId: payment.propertyId,
      unitId: null,
      propertyLabel: property?.label || null,
      unitLabel: null,
      amount: payment.amount,
      direction: "credit",
      occurredAt: occurredAt || "0000-00-00",
      displayLabel: displayLabelForPayment(payment),
      sourceBadge: sourceBadgeFor("recorded_payment"),
    });
  }

  for (const entry of ledgerEntries) {
    const lease = entry.leaseId ? leaseContexts.get(entry.leaseId) || null : null;
    const resolvedPropertyId = entry.propertyId || lease?.propertyId || null;
    const resolvedUnitId = entry.unitId || lease?.unitId || null;
    const resolvedTenantId = lease?.tenantId || null;
    const occurredAt = entry.effectiveDate;
    if (!isWithinDateWindow(occurredAt, range)) continue;
    if (query.leaseId && String(query.leaseId).trim() !== String(entry.leaseId || "").trim()) continue;
    if (query.tenantId && String(query.tenantId).trim() !== String(resolvedTenantId || "").trim()) continue;
    if (query.propertyId && String(query.propertyId).trim() !== String(resolvedPropertyId || "").trim()) continue;

    const property = resolvedPropertyId ? propertyContexts.get(resolvedPropertyId) || null : null;
    if (property?.archived || property?.hiddenFromActiveLists) continue;

    const projectionType = determineLedgerProjectionType(entry);
    if (projectionType === "ledger_payment_unmatched") {
      const paymentMatchKey = buildPaymentMatchKey({
        tenantId: resolvedTenantId,
        propertyId: resolvedPropertyId,
        amount: Math.abs(entry.amountCents) / 100,
        occurredAt,
      });
      if (paymentMatchKey && matchedPaymentKeys.get(paymentMatchKey) === 1) {
        continue;
      }
    }

    const labels = resolveRowLabels({
      propertyId: resolvedPropertyId,
      unitId: resolvedUnitId,
      lease,
      properties: propertyContexts,
      units: unitContexts,
    });
    const direction: FinancialProjectionDirection =
      projectionType === "lease_charge" ? "debit" : "credit";

    rows.push({
      id: `${projectionType}:${entry.id}`,
      sourceType: projectionType,
      sourceId: entry.id,
      leaseId: entry.leaseId,
      tenantId: resolvedTenantId,
      propertyId: resolvedPropertyId,
      unitId: resolvedUnitId,
      propertyLabel: labels.propertyLabel,
      unitLabel: labels.unitLabel,
      amount: Math.abs(entry.amountCents) / 100,
      direction,
      occurredAt: occurredAt || "0000-00-00",
      displayLabel: displayLabelForLedger(entry, projectionType),
      sourceBadge: sourceBadgeFor(projectionType),
    });
  }

  rows.sort(compareProjectionRows);
  const limitedRows =
    typeof query.limit === "number" && Number.isFinite(query.limit) && query.limit > 0
      ? rows.slice(0, query.limit)
      : rows;

  const counts: Record<FinancialProjectionSourceType, number> = {
    recorded_payment: 0,
    lease_charge: 0,
    lease_credit: 0,
    ledger_payment_unmatched: 0,
  };
  for (const row of limitedRows) {
    counts[row.sourceType] += 1;
  }

  return { rows: limitedRows, counts };
}
