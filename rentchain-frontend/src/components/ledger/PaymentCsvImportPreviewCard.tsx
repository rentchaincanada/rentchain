import React from "react";
import {
  previewLedgerPaymentCsvImport,
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

export function PaymentCsvImportPreviewCard() {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<PaymentImportPreviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
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
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Failed to preview payment import.");
    } finally {
      setLoading(false);
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
        border: "1px solid #dbeafe",
        background: "#eff6ff",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>AI-assisted payment CSV import</div>
          <div style={{ color: "#475569", fontSize: 13, maxWidth: 760 }}>
            Upload tenant payment rows for review. This preview matches tenants and leases, but it does not write payments or ledger entries.
          </div>
          <div style={{ color: "#475569", fontSize: 13, maxWidth: 760 }}>
            Accepted columns: tenant name (or first/last name), amount, payment date. Property/unit recommended.
          </div>
          <pre
            aria-label="Payment CSV example"
            style={{
              margin: "4px 0 0",
              padding: 8,
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #bfdbfe",
              color: "#334155",
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

          <div style={{ border: "1px solid #bfdbfe", borderRadius: 10, background: "#fff", padding: 10 }}>
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

          <div style={{ overflowX: "auto", border: "1px solid #bfdbfe", borderRadius: 10, background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#475569", fontSize: 12 }}>
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
                    return (
                      <tr key={row.rowId} style={{ borderTop: "1px solid #e2e8f0" }}>
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
                          {row.tenantEmail ? <div style={{ color: "#64748b", fontSize: 12 }}>{row.tenantEmail}</div> : null}
                        </td>
                        <td style={cellStyle}>
                          <div>{row.propertyLabel || row.property || "Unresolved property"}</div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>{row.unitLabel || row.unit || "Unit not resolved"}</div>
                        </td>
                        <td style={cellStyle}>{row.amountDisplay || "-"}</td>
                        <td style={cellStyle}>{row.paymentDate || "-"}</td>
                        <td style={cellStyle}>
                          <div>{row.method || "Method not provided"}</div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>{row.reference || "No reference"}</div>
                        </td>
                        <td style={cellStyle}>
                          <div>{row.reason}</div>
                          {row.warning ? <div style={{ color: "#92400e", fontSize: 12 }}>{row.warning}</div> : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ color: "#475569", fontSize: 13 }}>
            Preview only. Payment and ledger writes require a separate confirmation flow and are not enabled in this version.
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #bfdbfe", borderRadius: 10, background: "#fff", padding: 10 }}>
      <div style={{ color: "#64748b", fontSize: 12 }}>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "8px 10px",
  verticalAlign: "top",
};
