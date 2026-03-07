import { apiFetch } from "./apiFetch";

export const EXPENSE_CATEGORIES = [
  "Repairs",
  "Maintenance",
  "Utilities",
  "Cleaning",
  "Supplies",
  "Landscaping",
  "Insurance",
  "Taxes",
  "Administration",
  "Contractor Labor",
  "Materials",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseStatus = "recorded" | "reimbursable" | "paid";
export type ExpenseSource = "manual" | "work_order" | "imported";

export type ExpenseRecord = {
  id: string;
  landlordId: string;
  propertyId: string;
  unitId: string | null;
  category: ExpenseCategory;
  vendorName: string;
  amountCents: number;
  incurredAtMs: number;
  notes: string;
  status: ExpenseStatus;
  source: ExpenseSource;
  linkedWorkOrderId: string | null;
  receiptFileUrl: string | null;
  createdAtMs: number;
  updatedAtMs: number;
};

export type CreateExpenseInput = {
  propertyId: string;
  unitId?: string | null;
  category: ExpenseCategory;
  vendorName?: string;
  amountCents: number;
  incurredAtMs: number;
  notes?: string;
  status?: ExpenseStatus;
  source?: ExpenseSource;
  linkedWorkOrderId?: string | null;
  receiptFileUrl?: string | null;
};

export type ListExpensesFilters = {
  propertyId?: string;
  unitId?: string;
  category?: ExpenseCategory;
  dateFrom?: string | number;
  dateTo?: string | number;
  limit?: number;
};

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseRecord> {
  const res = await apiFetch<{ ok: boolean; item: ExpenseRecord }>("/expenses", {
    method: "POST",
    body: input,
  });
  if (!res?.ok || !res.item) throw new Error("Failed to create expense");
  return res.item;
}

export async function listExpenses(filters?: ListExpensesFilters): Promise<ExpenseRecord[]> {
  const qs = new URLSearchParams();
  if (filters?.propertyId) qs.set("propertyId", filters.propertyId);
  if (filters?.unitId) qs.set("unitId", filters.unitId);
  if (filters?.category) qs.set("category", filters.category);
  if (filters?.dateFrom != null) qs.set("dateFrom", String(filters.dateFrom));
  if (filters?.dateTo != null) qs.set("dateTo", String(filters.dateTo));
  if (filters?.limit != null) qs.set("limit", String(filters.limit));
  const path = qs.size > 0 ? `/expenses?${qs.toString()}` : "/expenses";
  const res = await apiFetch<{ ok: boolean; items: ExpenseRecord[] }>(path, {
    method: "GET",
  });
  return Array.isArray(res?.items) ? res.items : [];
}

export async function updateExpense(expenseId: string, patch: Partial<CreateExpenseInput>) {
  const safeId = encodeURIComponent(String(expenseId || "").trim());
  const res = await apiFetch<{ ok: boolean; item: ExpenseRecord }>(`/expenses/${safeId}`, {
    method: "PATCH",
    body: patch,
  });
  if (!res?.ok || !res.item) throw new Error("Failed to update expense");
  return res.item;
}
