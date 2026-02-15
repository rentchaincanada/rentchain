import React from "react";
import { Card, Button } from "../ui/Ui";
import { spacing, colors, text } from "../../styles/tokens";

type Props = {
  events: any[];
  loading?: boolean;
  onOpenLedger?: () => void;
  openLedgerEnabled?: boolean;
  title?: string;
  emptyLabel?: string;
};

function formatDate(value: any): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function RecentEventsCard({
  events,
  loading,
  onOpenLedger,
  openLedgerEnabled,
  title = "Recent Events",
  emptyLabel = "No recent events yet.",
}: Props) {
  const skeletonRows = Array.from({ length: 8 });
  const list = Array.isArray(events) ? events.slice(0, 10) : [];
  const canOpenLedger = Boolean(onOpenLedger) && openLedgerEnabled !== false;

  return (
    <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <Button
          onClick={canOpenLedger ? onOpenLedger : undefined}
          disabled={!canOpenLedger}
          title={canOpenLedger ? undefined : "Coming soon"}
        >
          Open ledger
        </Button>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>
          {skeletonRows.map((_, i) => (
            <div
              key={i}
              style={{
                height: 32,
                borderRadius: 8,
                background: colors.border,
              }}
            />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div style={{ color: text.muted, fontSize: 13 }}>{emptyLabel}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {list.map((ev, idx) => {
            const title = ev?.title || ev?.type || "Event";
            const when = ev?.occurredAt || ev?.createdAt;
            return (
              <div
                key={ev?.id || idx}
                style={{
                  borderBottom: `1px solid ${colors.border}`,
                  paddingBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 700 }}>{title}</div>
                <div style={{ color: text.muted, fontSize: 12 }}>{formatDate(when)}</div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
