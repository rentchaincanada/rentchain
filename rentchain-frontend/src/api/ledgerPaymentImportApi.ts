import { apiFetch } from "./apiFetch";

export type PaymentImportConfidence = "high" | "medium" | "low" | "invalid";
export type PaymentImportMatchStatus = "matched" | "unmatched" | "ambiguous" | "invalid";

export type PaymentImportPreviewRow = {
  rowId: string;
  sourceRowNumber: number;
  sourceFileName: string;
  tenantName: string | null;
  tenantEmail: string | null;
  property: string | null;
  unit: string | null;
  amountCents: number | null;
  amountDisplay: string | null;
  paymentDate: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  matchStatus: PaymentImportMatchStatus;
  confidence: PaymentImportConfidence;
  preselected: boolean;
  warning: string | null;
  reason: string;
  matchBasis?: string[];
  matchedTenantId: string | null;
  matchedTenantName: string | null;
  leaseId: string | null;
  propertyId: string | null;
  propertyLabel: string | null;
  unitId: string | null;
  unitLabel: string | null;
  duplicateInFile: boolean;
  rowFingerprint: string;
};

export type PaymentImportPreviewResponse = {
  ok: true;
  importBatchId: string;
  filename: string;
  notices?: {
    ignoredColumns: boolean;
    sensitiveColumnsOmitted: boolean;
    messages: string[];
  };
  summary: {
    totalRows: number;
    totalPaymentAmountCents: number;
    totalPaymentAmountDisplay: string;
    matchedRows: number;
    highConfidenceRows: number;
    mediumConfidenceRows: number;
    lowConfidenceRows: number;
    unmatchedRows: number;
    ambiguousRows: number;
    invalidRows: number;
    preselectedRows: number;
    duplicateRows: number;
    groupedByProperty: Array<{
      propertyLabel: string;
      rowCount: number;
      amountCents: number;
      amountDisplay: string;
    }>;
  };
  rows: PaymentImportPreviewRow[];
};

export type PaymentImportConfirmResultRow = {
  rowId: string;
  rowFingerprint: string;
  status: "imported" | "duplicate" | "failed";
  reason: string;
  paymentDocumentId: string | null;
  ledgerEntryId: string | null;
};

export type PaymentImportConfirmResponse = {
  ok: true;
  importBatchId: string;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  results: PaymentImportConfirmResultRow[];
  warnings: string[];
};

export async function previewLedgerPaymentCsvImport(file: File): Promise<PaymentImportPreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch<PaymentImportPreviewResponse>("/ledger/imports/payment-csv/preview", {
    method: "POST",
    body: form,
  });
  if (!res?.ok) throw new Error("Failed to preview payment import");
  return res;
}

export async function confirmLedgerPaymentCsvImport(input: {
  importBatchId: string;
  selectedRowIds: string[];
}): Promise<PaymentImportConfirmResponse> {
  const res = await apiFetch<PaymentImportConfirmResponse>("/ledger/imports/payment-csv/confirm", {
    method: "POST",
    body: JSON.stringify({
      importBatchId: input.importBatchId,
      selectedRowIds: input.selectedRowIds,
      clientConfirmedAt: new Date().toISOString(),
    }),
    headers: { "Content-Type": "application/json" },
  });
  if (!res?.ok) throw new Error("Failed to import selected payments");
  return res;
}
