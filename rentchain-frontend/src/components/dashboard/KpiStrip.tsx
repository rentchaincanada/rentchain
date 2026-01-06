import React from "react";
import { Card } from "../ui/Ui";
import { colors, spacing, text } from "../../styles/tokens";

type Props = {
  kpis?: {
    propertiesCount: number;
    unitsCount: number;
    tenantsCount: number;
    openActionsCount: number;
    delinquentCount: number;
  } | null;
  loading?: boolean;
};

const itemsOrder = [
  { key: "propertiesCount", label: "Properties" },
  { key: "unitsCount", label: "Units" },
  { key: "tenantsCount", label: "Tenants" },
  { key: "openActionsCount", label: "Open Actions" },
  { key: "delinquentCount", label: "Delinquencies" },
] as const;

export function KpiStrip({ kpis, loading }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: spacing.sm,
      }}
    >
      {itemsOrder.map((item) => {
        const value = kpis ? (kpis as any)?.[item.key] ?? 0 : 0;
        return (
          <Card
            key={item.key}
            style={{
              padding: spacing.md,
              border: `1px solid ${colors.border}`,
              minHeight: 80,
            }}
          >
            {loading ? (
              <div
                style={{
                  width: "60%",
                  height: 18,
                  background: colors.border,
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              />
            ) : (
              <div style={{ fontSize: 20, fontWeight: 800 }}>{Number(value).toLocaleString()}</div>
            )}
            <div style={{ color: text.muted, fontSize: 12 }}>{item.label}</div>
          </Card>
        );
      })}
    </div>
  );
}
