import React from "react";
import { Link } from "react-router-dom";
import { Card, Button } from "../../components/ui/Ui";
import {
  getTenantLeaseNotices,
  type TenantLeaseNoticeSummary,
} from "../../api/tenantLeaseNoticeApi";
import { colors, spacing, text as textTokens } from "../../styles/tokens";

function fmtDate(value: number | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function titleForNotice(notice: TenantLeaseNoticeSummary) {
  return (
    notice.metadata?.summary?.title ||
    (notice.noticeType === "renewal_offer" ? "Lease renewal offer" : "Lease notice")
  );
}

function descriptionForNotice(notice: TenantLeaseNoticeSummary) {
  return notice.metadata?.summary?.body || "Review your next-term options and submit your decision.";
}

function responseTone(response: string) {
  switch (response) {
    case "renew":
      return { label: "Renewed", background: "#ecfdf5", color: "#166534" };
    case "quit":
      return { label: "Quitting", background: "#fef2f2", color: "#991b1b" };
    default:
      return { label: "Pending", background: "#eff6ff", color: "#1d4ed8" };
  }
}

export default function TenantLeaseNoticesPage() {
  const [items, setItems] = React.useState<TenantLeaseNoticeSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTenantLeaseNotices();
      const next = Array.isArray(res?.items) ? res.items : Array.isArray(res?.data) ? res.data : [];
      setItems(next);
    } catch (err: any) {
      setError(err?.payload?.error || err?.message || "Unable to load lease notices.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card elevated style={{ display: "grid", gap: spacing.md }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.45rem" }}>Lease Notices</h1>
        <div style={{ color: textTokens.muted }}>
          Review renewal offers and respond before your deadline.
        </div>
      </div>

      {error ? (
        <Card style={{ borderColor: colors.borderStrong, color: colors.danger }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Unable to load lease notices</div>
          <div style={{ marginBottom: spacing.sm }}>{error}</div>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <div style={{ color: textTokens.muted }}>Loading lease notices…</div>
      ) : items.length === 0 ? (
        <Card style={{ background: colors.panel }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No lease notices yet</div>
          <div style={{ color: textTokens.muted }}>
            When your landlord sends a lease notice, it will appear here.
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          {items.map((notice) => {
            const tone = responseTone(String(notice.tenantResponse || "pending").toLowerCase());
            return (
              <Card key={notice.id} style={{ display: "grid", gap: spacing.sm }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: spacing.sm,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 800, color: textTokens.primary }}>
                      {titleForNotice(notice)}
                    </div>
                    <div style={{ color: textTokens.muted, fontSize: "0.92rem" }}>
                      {descriptionForNotice(notice)}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: tone.background,
                      color: tone.color,
                      fontSize: 12,
                      fontWeight: 700,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {tone.label}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: spacing.sm,
                    fontSize: "0.92rem",
                  }}
                >
                  <div>
                    <div style={{ color: textTokens.muted, fontSize: 12 }}>Current rent</div>
                    <div style={{ fontWeight: 700 }}>
                      {typeof notice.currentRent === "number" ? `${notice.currentRent} CAD` : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: textTokens.muted, fontSize: 12 }}>Proposed rent</div>
                    <div style={{ fontWeight: 700 }}>
                      {typeof notice.proposedRent === "number" ? `${notice.proposedRent} CAD` : "To be decided"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: textTokens.muted, fontSize: 12 }}>Response deadline</div>
                    <div style={{ fontWeight: 700 }}>{fmtDate(notice.responseDeadlineAt)}</div>
                  </div>
                  <div>
                    <div style={{ color: textTokens.muted, fontSize: 12 }}>New term</div>
                    <div style={{ fontWeight: 700 }}>
                      {notice.newTermStartDate || "—"}
                      {notice.newTermEndDate ? ` to ${notice.newTermEndDate}` : ""}
                    </div>
                  </div>
                </div>

                <div>
                  <Link
                    to={`/tenant/lease-notices/${notice.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "9px 14px",
                      borderRadius: 999,
                      background: colors.accent,
                      color: "#fff",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    Open lease notice
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}
