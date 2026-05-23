import React from "react";
import type { AdminPropertyView } from "../../api/adminApi";
import { Button, Card, Pill } from "../ui/Ui";
import { IntegrityBadge } from "./IntegrityBadge";

function metadataRow(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", fontWeight: 700 }}>{label}</div>
      <div style={{ color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function propertyDisplayName(property: AdminPropertyView) {
  return property.displayLabel || property.name || "Property not labelled";
}

function ownerDisplayName(property: AdminPropertyView) {
  return property.ownerDisplayName || property.ownerStatusLabel || "Owner profile unavailable";
}

export const AdminDetailDrawer: React.FC<{
  property: AdminPropertyView | null;
  onClose: () => void;
}> = ({ property, onClose }) => {
  if (!property) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.24)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-label="Property detail drawer"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(440px, 100vw)",
          height: "100%",
          background: "#fff",
          padding: 20,
          boxShadow: "-12px 0 28px rgba(15,23,42,0.18)",
          overflowY: "auto",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{propertyDisplayName(property)}</div>
            <div style={{ color: "#475569" }}>{[property.address1, property.city, property.province].filter(Boolean).join(", ") || "Address not available"}</div>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <Card style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <IntegrityBadge integrity={property.integrity} />
            {property.managerUserIds.length ? <Pill>{property.managerUserIds.length} managers</Pill> : null}
          </div>
          {metadataRow("Owner / landlord", ownerDisplayName(property))}
          {metadataRow("Ownership status", property.ownerStatusLabel || "Ownership status unavailable")}
          {metadataRow("Managers", property.managerUserIds.length ? `${property.managerUserIds.length} linked manager${property.managerUserIds.length === 1 ? "" : "s"}` : "--")}
        </Card>

        <Card style={{ display: "grid", gap: 12 }}>
          {metadataRow("Units", property.unitCount)}
          {metadataRow("Occupied", property.occupiedUnitCount)}
          {metadataRow("Vacant", property.vacantUnitCount)}
          {metadataRow("Created", String(property.createdAt || "--"))}
          {metadataRow("Updated", String(property.updatedAt || "--"))}
        </Card>
      </aside>
    </div>
  );
};
