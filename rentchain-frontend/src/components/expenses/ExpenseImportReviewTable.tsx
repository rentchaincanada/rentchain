import React from "react";
import { Card, Input } from "../ui/Ui";
import { colors, spacing, text } from "../../styles/tokens";
import type { ExpenseCategory, ExpenseImportPreviewRow } from "../../api/expensesApi";

const categoryOptions: Array<ExpenseCategory | ""> = [
  "",
  "Repairs",
  "Maintenance",
  "Utilities",
  "Cleaning",
  "Supplies",
  "Landscaping",
  "Insurance",
  "Taxes",
  "Administration",
  "Contractor Labor",
  "Materials",
  "Other",
];

function formatConfidence(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

type Props = {
  rows: ExpenseImportPreviewRow[];
  properties: Array<{ id: string; name: string; archived?: boolean }>;
  onChangeRow: (rowId: string, patch: Partial<ExpenseImportPreviewRow>) => void;
  isMobile?: boolean;
};

export function ExpenseImportReviewTable({ rows, properties, onChangeRow, isMobile = false }: Props) {
  if (!rows.length) return null;

  const propertyOptions = properties.map((property) => ({
    id: property.id,
    name: property.archived ? `${property.name} (Archived)` : property.name,
  }));

  if (isMobile) {
    return (
      <div style={{ display: "grid", gap: spacing.sm }}>
        {rows.map((row) => (
          <Card
            key={row.rowId}
            style={{
              display: "grid",
              gap: spacing.sm,
              border: `1px solid ${(row.warnings || []).length ? colors.borderStrong : colors.border}`,
            }}
          >
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={row.include !== false}
                onChange={(e) => onChangeRow(row.rowId, { include: e.target.checked })}
              />
              Include row
            </label>
            <div style={{ color: text.muted, fontSize: 12 }}>{row.sourceFileName}</div>
            <Input
              aria-label={`Date ${row.rowId}`}
              type="date"
              value={row.date || ""}
              onChange={(e) => onChangeRow(row.rowId, { date: e.target.value || null })}
            />
            <select
              aria-label={`Property ${row.rowId}`}
              value={row.propertyId || ""}
              onChange={(e) => {
                const nextId = e.target.value || null;
                const nextProperty = propertyOptions.find((option) => option.id === nextId);
                onChangeRow(row.rowId, {
                  propertyId: nextId,
                  property: nextProperty?.name || row.property || null,
                  unit: null,
                  unitId: null,
                });
              }}
            >
              <option value="">Select property</option>
              {propertyOptions.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Unit ${row.rowId}`}
              value={row.unit || ""}
              onChange={(e) => onChangeRow(row.rowId, { unit: e.target.value || null, unitId: null })}
              placeholder="Unit"
            />
            <select
              aria-label={`Category ${row.rowId}`}
              value={row.category || ""}
              onChange={(e) => onChangeRow(row.rowId, { category: e.target.value || null })}
            >
              {categoryOptions.map((category) => (
                <option key={category || "blank"} value={category}>
                  {category || "Select category"}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Vendor ${row.rowId}`}
              value={row.vendor || ""}
              onChange={(e) => onChangeRow(row.rowId, { vendor: e.target.value || null })}
              placeholder="Vendor"
            />
            <Input
              aria-label={`Description ${row.rowId}`}
              value={row.description || ""}
              onChange={(e) => onChangeRow(row.rowId, { description: e.target.value || null })}
              placeholder="Description"
            />
            <Input
              aria-label={`Amount ${row.rowId}`}
              type="number"
              step="0.01"
              min="0"
              value={row.amount ?? ""}
              onChange={(e) =>
                onChangeRow(row.rowId, {
                  amount: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: text.muted }}>Confidence: {formatConfidence(row.confidence)}</div>
              <div style={{ fontSize: 12, color: text.muted }}>{(row.warnings || []).join(" • ") || "Ready to review"}</div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
            <th style={{ padding: "8px 6px" }}>Include</th>
            <th style={{ padding: "8px 6px" }}>Date</th>
            <th style={{ padding: "8px 6px" }}>Property</th>
            <th style={{ padding: "8px 6px" }}>Unit</th>
            <th style={{ padding: "8px 6px" }}>Category</th>
            <th style={{ padding: "8px 6px" }}>Vendor</th>
            <th style={{ padding: "8px 6px" }}>Description</th>
            <th style={{ padding: "8px 6px" }}>Amount</th>
            <th style={{ padding: "8px 6px" }}>Confidence</th>
            <th style={{ padding: "8px 6px" }}>Warnings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowId} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                <input
                  type="checkbox"
                  checked={row.include !== false}
                  onChange={(e) => onChangeRow(row.rowId, { include: e.target.checked })}
                />
              </td>
              <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                <Input
                  aria-label={`Date ${row.rowId}`}
                  type="date"
                  value={row.date || ""}
                  onChange={(e) => onChangeRow(row.rowId, { date: e.target.value || null })}
                />
              </td>
              <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                <select
                  aria-label={`Property ${row.rowId}`}
                  value={row.propertyId || ""}
                  onChange={(e) => {
                    const nextId = e.target.value || null;
                    const nextProperty = propertyOptions.find((option) => option.id === nextId);
                    onChangeRow(row.rowId, {
                      propertyId: nextId,
                      property: nextProperty?.name || row.property || null,
                      unit: null,
                      unitId: null,
                    });
                  }}
                >
                  <option value="">Select property</option>
                  {propertyOptions.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </td>
              <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                <Input
                  aria-label={`Unit ${row.rowId}`}
                  value={row.unit || ""}
                  onChange={(e) => onChangeRow(row.rowId, { unit: e.target.value || null, unitId: null })}
                  placeholder="Unit"
                />
              </td>
              <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                <select
                  aria-label={`Category ${row.rowId}`}
                  value={row.category || ""}
                  onChange={(e) => onChangeRow(row.rowId, { category: e.target.value || null })}
                >
                  {categoryOptions.map((category) => (
                    <option key={category || "blank"} value={category}>
                      {category || "Select category"}
                    </option>
                  ))}
                </select>
              </td>
              <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                <Input
                  aria-label={`Vendor ${row.rowId}`}
                  value={row.vendor || ""}
                  onChange={(e) => onChangeRow(row.rowId, { vendor: e.target.value || null })}
                  placeholder="Vendor"
                />
              </td>
              <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                <Input
                  aria-label={`Description ${row.rowId}`}
                  value={row.description || ""}
                  onChange={(e) => onChangeRow(row.rowId, { description: e.target.value || null })}
                  placeholder="Description"
                />
              </td>
              <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                <Input
                  aria-label={`Amount ${row.rowId}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.amount ?? ""}
                  onChange={(e) =>
                    onChangeRow(row.rowId, {
                      amount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </td>
              <td style={{ padding: "10px 6px", verticalAlign: "top", fontSize: 13 }}>
                {formatConfidence(row.confidence)}
              </td>
              <td style={{ padding: "10px 6px", verticalAlign: "top", fontSize: 12, color: text.muted }}>
                {(row.warnings || []).join(" • ") || "Ready to review"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
