import React from "react";
import { Card, Button } from "../ui/Ui";
import { spacing, colors, text } from "../../styles/tokens";
import { formatInternalReference, formatOperationalLabel } from "@/lib/identityReferences";

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
  const [infoItemId, setInfoItemId] = React.useState<string | null>(null);
  const skeletonRows = Array.from({ length: 5 });
  const canViewAll = Boolean(onViewAll) && viewAllEnabled !== false;

  const infoItem = items.find((item, idx) => String(item?.id || idx) === infoItemId);

  function screeningInfoCopy(item: any) {
    const title = String(item?.title || "").toLowerCase();
    const href = String(item?.href || "").toLowerCase();
    const isScreening = title.includes("screening") || title.includes("transunion") || href.includes("opentransunionaccess");
    if (isScreening) {
      return "Connect TransUnion access from Applications, then open an application review to run screening once the applicant has provided the required consent.";
    }
    return "Open this action to continue the related workflow. RentChain keeps these items here when there is a clear next step for the landlord.";
  }

  return (
    <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        {canViewAll ? (
          <Button onClick={onViewAll}>View all</Button>
        ) : (
          <div style={{ color: text.muted, fontSize: 12, fontWeight: 600 }}>Top items</div>
        )}
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
            if (item?.propertyName || item?.propertyLabel) {
              subtitleParts.push(formatOperationalLabel({ kind: "property", label: item.propertyName || item.propertyLabel }));
            } else if (item?.propertyId) {
              subtitleParts.push(formatInternalReference("property", item.propertyId));
            }
            if (item?.tenantName || item?.tenantLabel) {
              subtitleParts.push(formatOperationalLabel({ kind: "tenant", label: item.tenantName || item.tenantLabel }));
            } else if (item?.tenantId) {
              subtitleParts.push(formatInternalReference("tenant", item.tenantId));
            }
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
                  <button
                    type="button"
                    aria-label={`Info about ${title}`}
                    onClick={() => setInfoItemId(String(item?.id || idx))}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: "#f8fafc",
                      color: text.primary,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Info
                  </button>
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
                  {severity !== "info" ? (
                    <span
                      aria-hidden="true"
                      style={{
                        padding: "4px 8px",
                        borderRadius: 12,
                        border: `1px solid ${colors.border}`,
                        background: severity === "high" ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)",
                        color: severity === "high" ? "#dc2626" : "#1d4ed8",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "capitalize",
                        cursor: "default",
                        userSelect: "none",
                      }}
                    >
                      {severity}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
          {infoItem ? (
            <div
              role="dialog"
              aria-label="Action information"
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: 12,
                background: "#f8fafc",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 800 }}>{infoItem.title || "Action information"}</div>
              <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.5 }}>{screeningInfoCopy(infoItem)}</div>
              <div>
                <button
                  type="button"
                  onClick={() => setInfoItemId(null)}
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
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
