import React from "react";
import { Card, Button } from "../ui/Ui";

export function UnitsCsvPreviewModal({
  open,
  onClose,
  onConfirm,
  filename,
  headers,
  rows,
  isImporting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  filename: string;
  headers: string[];
  rows: string[][];
  isImporting: boolean;
}) {
  if (!open) return null;

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
              {filename} • showing first {rows.length} rows
            </div>

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
              <Button onClick={onConfirm} disabled={isImporting}>
                {isImporting ? "Importing…" : "Confirm import"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
