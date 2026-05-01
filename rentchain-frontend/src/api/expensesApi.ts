import { apiFetch } from "./apiFetch";
import { downloadAuthenticatedExport } from "./exportDownload";

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
  includeArchivedProperties?: boolean;
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
  if (filters?.includeArchivedProperties) qs.set("includeArchivedProperties", "1");
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

export async function deleteExpense(expenseId: string) {
  const safeId = encodeURIComponent(String(expenseId || "").trim());
  const res = await apiFetch<{ ok: boolean }>(`/expenses/${safeId}`, {
    method: "DELETE",
  });
  if (!res?.ok) throw new Error("Failed to delete expense");
  return true;
}

export async function importExpensesCsv(input: {
  csvText: string;
  defaultPropertyId?: string | null;
}) {
  const res = await apiFetch<{
    ok: boolean;
    rowsImported: number;
    rowsSkipped: number;
    errors: string[];
  }>("/expenses/import/csv", {
    method: "POST",
    body: input,
  });
  if (!res?.ok) {
    throw new Error(String((res as any)?.message || (res as any)?.error || "Failed to import expenses"));
  }
  return res;
}

async function downloadExpenseExport(path: string) {
  return downloadAuthenticatedExport({
    path,
    fallbackFilename: "rentchain-expenses-export",
    errorMessage: "Failed to export expenses",
  });
}

export async function exportExpenses(format: "csv" | "xls" | "pdf", filters?: ListExpensesFilters) {
  const params = new URLSearchParams();
  if (filters?.propertyId) params.set("propertyId", filters.propertyId);
  if (filters?.unitId) params.set("unitId", filters.unitId);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.dateFrom != null) params.set("dateFrom", String(filters.dateFrom));
  if (filters?.dateTo != null) params.set("dateTo", String(filters.dateTo));
  if (filters?.includeArchivedProperties) params.set("includeArchivedProperties", "1");
  const path = `/expenses/export.${format}${params.toString() ? `?${params.toString()}` : ""}`;
  return downloadExpenseExport(path);
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
  candidateAmounts?: number[];
  rawCandidates?: Array<{
    amountCents: number;
    raw: string;
    context: string;
    confidenceTag: "total" | "amount_due" | "balance_due" | "subtotal" | "generic";
  }>;
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

export type ExpenseImportPreviewRow = {
  rowId: string;
  date: string | null;
  property: string | null;
  propertyId: string | null;
  unit: string | null;
  unitId: string | null;
  category: string | null;
  vendor: string | null;
  description: string | null;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  sourceFileName: string;
  confidence: number | null;
  warnings: string[];
  warningCodes: string[];
  duplicateStatus: "none" | "possible_duplicate" | "likely_duplicate";
  duplicateReason?: string | null;
  duplicateMatches?: Array<{
    expenseId?: string | null;
    source: "existing" | "batch";
    date?: string | null;
    vendor?: string | null;
    description?: string | null;
    amount?: number | null;
    property?: string | null;
  }>;
  lowConfidence?: boolean;
  include?: boolean;
};

export type ExpenseImportPreviewSummary = {
  parsed: number;
  lowConfidence: number;
  unresolvedProperty: number;
  unresolvedUnit: number;
  duplicateCount: number;
  likelyDuplicateCount: number;
};

export type ExpenseImportPreviewResponse = {
  ok: true;
  files: Array<{
    name: string;
    type: string;
    rowsParsed: number;
  }>;
  rows: ExpenseImportPreviewRow[];
  summary: ExpenseImportPreviewSummary;
};

export async function previewExpenseImport(input: {
  files: File[];
  defaultPropertyId?: string | null;
}) {
  const form = new FormData();
  for (const file of input.files) {
    form.append("files", file);
  }
  if (input.defaultPropertyId) {
    form.append("defaultPropertyId", input.defaultPropertyId);
  }

  const res = await apiFetch<ExpenseImportPreviewResponse>("/expenses/import/preview", {
    method: "POST",
    body: form,
  });
  if (!res?.ok) {
    throw new Error("Failed to preview imported expenses");
  }
  return res;
}

export type ConfirmExpenseImportResponse = {
  ok: true;
  imported: number;
  skipped: number;
  duplicateImported: number;
  errors: string[];
};

export async function confirmExpenseImportRows(input: {
  rows: ExpenseImportPreviewRow[];
}) {
  const res = await apiFetch<ConfirmExpenseImportResponse>("/expenses/import/confirm", {
    method: "POST",
    body: input,
  });
  if (!res?.ok) {
    throw new Error("Failed to confirm expense import");
  }
  return res;
}
