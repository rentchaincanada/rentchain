import React from "react";
import { Card } from "../ui/Ui";
import { colors, text } from "../../styles/tokens";

export function ExpenseImportSummaryCard({
  rowsImported,
  rowsSkipped,
  errors,
}: {
  rowsImported: number;
  rowsSkipped: number;
  errors: string[];
}) {
  return (
    <Card
      style={{
        border: `1px solid ${rowsSkipped > 0 ? colors.borderStrong : "rgba(22,163,74,0.32)"}`,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        {rowsSkipped > 0 ? "Import completed with skips" : "Import completed"}
      </div>
      <div style={{ display: "grid", gap: 4, color: text.primary }}>
        <div>{rowsImported} imported</div>
        <div>{rowsSkipped} skipped</div>
      </div>
      {errors.length ? (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, color: text.muted }}>Row-level notes</div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.secondary, lineHeight: 1.6 }}>
            {errors.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
