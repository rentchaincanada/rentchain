import React, { useEffect, useState } from "react";
import { fetchScreeningById } from "../../api/screeningsApi";
import { Card, Button } from "../ui/Ui";
import { spacing, colors, text, radius } from "../../styles/tokens";

interface Props {
  screeningId: string | null;
  open: boolean;
  onClose: () => void;
}

export const ScreeningDetailModal: React.FC<Props> = ({
  screeningId,
  open,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!open || !screeningId) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchScreeningById(screeningId)
      .then((resp) => {
        if (!active) return;
        setData(resp);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || "Failed to load screening");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, screeningId]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <Card
        style={{
          width: "min(520px, 95vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: spacing.md,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.sm,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
            Screening detail
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {loading ? (
          <div style={{ color: text.muted }}>Loading…</div>
        ) : error ? (
          <div
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.4)",
              color: colors.danger,
              padding: spacing.sm,
              borderRadius: radius.md,
            }}
          >
            {error}
          </div>
        ) : data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: radius.pill,
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  fontSize: "0.9rem",
                }}
              >
                Status: {data.status}
              </span>
              <span style={{ color: text.subtle, fontSize: "0.9rem" }}>
                Provider: {data.provider}
              </span>
            </div>
            <div style={{ color: text.muted, fontSize: "0.9rem" }}>
              Requested: {new Date(data.requestedAt).toLocaleString()}
            </div>
            {data.completedAt && (
              <div style={{ color: text.muted, fontSize: "0.9rem" }}>
                Completed: {new Date(data.completedAt).toLocaleString()}
              </div>
            )}
            {data.resultSummary && (
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: spacing.sm,
                  background: colors.panel,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Result</div>
                {data.resultSummary.score !== undefined && (
                  <div>Score: {data.resultSummary.score}</div>
                )}
                {data.resultSummary.riskLevel && (
                  <div>Risk: {data.resultSummary.riskLevel}</div>
                )}
                {data.resultSummary.notes && (
                  <div style={{ color: text.muted }}>{data.resultSummary.notes}</div>
                )}
              </div>
            )}
            {data.error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  padding: spacing.sm,
                  borderRadius: radius.md,
                }}
              >
                Error: {data.error.message}
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                if (!data?.id) return;
                navigator.clipboard?.writeText(data.id).catch(() => undefined);
              }}
            >
              Copy screening ID
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
};
