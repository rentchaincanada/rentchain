import React from "react";
import { Card, Button } from "../ui/Ui";
import type { UnitCsvIssue, UnitCsvPreviewRow } from "../../api/unitsImportApi";

export function UnitsCsvPreviewModal({
  open,
  onClose,
  onConfirm,
  filename,
  headers = [],
  rows = [],
  previewRows = [],
  issues = [],
  isImporting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  filename: string;
  headers?: string[];
  rows?: string[][];
  previewRows?: UnitCsvPreviewRow[];
  issues?: UnitCsvIssue[];
  isImporting: boolean;
}) {
  if (!open) return null;
  const hasBackendPreview = previewRows.length > 0 || issues.length > 0;
  const validCount = previewRows.filter((row) => row.status === "valid").length;
  const hasBlockingIssues = issues.length > 0 || previewRows.some((row) => row.status === "invalid");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{ width: "min(900px, 96vw)" }}>
        <Card elevated>
          <div style={{ padding: 18 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Preview import</div>
            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
              {filename} - {hasBackendPreview ? `${validCount} row(s) ready, ${issues.length} issue(s)` : `showing first ${rows.length} rows`}
            </div>
            {issues.length > 0 ? (
              <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
                {issues.slice(0, 8).map((issue, idx) => (
                  <div key={`${issue.row}-${issue.code}-${idx}`} style={{ color: "#b91c1c", fontSize: 13 }}>
                    {issue.message}
                  </div>
                ))}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 14,
                border: "1px solid rgba(15,23,42,0.10)",
                borderRadius: 12,
                overflow: "auto",
                maxHeight: "55vh",
                background: "white",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                {hasBackendPreview ? (
                  <>
                    <thead>
                      <tr>
                        {["Row", "Status", "Unit", "Rent", "Beds", "Baths", "Sqft"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              borderBottom: "1px solid rgba(15,23,42,0.10)",
                              position: "sticky",
                              top: 0,
                              background: "white",
                              fontWeight: 800,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.row}>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                            {row.row}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              borderBottom: "1px solid rgba(15,23,42,0.06)",
                              color: row.status === "valid" ? "#166534" : "#b91c1c",
                            }}
                          >
                            {row.status}
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                            {row.data.unitNumber || row.unitNumber || ""}
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                            {row.data.rent ?? ""}
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                            {row.data.bedrooms ?? ""}
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                            {row.data.bathrooms ?? ""}
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                            {row.data.sqft ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead>
                      <tr>
                        {headers.map((h, idx) => (
                          <th
                            key={idx}
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              borderBottom: "1px solid rgba(15,23,42,0.10)",
                              position: "sticky",
                              top: 0,
                              background: "white",
                              fontWeight: 800,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          {headers.map((_, j) => (
                            <td
                              key={j}
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid rgba(15,23,42,0.06)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {r[j] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 14,
              }}
            >
              <Button onClick={onClose} disabled={isImporting}>
                Cancel
              </Button>
              <Button onClick={onConfirm} disabled={isImporting || hasBlockingIssues}>
                {isImporting ? "Importing…" : "Confirm import"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
