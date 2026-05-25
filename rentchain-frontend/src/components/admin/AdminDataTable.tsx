import React from "react";
import type { AdminPropertyView } from "../../api/adminApi";
import { IntegrityBadge } from "./IntegrityBadge";
import "./AdminDataTable.css";

function formatDate(value: string | number | null) {
  if (value == null || value === "") return "--";
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function propertyDisplayName(item: AdminPropertyView) {
  return item.displayLabel || item.name || "Property not labelled";
}

function ownerDisplayName(item: AdminPropertyView) {
  return item.ownerDisplayName || item.ownerStatusLabel || "Owner profile unavailable";
}

function propertyAddress(item: AdminPropertyView) {
  return [item.address1, item.city].filter(Boolean).join(", ") || "Address unavailable";
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
    <>
      <div className="rc-admin-properties-mobile-list" aria-label="Admin properties mobile list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="rc-admin-property-card"
            onClick={() => onSelect(item)}
          >
            <span className="rc-admin-property-card__title">{propertyDisplayName(item)}</span>
            <span className="rc-admin-property-card__address">{propertyAddress(item)}</span>
            <span className="rc-admin-property-card__meta">
              <span>{ownerDisplayName(item)}</span>
              <span>{item.ownerStatusLabel || "Ownership status unavailable"}</span>
            </span>
            <span className="rc-admin-property-card__stats">
              <span>{item.unitCount} units</span>
              <span>{item.occupiedUnitCount} occupied</span>
              <span>{item.vacantUnitCount} vacant</span>
            </span>
            <span className="rc-admin-property-card__footer">
              <IntegrityBadge integrity={item.integrity} />
              <span>Updated {formatDate(item.updatedAt)}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="rc-admin-properties-table-wrap">
        <table className="rc-admin-properties-table">
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
                <div style={{ fontWeight: 700 }}>{propertyDisplayName(item)}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Admin property record</div>
              </td>
              <td style={{ padding: "12px" }}>{propertyAddress(item)}</td>
              <td style={{ padding: "12px" }}>{item.province || "--"}</td>
              <td style={{ padding: "12px" }}>
                <div>{ownerDisplayName(item)}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{item.ownerStatusLabel || "Ownership status unavailable"}</div>
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
    </>
  );
};
