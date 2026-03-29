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
};

export type ExpenseImportPreviewSummary = {
  parsed: number;
  lowConfidence: number;
  unresolvedProperty: number;
  unresolvedUnit: number;
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

export type ExpenseImportConfirmRow = ExpenseImportPreviewRow & {
  include?: boolean;
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
