// src/components/tenants/TenantList.tsx
import React from "react";
import type { Tenant } from "../../types/tenant";
import { arr, num, str } from "../../utils/safe";

interface TenantListProps {
  tenants: Tenant[];
  selectedTenantId: string | null;
  onSelectTenant: (tenantId: string) => void;
}

export const TenantList: React.FC<TenantListProps> = ({
  tenants,
  selectedTenantId,
  onSelectTenant,
}) => {
  const safeTenants = arr<Tenant>(tenants);
  return (
    <div
      style={{
        borderRadius: "0.75rem",
        border: "1px solid rgba(148,163,184,0.6)",
        background: "rgba(15,23,42,0.96)",
        boxShadow: "0 18px 45px rgba(15,23,42,0.75)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "0.9rem 1rem",
          borderBottom: "1px solid rgba(51,65,85,1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#9ca3af",
          }}
        >
          Tenants
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "#6b7280",
          }}
        >
          {safeTenants.length} total
        </div>
      </div>

      <div
        style={{
          maxHeight: "calc(100vh - 240px)",
          overflowY: "auto",
        }}
      >
        {safeTenants.map((tenant) => {
          const isActive = tenant.id === selectedTenantId;
          const risk = (tenant as any)?.riskLevel ?? "Low";

          const riskColor =
            risk === "High"
              ? "#f97373"
              : risk === "Medium"
              ? "#facc15"
              : "#4ade80";

          return (
            <button
              key={tenant.id}
              type="button"
              onClick={() => onSelectTenant(tenant.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.75rem 1rem",
                border: "none",
                borderBottom: "1px solid rgba(31,41,55,1)",
                background: isActive
                  ? "linear-gradient(90deg, rgba(37,99,235,0.6), rgba(15,23,42,0.98))"
                  : "transparent",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "0.1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: isActive ? "#f9fafb" : "#e5e7eb",
                  }}
                >
                  {str((tenant as any)?.fullName, "—")}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "999px",
                    border: `1px solid ${riskColor}`,
                    color: riskColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {risk}
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                }}
              >
                {str((tenant as any)?.propertyName) && (tenant as any)?.unit
                  ? `${str((tenant as any)?.propertyName)} • ${str((tenant as any)?.unit)}`
                  : str((tenant as any)?.propertyName) ||
                    str((tenant as any)?.unit) ||
                    "—"}
              </div>
              {(tenant as any)?.balance !== undefined && (
                <div
                  style={{
                    fontSize: "0.7rem",
                    color:
                      num((tenant as any)?.balance) > 0 ? "#f97373" : "#4ade80",
                  }}
                >
                  Balance:{" "}
                  {num((tenant as any)?.balance) > 0 ? "+" : ""}
                  {num((tenant as any)?.balance).toLocaleString("en-CA", {
                    style: "currency",
                    currency: "CAD",
                    maximumFractionDigits: 2,
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
