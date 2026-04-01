import React from "react";
import type { AdminPropertyView } from "../../api/adminApi";
import { IntegrityBadge } from "./IntegrityBadge";

function formatDate(value: string | number | null) {
  if (value == null || value === "") return "--";
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

type Props = {
  items: AdminPropertyView[];
  sortBy: "createdAt" | "updatedAt" | "name";
  sortDir: "asc" | "desc";
  onSortChange: (sortBy: "createdAt" | "updatedAt" | "name") => void;
  onSelect: (item: AdminPropertyView) => void;
};

export const AdminDataTable: React.FC<Props> = ({ items, sortBy, sortDir, onSortChange, onSelect }) => {
  const sortLabel = (field: "createdAt" | "updatedAt" | "name", label: string) =>
    `${label}${sortBy === field ? ` (${sortDir})` : ""}`;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.22)" }}>
            <th style={{ padding: "10px 12px" }}>
              <button type="button" onClick={() => onSortChange("name")} style={{ background: "transparent", border: 0, fontWeight: 700, cursor: "pointer" }}>
                {sortLabel("name", "Property")}
              </button>
            </th>
            <th style={{ padding: "10px 12px" }}>Address</th>
            <th style={{ padding: "10px 12px" }}>Province</th>
            <th style={{ padding: "10px 12px" }}>Owner / Landlord</th>
            <th style={{ padding: "10px 12px" }}>Units</th>
            <th style={{ padding: "10px 12px" }}>Occupied</th>
            <th style={{ padding: "10px 12px" }}>Vacant</th>
            <th style={{ padding: "10px 12px" }}>Integrity</th>
            <th style={{ padding: "10px 12px" }}>
              <button type="button" onClick={() => onSortChange("updatedAt")} style={{ background: "transparent", border: 0, fontWeight: 700, cursor: "pointer" }}>
                {sortLabel("updatedAt", "Updated")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item)}
              style={{ borderBottom: "1px solid rgba(148,163,184,0.14)", cursor: "pointer" }}
            >
              <td style={{ padding: "12px" }}>
                <div style={{ fontWeight: 700 }}>{item.name || item.id}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{item.id}</div>
              </td>
              <td style={{ padding: "12px" }}>{[item.address1, item.city].filter(Boolean).join(", ") || "--"}</td>
              <td style={{ padding: "12px" }}>{item.province || "--"}</td>
              <td style={{ padding: "12px" }}>
                <div>{item.ownerUserId || "--"}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{item.landlordId || "--"}</div>
              </td>
              <td style={{ padding: "12px" }}>{item.unitCount}</td>
              <td style={{ padding: "12px" }}>{item.occupiedUnitCount}</td>
              <td style={{ padding: "12px" }}>{item.vacantUnitCount}</td>
              <td style={{ padding: "12px" }}>
                <IntegrityBadge integrity={item.integrity} />
              </td>
              <td style={{ padding: "12px" }}>{formatDate(item.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
