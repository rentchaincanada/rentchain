import React from "react";
import { Card, Button } from "../ui/Ui";
import { spacing, colors, text } from "../../styles/tokens";

type Props = {
  items: any[];
  loading?: boolean;
  onViewAll?: () => void;
  viewAllEnabled?: boolean;
  title?: string;
  emptyLabel?: string;
};

export function ActionRequiredPanel({
  items,
  loading,
  onViewAll,
  viewAllEnabled,
  title = "Action Required",
  emptyLabel = "No action items right now.",
}: Props) {
  const skeletonRows = Array.from({ length: 5 });
  const canViewAll = Boolean(onViewAll) && viewAllEnabled !== false;

  return (
    <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <Button
          onClick={canViewAll ? onViewAll : undefined}
          disabled={!canViewAll}
          title={canViewAll ? undefined : "Coming soon"}
        >
          View all
        </Button>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>
          {skeletonRows.map((_, i) => (
            <div
              key={i}
              style={{
                height: 40,
                borderRadius: 8,
                background: colors.border,
              }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: text.muted, fontSize: 13 }}>{emptyLabel}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.slice(0, 5).map((item, idx) => {
            const title = item?.title || item?.type || "Action";
            const severity = String(item?.severity || "info").toLowerCase();
            const subtitleParts = [];
            if (item?.propertyId) subtitleParts.push(`Property: ${item.propertyId}`);
            if (item?.tenantId) subtitleParts.push(`Tenant: ${item.tenantId}`);
            return (
              <div
                key={item?.id || idx}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{title}</div>
                  {subtitleParts.length ? (
                    <div style={{ color: text.muted, fontSize: 12 }}>{subtitleParts.join(" · ")}</div>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {item?.href ? (
                    <button
                      type="button"
                      onClick={() => window.location.assign(String(item.href))}
                      style={{
                        borderRadius: 10,
                        border: `1px solid ${colors.border}`,
                        background: colors.card,
                        color: text.primary,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>
                  ) : null}
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                      background: severity === "high" ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)",
                      color: severity === "high" ? "#dc2626" : "#1d4ed8",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "capitalize",
                    }}
                  >
                    {severity}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
