import { db } from "../config/firebase";

export const FINANCIAL_TRANSACTION_TYPES = [
  "maintenance_cost_recorded",
  "maintenance_cost_linked_to_expense",
  "screening_fee_charged",
  "screening_cost_incurred",
  "platform_fee_recognized",
  "payment_initiated",
  "payment_succeeded",
  "payment_failed",
] as const;

export const FINANCIAL_TRANSACTION_STATUSES = ["pending", "recorded", "linked", "completed", "failed"] as const;

export type FinancialTransactionType = (typeof FINANCIAL_TRANSACTION_TYPES)[number];
export type FinancialTransactionStatus = (typeof FINANCIAL_TRANSACTION_STATUSES)[number];

export type FinancialTransaction = {
  id: string;
  landlordId: string;
  propertyId?: string;
  unitId?: string;
  maintenanceRequestId?: string;
  workOrderId?: string;
  type: FinancialTransactionType;
  amountCents: number;
  currency: string;
  status: FinancialTransactionStatus;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt?: number;
};

type CreateFinancialTransactionInput = Omit<FinancialTransaction, "id" | "createdAt" | "updatedAt"> & {
  createdAt?: number;
  updatedAt?: number;
};

function nowMs() {
  return Date.now();
}

function asString(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 2000): string | undefined {
  const next = asString(value, max);
  return next || undefined;
}

function asOptionalMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function normalizeTransactionType(value: unknown): FinancialTransactionType {
  const next = asString(value, 80).toLowerCase();
  if ((FINANCIAL_TRANSACTION_TYPES as readonly string[]).includes(next)) {
    return next as FinancialTransactionType;
  }
  throw new Error("INVALID_FINANCIAL_TRANSACTION_TYPE");
}

function normalizeTransactionStatus(value: unknown): FinancialTransactionStatus {
  const next = asString(value, 40).toLowerCase();
  if ((FINANCIAL_TRANSACTION_STATUSES as readonly string[]).includes(next)) {
    return next as FinancialTransactionStatus;
  }
  throw new Error("INVALID_FINANCIAL_TRANSACTION_STATUS");
}

function normalizeAmountCents(value: unknown): number {
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next) || next <= 0) {
    throw new Error("INVALID_FINANCIAL_TRANSACTION_AMOUNT");
  }
  return Math.round(next);
}

function normalizeCurrency(value: unknown): string {
  const next = asString(value, 8).toUpperCase();
  if (!/^[A-Z]{3}$/.test(next)) {
    throw new Error("INVALID_FINANCIAL_TRANSACTION_CURRENCY");
  }
  return next;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  const next = typeof value === "number" ? Math.round(value) : Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function toFinancialTransaction(id: string, data: any): FinancialTransaction {
  return {
    id,
    landlordId: asString(data?.landlordId, 120),
    propertyId: asOptionalString(data?.propertyId, 120),
    unitId: asOptionalString(data?.unitId, 120),
    maintenanceRequestId: asOptionalString(data?.maintenanceRequestId, 120),
    workOrderId: asOptionalString(data?.workOrderId, 120),
    type: normalizeTransactionType(data?.type),
    amountCents: normalizeAmountCents(data?.amountCents),
    currency: normalizeCurrency(data?.currency),
    status: normalizeTransactionStatus(data?.status),
    metadata: asOptionalMetadata(data?.metadata),
    createdAt: normalizeTimestamp(data?.createdAt, 0),
    updatedAt: typeof data?.updatedAt === "number" ? Math.round(data.updatedAt) : undefined,
  };
}

export async function createTransaction(input: CreateFinancialTransactionInput): Promise<FinancialTransaction> {
  const createdAt = normalizeTimestamp(input.createdAt, nowMs());
  const updatedAt = normalizeTimestamp(input.updatedAt, createdAt);
  const ref = db.collection("financialTransactions").doc();
  const record: FinancialTransaction = {
    id: ref.id,
    landlordId: asString(input.landlordId, 120),
    propertyId: asOptionalString(input.propertyId, 120),
    unitId: asOptionalString(input.unitId, 120),
    maintenanceRequestId: asOptionalString(input.maintenanceRequestId, 120),
    workOrderId: asOptionalString(input.workOrderId, 120),
    type: normalizeTransactionType(input.type),
    amountCents: normalizeAmountCents(input.amountCents),
    currency: normalizeCurrency(input.currency),
    status: normalizeTransactionStatus(input.status),
    metadata: asOptionalMetadata(input.metadata),
    createdAt,
    updatedAt,
  };

  if (!record.landlordId) {
    throw new Error("FINANCIAL_TRANSACTION_LANDLORD_REQUIRED");
  }

  await ref.set(record);
  return record;
}

async function listTransactionsForLandlord(landlordId: string): Promise<FinancialTransaction[]> {
  const scope = asString(landlordId, 120);
  if (!scope) throw new Error("FINANCIAL_TRANSACTION_LANDLORD_REQUIRED");
  const snap = await db.collection("financialTransactions").where("landlordId", "==", scope).get();
  return snap.docs
    .map((doc) => toFinancialTransaction(doc.id, doc.data()))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function getTransactionsByProperty(landlordId: string, propertyId: string): Promise<FinancialTransaction[]> {
  const scopedPropertyId = asString(propertyId, 120);
  if (!scopedPropertyId) return [];
  const items = await listTransactionsForLandlord(landlordId);
  return items.filter((item) => item.propertyId === scopedPropertyId);
}

export async function getTransactionsByWorkOrder(landlordId: string, workOrderId: string): Promise<FinancialTransaction[]> {
  const scopedWorkOrderId = asString(workOrderId, 120);
  if (!scopedWorkOrderId) return [];
  const items = await listTransactionsForLandlord(landlordId);
  return items.filter((item) => item.workOrderId === scopedWorkOrderId);
}

export async function listFinancialTransactions(filters: {
  landlordId: string;
  propertyId?: string | null;
  workOrderId?: string | null;
}): Promise<FinancialTransaction[]> {
  const landlordId = asString(filters.landlordId, 120);
  const propertyId = asOptionalString(filters.propertyId, 120);
  const workOrderId = asOptionalString(filters.workOrderId, 120);

  if (!landlordId) throw new Error("FINANCIAL_TRANSACTION_LANDLORD_REQUIRED");

  let items = await listTransactionsForLandlord(landlordId);
  if (propertyId) items = items.filter((item) => item.propertyId === propertyId);
  if (workOrderId) items = items.filter((item) => item.workOrderId === workOrderId);
  return items;
}
