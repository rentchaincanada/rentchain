import React from "react";
import { Card } from "../ui/Ui";
import { colors, text } from "../../styles/tokens";

export function ExpenseImportSummaryCard({
  rowsImported,
  rowsSkipped,
  errors,
  parsed,
  lowConfidence,
  unresolvedProperty,
  unresolvedUnit,
}: {
  rowsImported?: number;
  rowsSkipped?: number;
  errors?: string[];
  parsed?: number;
  lowConfidence?: number;
  unresolvedProperty?: number;
  unresolvedUnit?: number;
}) {
  const imported = Number(rowsImported || 0);
  const skipped = Number(rowsSkipped || 0);
  const rowErrors = Array.isArray(errors) ? errors : [];
  const showPreview = parsed != null || lowConfidence != null || unresolvedProperty != null || unresolvedUnit != null;

  return (
    <Card
      style={{
        border: `1px solid ${skipped > 0 || (lowConfidence || 0) > 0 ? colors.borderStrong : "rgba(22,163,74,0.32)"}`,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        {showPreview ? "Import review summary" : skipped > 0 ? "Import completed with skips" : "Import completed"}
      </div>
      <div style={{ display: "grid", gap: 4, color: text.primary }}>
        {showPreview ? (
          <>
            <div>{Number(parsed || 0)} parsed</div>
            <div>{Number(lowConfidence || 0)} low confidence</div>
            <div>{Number(unresolvedProperty || 0)} property needs review</div>
            <div>{Number(unresolvedUnit || 0)} unit needs review</div>
          </>
        ) : (
          <>
            <div>{imported} imported</div>
            <div>{skipped} skipped</div>
          </>
        )}
      </div>
      {rowErrors.length ? (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, color: text.muted }}>Row-level notes</div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.secondary, lineHeight: 1.6 }}>
            {rowErrors.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
