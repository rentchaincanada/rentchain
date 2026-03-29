export type ExpenseImportWarningCode =
  | "missing_date"
  | "missing_amount"
  | "missing_category"
  | "unresolved_property"
  | "unresolved_unit"
  | "weak_vendor_match"
  | "weak_description"
  | "possible_duplicate"
  | "likely_duplicate"
  | "ai_review_required"
  | "no_text_extracted";

export type ExpenseImportDuplicateMatch = {
  expenseId?: string | null;
  source: "existing" | "batch";
  date?: string | null;
  vendor?: string | null;
  description?: string | null;
  amount?: number | null;
  property?: string | null;
};

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
  warningCodes: ExpenseImportWarningCode[];
  duplicateStatus: "none" | "possible_duplicate" | "likely_duplicate";
  duplicateReason?: string | null;
  duplicateMatches?: ExpenseImportDuplicateMatch[];
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

export type ExpenseImportPreviewResult = {
  files: Array<{
    name: string;
    type: string;
    rowsParsed: number;
  }>;
  rows: ExpenseImportPreviewRow[];
  summary: ExpenseImportPreviewSummary;
};

export type ExpenseImportConfirmRow = ExpenseImportPreviewRow;

export type ExpenseExistingLookupRow = {
  expenseId?: string | null;
  date?: string | null;
  amount?: number | null;
  vendor?: string | null;
  description?: string | null;
  property?: string | null;
  propertyId?: string | null;
};

export type ExpensePropertyOption = {
  id: string;
  name: string;
};

export type ExpenseUnitOption = {
  id: string;
  propertyId: string;
  label: string;
};
