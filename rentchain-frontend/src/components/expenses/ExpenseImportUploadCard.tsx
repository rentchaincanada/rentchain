import React from "react";
import { Button, Card } from "../ui/Ui";
import { spacing, text } from "../../styles/tokens";

export function ExpenseImportUploadCard({
  loading,
  disabled,
  files,
  onFilesChange,
  onPreview,
}: {
  loading: boolean;
  disabled?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onPreview: () => void;
}) {
  return (
    <Card style={{ display: "grid", gap: spacing.md }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 700 }}>Import expenses</div>
        <div style={{ color: text.muted, fontSize: 13 }}>
          Upload receipts, statements, CSVs, or spreadsheets. RentChain will extract expense rows for your review
          before import.
        </div>
      </div>

      <div style={{ display: "grid", gap: spacing.sm }}>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,.csv,.xls,.xlsx,image/jpeg,image/png,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          onChange={(e) => onFilesChange(Array.from(e.target.files || []))}
        />
        <div style={{ color: text.muted, fontSize: 12 }}>Supported: JPG, PNG, PDF, CSV, XLSX</div>
        {files.length ? (
          <div style={{ color: text.secondary, fontSize: 13 }}>
            {files.length} file{files.length === 1 ? "" : "s"} selected
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
        <Button onClick={onPreview} disabled={disabled || !files.length || loading}>
          {loading ? "Reviewing files..." : "Review import"}
        </Button>
        <div style={{ color: text.muted, fontSize: 12 }}>Nothing is imported until you confirm reviewed rows.</div>
      </div>
    </Card>
  );
}
