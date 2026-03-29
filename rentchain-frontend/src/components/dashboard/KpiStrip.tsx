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
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener?.(update);
    return () => media.removeListener?.(update);
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? "repeat(2, minmax(0, 1fr))"
          : "repeat(auto-fit, minmax(140px, 1fr))",
        gap: spacing.sm,
        alignItems: "stretch",
      }}
    >
      {itemsOrder.map((item) => {
        const value = kpis ? (kpis as any)?.[item.key] ?? 0 : 0;
        return (
          <Card
            key={item.key}
            style={{
              padding: isMobile ? spacing.sm : spacing.md,
              border: `1px solid ${colors.border}`,
              minHeight: isMobile ? 0 : 80,
              height: "100%",
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
              <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800 }}>
                {Number(value).toLocaleString()}
              </div>
            )}
            <div style={{ color: text.muted, fontSize: isMobile ? 11 : 12, lineHeight: 1.35 }}>
              {item.label}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
