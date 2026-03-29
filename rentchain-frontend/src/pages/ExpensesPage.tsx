import React from "react";
import { Card, Button } from "../components/ui/Ui";
import { spacing, text, colors } from "../styles/tokens";
import {
  EXPENSE_CATEGORIES,
  confirmExpenseImportRows,
  exportExpenses,
  listExpenses,
  previewExpenseImport,
  type ExpenseCategory,
  type ExpenseImportPreviewRow,
  type ExpenseRecord,
} from "../api/expensesApi";
import { fetchProperties } from "../api/propertiesApi";
import { AddExpenseModal } from "../components/expenses/AddExpenseModal";
import { ExpenseImportReviewTable } from "../components/expenses/ExpenseImportReviewTable";
import { ExpenseImportSummaryCard } from "../components/expenses/ExpenseImportSummaryCard";
import { ExpenseImportUploadCard } from "../components/expenses/ExpenseImportUploadCard";
import { useCapabilities } from "../hooks/useCapabilities";

function formatCents(cents: number): string {
  const amount = Number(cents || 0) / 100;
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatDate(ms: number): string {
  if (!ms) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(
      new Date(ms)
    );
  } catch {
    return "-";
  }
}

function normalizePreviewRowForReview(row: ExpenseImportPreviewRow): ExpenseImportPreviewRow {
  const warningCodes = new Set<string>(row.warningCodes || []);
  const warnings = new Set<string>((row.warnings || []).filter(Boolean));

  if (!row.propertyId) {
    warningCodes.add("unresolved_property");
    warnings.add("Missing property match");
  }
  if (row.unit && !row.unitId) {
    warningCodes.add("unresolved_unit");
    warnings.add("Missing unit match");
  }
  if (!row.category) {
    warningCodes.add("missing_category");
    warnings.add("Missing category");
  }
  if (row.amount == null || Number.isNaN(Number(row.amount))) {
    warningCodes.add("missing_amount");
    warnings.add("Missing amount");
  }
  if (!row.date) {
    warningCodes.add("missing_date");
    warnings.add("Missing date");
  }
  if (!String(row.vendor || "").trim()) {
    warningCodes.add("weak_vendor_match");
    warnings.add("Vendor needs review");
  }
  if (!String(row.description || "").trim()) {
    warningCodes.add("weak_description");
    warnings.add("Description needs review");
  }
  if (row.duplicateStatus === "likely_duplicate") {
    warningCodes.add("likely_duplicate");
    if (row.duplicateReason) warnings.add(row.duplicateReason);
  } else if (row.duplicateStatus === "possible_duplicate") {
    warningCodes.add("possible_duplicate");
    if (row.duplicateReason) warnings.add(row.duplicateReason);
  }

  const lowConfidence =
    (row.confidence ?? 0) < 0.75 ||
    warningCodes.has("unresolved_property") ||
    warningCodes.has("missing_category") ||
    warningCodes.has("missing_amount") ||
    warningCodes.has("missing_date");

  return {
    ...row,
    warnings: Array.from(warnings),
    warningCodes: Array.from(warningCodes),
    lowConfidence,
  };
}

const ExpensesPage: React.FC = () => {
  const { caps, features, loading: capsLoading } = useCapabilities();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<ExpenseRecord[]>([]);
  const [properties, setProperties] = React.useState<Array<{ id: string; name: string; archived?: boolean }>>([]);
  const [showAdd, setShowAdd] = React.useState(false);
  const [propertyFilter, setPropertyFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const [exporting, setExporting] = React.useState<null | "csv" | "xlsx" | "pdf">(null);
  const [importFiles, setImportFiles] = React.useState<File[]>([]);
  const [previewRows, setPreviewRows] = React.useState<ExpenseImportPreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = React.useState<null | {
    parsed: number;
    lowConfidence: number;
    unresolvedProperty: number;
    unresolvedUnit: number;
    duplicateCount: number;
    likelyDuplicateCount: number;
  }>(null);
  const [importSummary, setImportSummary] = React.useState<null | {
    rowsImported: number;
    rowsSkipped: number;
    duplicateImported: number;
    errors: string[];
  }>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const proExpensesEnabled = features?.["expenses.import"] !== false && ["pro", "elite"].includes(String(caps?.plan || ""));

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expenseRows, propertyRes] = await Promise.all([
        listExpenses({
          propertyId: propertyFilter || undefined,
          category: (categoryFilter as ExpenseCategory) || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          includeArchivedProperties: true,
          limit: 300,
        }),
        fetchProperties({ includeArchived: true }),
      ]);
      const propertyItems = Array.isArray((propertyRes as any)?.items)
        ? (propertyRes as any).items
        : Array.isArray((propertyRes as any)?.properties)
        ? (propertyRes as any).properties
        : Array.isArray(propertyRes)
        ? propertyRes
        : [];

      setItems(expenseRows);
      setProperties(
        propertyItems
          .map((p: any) => ({
            id: String(p?.id || p?.propertyId || ""),
            name: String(p?.name || p?.addressLine1 || p?.address || "Property"),
            archived: String(p?.portfolioStatus || "").toLowerCase() === "archived",
          }))
          .filter((p: any) => p.id)
      );
    } catch (err: any) {
      setError(String(err?.message || "Failed to load expenses."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, dateFrom, dateTo, propertyFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener?.(update);
    return () => media.removeListener?.(update);
  }, []);

  const propertyById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of properties) map.set(p.id, p.archived ? `${p.name} (Archived)` : p.name);
    return map;
  }, [properties]);

  const totalAmountCents = React.useMemo(
    () => items.reduce((sum, item) => sum + Number(item.amountCents || 0), 0),
    [items]
  );

  const triggerDownload = async (format: "csv" | "xlsx" | "pdf") => {
    try {
      setExporting(format);
      const { blob, filename } = await exportExpenses(format, {
        propertyId: propertyFilter || undefined,
        category: (categoryFilter as ExpenseCategory) || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        includeArchivedProperties: true,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(String(err?.message || "Failed to export expenses."));
    } finally {
      setExporting(null);
    }
  };

  const handlePreviewImport = async () => {
    if (!importFiles.length) return;
    try {
      setImporting(true);
      setError(null);
      setImportSummary(null);
      const result = await previewExpenseImport({
        files: importFiles,
        defaultPropertyId: propertyFilter || undefined,
      });
      setPreviewRows((result.rows || []).map((row) => normalizePreviewRowForReview({ ...row, include: row.include !== false })));
      setPreviewSummary(result.summary || null);
    } catch (err: any) {
      setError(String(err?.message || "Failed to review imported expenses."));
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewRows.length) return;
    try {
      setImporting(true);
      setError(null);
      const result = await confirmExpenseImportRows({ rows: previewRows });
      setImportSummary({
        rowsImported: result.imported,
        rowsSkipped: result.skipped,
        duplicateImported: result.duplicateImported,
        errors: Array.isArray(result.errors) ? result.errors : [],
      });
      setImportFiles([]);
      setPreviewRows([]);
      setPreviewSummary(null);
      await load();
    } catch (err: any) {
      setError(String(err?.message || "Failed to confirm imported expenses."));
    } finally {
      setImporting(false);
    }
  };

  const handleChangePreviewRow = React.useCallback((rowId: string, patch: Partial<ExpenseImportPreviewRow>) => {
    setPreviewRows((current) =>
      current.map((row) => {
        if (row.rowId !== rowId) return row;
        return normalizePreviewRowForReview({ ...row, ...patch });
      })
    );
  }, []);

  React.useEffect(() => {
    if (!previewRows.length) return;
    setPreviewSummary({
      parsed: previewRows.length,
      lowConfidence: previewRows.filter((row) => row.lowConfidence || (row.confidence ?? 0) < 0.75).length,
      unresolvedProperty: previewRows.filter((row) => !row.propertyId).length,
      unresolvedUnit: previewRows.filter((row) => Boolean(row.unit) && !row.unitId).length,
      duplicateCount: previewRows.filter((row) => row.duplicateStatus !== "none").length,
      likelyDuplicateCount: previewRows.filter((row) => row.duplicateStatus === "likely_duplicate").length,
    });
  }, [previewRows]);

  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.md, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Expenses</div>
          <div style={{ color: text.muted, fontSize: "0.9rem", marginTop: 4 }}>
            Track operating expenses across your properties.
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)}>Add Expense</Button>
      </Card>

      <Card style={{ display: "grid", gap: spacing.md }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ color: text.muted, fontSize: 13 }}>
            Archived properties remain available here for historical expense reporting.
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))",
            gap: spacing.sm,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: text.muted, fontSize: 12 }}>Property</span>
            <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.archived ? `${property.name} (Archived)` : property.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: text.muted, fontSize: 12 }}>Category</span>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: text.muted, fontSize: 12 }}>From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: text.muted, fontSize: 12 }}>To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
          <div style={{ color: text.muted, fontSize: 13 }}>Total in view: <strong style={{ color: text.primary }}>{formatCents(totalAmountCents)}</strong></div>
          <Button variant="ghost" onClick={() => void load()}>Refresh</Button>
        </div>
      </Card>

      {capsLoading ? null : proExpensesEnabled ? (
        <ExpenseImportUploadCard
          files={importFiles}
          loading={importing}
          onFilesChange={(files) => {
            setImportFiles(files);
            setImportSummary(null);
          }}
          onPreview={() => void handlePreviewImport()}
        />
      ) : (
        <Card style={{ display: "grid", gap: spacing.md }}>
          <div style={{ fontWeight: 700 }}>Import expenses</div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: text.primary, fontSize: 14 }}>Manual expense tracking is available now.</div>
            <div style={{ color: text.muted, fontSize: 13 }}>
              Upgrade to Pro to import receipts, PDFs, CSVs, and spreadsheets with AI-assisted review.
            </div>
          </div>
        </Card>
      )}

      <Card style={{ display: "grid", gap: spacing.md }}>
        <div style={{ fontWeight: 700 }}>Export expenses</div>
        <div style={{ color: text.muted, fontSize: 13 }}>
          Export a clean expense table for your accountant.
        </div>
        {capsLoading ? null : proExpensesEnabled ? (
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => void triggerDownload("csv")} disabled={exporting !== null}>
              {exporting === "csv" ? "Exporting..." : "Export CSV"}
            </Button>
            <Button variant="secondary" onClick={() => void triggerDownload("xlsx")} disabled={exporting !== null}>
              {exporting === "xlsx" ? "Exporting..." : "Export Spreadsheet"}
            </Button>
            <Button variant="secondary" onClick={() => void triggerDownload("pdf")} disabled={exporting !== null}>
              {exporting === "pdf" ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        ) : (
          <div style={{ color: text.muted, fontSize: 13 }}>
            Upgrade to Pro for CSV import and accountant-ready exports.
          </div>
        )}
      </Card>

      {previewSummary ? (
        <ExpenseImportSummaryCard
          parsed={previewSummary.parsed}
          lowConfidence={previewSummary.lowConfidence}
          unresolvedProperty={previewSummary.unresolvedProperty}
          unresolvedUnit={previewSummary.unresolvedUnit}
          duplicateCount={previewSummary.duplicateCount}
          likelyDuplicateCount={previewSummary.likelyDuplicateCount}
          selectedCount={previewRows.filter((row) => row.include !== false).length}
          skippedCount={previewRows.filter((row) => row.include === false).length}
        />
      ) : null}

      {previewRows.length ? (
        <Card style={{ display: "grid", gap: spacing.md }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Review extracted rows</div>
            <div style={{ color: text.muted, fontSize: 13 }}>
              Check each row before import. Low-confidence rows stay editable so you can correct values safely.
            </div>
          </div>
          <ExpenseImportReviewTable
            rows={previewRows}
            properties={properties}
            onChangeRow={handleChangePreviewRow}
            isMobile={isMobile}
          />
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: text.muted, fontSize: 13 }}>
              {previewRows.filter((row) => row.include !== false).length} row(s) selected for import
            </div>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreviewRows([]);
                  setPreviewSummary(null);
                  setImportFiles([]);
                }}
              >
                Clear review
              </Button>
              <Button onClick={() => void handleConfirmImport()} disabled={importing}>
                {importing ? "Importing..." : "Confirm import"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {importSummary ? (
        <ExpenseImportSummaryCard
          rowsImported={importSummary.rowsImported}
          rowsSkipped={importSummary.rowsSkipped}
          duplicateImported={importSummary.duplicateImported}
          errors={importSummary.errors}
        />
      ) : null}

      {error ? (
        <Card style={{ border: `1px solid ${colors.danger}` }}>
          <div style={{ fontWeight: 700, color: colors.danger, marginBottom: 8 }}>Expenses issue</div>
          <div style={{ marginBottom: 12 }}>{error}</div>
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      ) : null}

      <Card style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ color: text.muted }}>Loading expenses...</div>
        ) : items.length === 0 ? (
          <div style={{ color: text.muted }}>No expenses recorded yet.</div>
        ) : isMobile ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: spacing.sm,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{formatDate(item.incurredAtMs)}</strong>
                  <span style={{ fontWeight: 700 }}>{formatCents(item.amountCents)}</span>
                </div>
                <div>{propertyById.get(item.propertyId) || item.propertyId}</div>
                <div style={{ color: text.muted, fontSize: 13 }}>
                  {item.category} · {item.vendorName || "No vendor"} · {item.status}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                <th style={{ padding: "8px 6px" }}>Date</th>
                <th style={{ padding: "8px 6px" }}>Property</th>
                <th style={{ padding: "8px 6px" }}>Category</th>
                <th style={{ padding: "8px 6px" }}>Vendor</th>
                <th style={{ padding: "8px 6px" }}>Amount</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: "9px 6px" }}>{formatDate(item.incurredAtMs)}</td>
                  <td style={{ padding: "9px 6px" }}>{propertyById.get(item.propertyId) || item.propertyId}</td>
                  <td style={{ padding: "9px 6px" }}>{item.category}</td>
                  <td style={{ padding: "9px 6px" }}>{item.vendorName || "-"}</td>
                  <td style={{ padding: "9px 6px", fontWeight: 600 }}>{formatCents(item.amountCents)}</td>
                  <td style={{ padding: "9px 6px", color: text.muted }}>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AddExpenseModal
        open={showAdd}
        properties={properties}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          void load();
        }}
      />
    </div>
  );
};

export default ExpensesPage;
