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
  sourceDocumentUrl: string | null;
  sourceDocumentName: string | null;
  sourceDocumentMimeType: string | null;
  aiSummary: string | null;
  aiExtractedFields: Record<string, any> | null;
  aiProcessedAtMs: number | null;
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
  sourceDocumentUrl?: string | null;
  sourceDocumentName?: string | null;
  sourceDocumentMimeType?: string | null;
  aiSummary?: string | null;
  aiExtractedFields?: Record<string, any> | null;
  aiProcessedAtMs?: number | null;
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

export type UploadExpenseSourceDocumentResponse = {
  ok: true;
  uploadSessionId: string;
  sourceDocumentUrl: string;
  sourceDocumentName: string;
  sourceDocumentMimeType: string;
  sizeBytes: number;
};

export async function uploadExpenseSourceDocument(input: {
  propertyId: string;
  expenseId?: string;
  file: File;
}) {
  const form = new FormData();
  form.append("propertyId", input.propertyId);
  if (input.expenseId) form.append("expenseId", input.expenseId);
  form.append("file", input.file);

  const res = await apiFetch<UploadExpenseSourceDocumentResponse>("/expenses/source-document", {
    method: "POST",
    body: form,
  });
  if (!res?.ok || !res.uploadSessionId) {
    throw new Error("Failed to upload expense source document");
  }
  return res;
}

export type AnalyzeExpenseUploadResponse = {
  ok: true;
  summary: string;
  extractedFields: {
    vendorName?: string;
    amountCents?: number;
    incurredAtMs?: number;
    category?: string;
    description?: string;
  };
  lowConfidence?: boolean;
};

export async function analyzeExpenseUpload(input: {
  uploadSessionId?: string;
  sourceDocumentUrl?: string;
  sourceDocumentName?: string;
  sourceDocumentMimeType?: string;
  textPreview?: string;
}) {
  const res = await apiFetch<AnalyzeExpenseUploadResponse>("/expenses/analyze-upload", {
    method: "POST",
    body: input,
  });
  if (!res?.ok) throw new Error("Failed to analyze expense upload");
  return res;
}
