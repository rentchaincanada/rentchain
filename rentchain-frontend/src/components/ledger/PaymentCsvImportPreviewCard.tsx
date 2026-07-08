import React from "react";
import {
  confirmLedgerPaymentCsvImport,
  previewLedgerPaymentCsvImport,
  type PaymentImportConfirmResponse,
  type PaymentImportPreviewResponse,
  type PaymentImportPreviewRow,
} from "@/api/ledgerPaymentImportApi";

const TEMPLATE_CSV = [
  "Reference,Date,First Name,Last Name,Rent Amount,Property,Unit,Method",
  "1001,2026-05-05,John,Smith,1640,North Towers,101,etransfer",
  "1002,2026-05-05,Bailey,Blinkers,2000,Center Suites,1,etransfer",
].join("\n");

function toneForRow(row: PaymentImportPreviewRow) {
  if (row.matchStatus === "invalid" || row.matchStatus === "ambiguous") {
    return { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };
  }
  if (row.confidence === "high" && row.preselected) {
    return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" };
  }
  return { bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
}

function statusLabel(row: PaymentImportPreviewRow) {
  if (row.matchStatus === "invalid") return "Invalid";
  if (row.matchStatus === "ambiguous") return "Ambiguous";
  if (row.matchStatus === "unmatched") return "Unmatched";
  if (row.confidence === "high") return "High confidence";
  if (row.confidence === "medium") return "Needs review";
  return "Low confidence";
}

function matchBasisLabel(row: PaymentImportPreviewRow): string | null {
  const basis = row.matchBasis || [];
  if (!basis.length) return null;
  const labels = basis.map((item) => {
    if (item === "tenant") return "Tenant";
    if (item === "property") return "Property";
    if (item === "unit") return "Unit";
    if (item === "email") return "Email";
    return item;
  });
  return `Matched by: ${labels.join(" + ")}`;
}

function isImportEligible(row: PaymentImportPreviewRow): boolean {
  return row.matchStatus === "matched" && (row.confidence === "high" || row.confidence === "medium") && !row.duplicateInFile;
}

function shouldPreselect(row: PaymentImportPreviewRow): boolean {
  return row.matchStatus === "matched" && row.confidence === "high" && !row.duplicateInFile;
}

export function PaymentCsvImportPreviewCard({ onImportComplete }: { onImportComplete?: () => void } = {}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<PaymentImportPreviewResponse | null>(null);
  const [selectedRowIds, setSelectedRowIds] = React.useState<Set<string>>(new Set());
  const [confirmResult, setConfirmResult] = React.useState<PaymentImportConfirmResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rowsByProperty = React.useMemo(() => {
    const grouped = new Map<string, PaymentImportPreviewRow[]>();
    for (const row of preview?.rows || []) {
      const key = row.propertyLabel || row.property || "Unresolved property";
      grouped.set(key, [...(grouped.get(key) || []), row]);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [preview]);

  async function handlePreview() {
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await previewLedgerPaymentCsvImport(file);
      setPreview(result);
      setConfirmResult(null);
      setSelectedRowIds(new Set(result.rows.filter(shouldPreselect).map((row) => row.rowId)));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Failed to preview payment import.");
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(row: PaymentImportPreviewRow) {
    if (!isImportEligible(row)) return;
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(row.rowId)) next.delete(row.rowId);
      else next.add(row.rowId);
      return next;
    });
  }

  function selectAllEligible() {
    if (!preview) return;
    setSelectedRowIds(new Set(preview.rows.filter(isImportEligible).map((row) => row.rowId)));
  }

  function deselectAll() {
    setSelectedRowIds(new Set());
  }

  async function handleConfirmImport() {
    if (!preview || selectedRowIds.size === 0) {
      setError("Select at least one eligible payment row to import.");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmLedgerPaymentCsvImport({
        importBatchId: preview.importBatchId,
        selectedRowIds: Array.from(selectedRowIds),
      });
      setConfirmResult(result);
      if (result.importedCount > 0) onImportComplete?.();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Failed to import selected payments.");
    } finally {
      setConfirming(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rentchain-payment-import-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      aria-label="Payment CSV import assistant"
      style={{
        border: "1px solid rgba(91,70,48,0.16)",
        background: "#fff6e8",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gap: 12,
        boxShadow: "0 10px 24px rgba(59,44,28,0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800, color: "#211c17" }}>AI-assisted payment CSV import</div>
          <div style={{ color: "#63594d", fontSize: 13, maxWidth: 760 }}>
            Upload tenant payment rows for review. This preview matches tenants and leases, but it does not write payments or ledger entries.
          </div>
          <div style={{ color: "#63594d", fontSize: 13, maxWidth: 760 }}>
            Accepted columns: tenant name (or first/last name), amount, payment date. Property/unit recommended.
          </div>
          <pre
            aria-label="Payment CSV example"
            style={{
              margin: "4px 0 0",
              padding: 8,
              borderRadius: 8,
              background: "#fffaf1",
              border: "1px solid rgba(91,70,48,0.18)",
              color: "#3f382f",
              fontSize: 12,
              overflowX: "auto",
              maxWidth: 760,
            }}
          >
            {TEMPLATE_CSV}
          </pre>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={downloadTemplate}>
            Download CSV template
          </button>
          <input
            aria-label="Payment CSV file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setPreview(null);
              setConfirmResult(null);
              setSelectedRowIds(new Set());
              setError(null);
            }}
          />
          <button type="button" onClick={() => void handlePreview()} disabled={loading}>
            {loading ? "Previewing..." : "Preview CSV"}
          </button>
        </div>
      </div>

      {error ? <div style={{ color: "#991b1b", fontSize: 13 }}>{error}</div> : null}

      {preview ? (
        <div style={{ display: "grid", gap: 12 }}>
          {preview.notices?.messages?.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {preview.notices.messages.map((message) => (
                <div
                  key={message}
                  style={{
                    border: "1px solid #fde68a",
                    background: "#fffbeb",
                    color: "#92400e",
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontSize: 13,
                  }}
                >
                  {message}
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            <SummaryTile label="Rows" value={String(preview.summary.totalRows)} />
            <SummaryTile label="Total amount" value={preview.summary.totalPaymentAmountDisplay} />
            <SummaryTile label="Matched" value={String(preview.summary.matchedRows)} />
            <SummaryTile label="Needs review" value={String(preview.summary.mediumConfidenceRows + preview.summary.lowConfidenceRows)} />
            <SummaryTile label="Blocked" value={String(preview.summary.unmatchedRows + preview.summary.ambiguousRows + preview.summary.invalidRows)} />
            <SummaryTile label="Preselected" value={String(preview.summary.preselectedRows)} />
          </div>
          <div style={{ color: "#475569", fontSize: 13 }}>
            {preview.summary.matchedRows} rows matched tenant lease records.{" "}
            {preview.summary.unmatchedRows + preview.summary.ambiguousRows + preview.summary.invalidRows} rows are blocked until the row-level issue is fixed.
          </div>

          <div
            style={{
              border: "1px solid rgba(91,70,48,0.18)",
              borderRadius: 10,
              background: "#fffaf1",
              padding: 10,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ color: "#63594d", fontSize: 13 }}>
              This will create payment records and append ledger entries for selected rows. This cannot overwrite existing ledger history.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={selectAllEligible}>
                Select all eligible
              </button>
              <button type="button" onClick={deselectAll}>
                Deselect all
              </button>
              <button type="button" onClick={() => void handleConfirmImport()} disabled={confirming || selectedRowIds.size === 0}>
                {confirming ? "Importing..." : `Import selected payments (${selectedRowIds.size})`}
              </button>
            </div>
          </div>

          {confirmResult ? (
            <div style={{ border: "1px solid #bbf7d0", borderRadius: 10, background: "#f0fdf4", color: "#14532d", padding: 10 }}>
              <div style={{ fontWeight: 800 }}>Import result</div>
              <div style={{ fontSize: 13 }}>
                Imported {confirmResult.importedCount} rows. Skipped duplicates {confirmResult.duplicateCount}. Failed {confirmResult.failedCount}.
              </div>
              <div style={{ fontSize: 13 }}>Next step: review imported rows on /payments or the relevant lease ledger.</div>
            </div>
          ) : null}

          <div style={{ border: "1px solid rgba(91,70,48,0.18)", borderRadius: 10, background: "#fffaf1", padding: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Rows grouped by property</div>
            <div style={{ display: "grid", gap: 6 }}>
              {preview.summary.groupedByProperty.map((group) => (
                <div key={group.propertyLabel} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>{group.propertyLabel}</span>
                  <strong>
                    {group.rowCount} rows · {group.amountDisplay}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid rgba(91,70,48,0.18)", borderRadius: 10, background: "#fffaf1" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#63594d", fontSize: 12 }}>
                  <th style={cellStyle}>Import</th>
                  <th style={cellStyle}>Status</th>
                  <th style={cellStyle}>Tenant</th>
                  <th style={cellStyle}>Property / Unit</th>
                  <th style={cellStyle}>Amount</th>
                  <th style={cellStyle}>Payment date</th>
                  <th style={cellStyle}>Method / Reference</th>
                  <th style={cellStyle}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rowsByProperty.flatMap(([, rows]) =>
                  rows.map((row) => {
                    const tone = toneForRow(row);
                    const basisLabel = matchBasisLabel(row);
                    const eligible = isImportEligible(row);
                    return (
                      <tr key={row.rowId} style={{ borderTop: "1px solid rgba(91,70,48,0.14)" }}>
                        <td style={cellStyle}>
                          <input
                            aria-label={`Select row ${row.sourceRowNumber}`}
                            type="checkbox"
                            checked={selectedRowIds.has(row.rowId)}
                            disabled={!eligible}
                            onChange={() => toggleRow(row)}
                          />
                        </td>
                        <td style={cellStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              border: `1px solid ${tone.border}`,
                              background: tone.bg,
                              color: tone.color,
                              borderRadius: 999,
                              padding: "3px 8px",
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {statusLabel(row)}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <div style={{ fontWeight: 700 }}>{row.matchedTenantName || row.tenantName || "Unmatched tenant"}</div>
                          {row.tenantEmail ? <div style={{ color: "#63594d", fontSize: 12 }}>{row.tenantEmail}</div> : null}
                        </td>
                        <td style={cellStyle}>
                          <div>{row.propertyLabel || row.property || "Unresolved property"}</div>
                          <div style={{ color: "#63594d", fontSize: 12 }}>{row.unitLabel || row.unit || "Unit not resolved"}</div>
                        </td>
                        <td style={cellStyle}>{row.amountDisplay || "-"}</td>
                        <td style={cellStyle}>{row.paymentDate || "-"}</td>
                        <td style={cellStyle}>
                          <div>{row.method || "Method not provided"}</div>
                          <div style={{ color: "#63594d", fontSize: 12 }}>{row.reference || "No reference"}</div>
                        </td>
                        <td style={cellStyle}>
                          <div>{row.reason}</div>
                          {basisLabel ? <div style={{ color: "#166534", fontSize: 12, fontWeight: 700 }}>{basisLabel}</div> : null}
                          {row.warning ? <div style={{ color: "#92400e", fontSize: 12 }}>{row.warning}</div> : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ color: "#63594d", fontSize: 13 }}>
            Preview is read-only until you click Import selected payments. High-confidence rows are preselected. Review-required rows can be selected manually. Blocked, ambiguous, invalid, and duplicate rows are not imported.
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid rgba(91,70,48,0.18)", borderRadius: 10, background: "#fffaf1", padding: 10 }}>
      <div style={{ color: "#63594d", fontSize: 12 }}>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "8px 10px",
  verticalAlign: "top",
};
