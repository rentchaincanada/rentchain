import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import {
  getTenantLeaseNotice,
  respondToTenantLeaseNotice,
  type TenantLeaseNoticeSummary,
} from "../../api/tenantLeaseNoticeApi";
import { colors, spacing, text as textTokens } from "../../styles/tokens";

function fmtDate(value: number | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return `${value} CAD`;
}

function noticeHeading(notice: TenantLeaseNoticeSummary) {
  return notice.metadata?.summary?.title || "Lease notice";
}

function noticeBody(notice: TenantLeaseNoticeSummary) {
  return (
    notice.metadata?.summary?.body ||
    "Your landlord has sent a lease notice. Review the proposed terms and choose how you want to proceed."
  );
}

function decisionLabel(decision: "renew" | "quit") {
  return decision === "renew" ? "Begin New Term" : "Quit Lease";
}

export default function TenantLeaseNoticeDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const noticeId = String(params.id || "").trim();
  const [notice, setNotice] = React.useState<TenantLeaseNoticeSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<"renew" | "quit" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<{
    decision: "renew" | "quit";
    nextStatus: string;
  } | null>(null);

  const load = React.useCallback(async () => {
    if (!noticeId) {
      setError("Notice not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getTenantLeaseNotice(noticeId);
      setNotice(res?.item || res?.data || null);
    } catch (err: any) {
      setError(err?.payload?.error || err?.message || "Unable to load lease notice.");
    } finally {
      setLoading(false);
    }
  }, [noticeId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const tenantResponse = String(notice?.tenantResponse || "pending").toLowerCase();
  const alreadyResponded = tenantResponse !== "pending";

  const submitDecision = async (decision: "renew" | "quit") => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await respondToTenantLeaseNotice(noticeId, decision);
      setSuccess({ decision: res.decision, nextStatus: res.nextStatus });
      setConfirming(null);
      setNotice((prev) =>
        prev
          ? {
              ...prev,
              tenantResponse: res.decision,
              tenantRespondedAt: Date.now(),
              updatedAt: Date.now(),
            }
          : prev
      );
    } catch (err: any) {
      setError(err?.payload?.error || err?.message || "Unable to submit your response.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card elevated style={{ display: "grid", gap: spacing.md }}>
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
          <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.45rem" }}>
            {notice ? noticeHeading(notice) : "Lease Notice"}
          </h1>
          <div style={{ color: textTokens.muted }}>
            Review the terms and confirm whether you want to begin a new term or quit at the end of the current term.
          </div>
        </div>
        <Link
          to="/tenant/lease-notices"
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: `1px solid ${colors.border}`,
            textDecoration: "none",
            color: textTokens.primary,
            fontWeight: 700,
          }}
        >
          Back to lease notices
        </Link>
      </div>

      {error ? (
        <Card style={{ borderColor: colors.borderStrong, color: colors.danger }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Unable to load lease notice</div>
          <div style={{ marginBottom: spacing.sm }}>{error}</div>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <div style={{ color: textTokens.muted }}>Loading lease notice…</div>
      ) : notice ? (
        <>
          <Card style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>{noticeBody(notice)}</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: spacing.sm,
                fontSize: "0.94rem",
              }}
            >
              <div>
                <div style={{ color: textTokens.muted, fontSize: 12 }}>Current rent</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(notice.currentRent)}</div>
              </div>
              <div>
                <div style={{ color: textTokens.muted, fontSize: 12 }}>Rent change mode</div>
                <div style={{ fontWeight: 700 }}>{String(notice.rentChangeMode || "—").replace(/_/g, " ")}</div>
              </div>
              <div>
                <div style={{ color: textTokens.muted, fontSize: 12 }}>Proposed rent</div>
                <div style={{ fontWeight: 700 }}>
                  {notice.rentChangeMode === "undecided" ? "Landlord will decide later" : formatMoney(notice.proposedRent)}
                </div>
              </div>
              <div>
                <div style={{ color: textTokens.muted, fontSize: 12 }}>Response deadline</div>
                <div style={{ fontWeight: 700 }}>{fmtDate(notice.responseDeadlineAt)}</div>
              </div>
              <div>
                <div style={{ color: textTokens.muted, fontSize: 12 }}>New term type</div>
                <div style={{ fontWeight: 700 }}>{notice.newTermType || "—"}</div>
              </div>
              <div>
                <div style={{ color: textTokens.muted, fontSize: 12 }}>New term dates</div>
                <div style={{ fontWeight: 700 }}>
                  {notice.newTermStartDate || "—"}
                  {notice.newTermEndDate ? ` to ${notice.newTermEndDate}` : ""}
                </div>
              </div>
            </div>
          </Card>

          {success ? (
            <Card style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}>
              <div style={{ fontWeight: 800, color: "#166534", marginBottom: 8 }}>
                Response received
              </div>
              <div style={{ color: "#166534", marginBottom: spacing.sm }}>
                You selected <strong>{decisionLabel(success.decision)}</strong>. Your landlord has been notified.
              </div>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                <Button type="button" onClick={() => navigate("/tenant/lease-notices")}>
                  Back to lease notices
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate("/tenant")}>
                  Go to dashboard
                </Button>
              </div>
            </Card>
          ) : alreadyResponded ? (
            <Card style={{ borderColor: colors.borderStrong, background: "#f8fafc" }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Response already submitted</div>
              <div style={{ color: textTokens.muted }}>
                You already responded to this lease notice with <strong>{decisionLabel(tenantResponse as "renew" | "quit")}</strong>.
              </div>
            </Card>
          ) : confirming ? (
            <Card style={{ borderColor: colors.borderStrong, background: "#fff7ed" }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Confirm {decisionLabel(confirming)}
              </div>
              <div style={{ color: textTokens.secondary, marginBottom: spacing.sm }}>
                {confirming === "renew"
                  ? "This will tell your landlord you want to begin a new term under the proposed lease workflow."
                  : "This will tell your landlord you plan to quit at the end of the current term."}
              </div>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                <Button type="button" onClick={() => void submitDecision(confirming)} disabled={submitting}>
                  {submitting ? "Submitting..." : "Confirm"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setConfirming(null)} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </Card>
          ) : (
            <Card style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ fontWeight: 800 }}>Choose your response</div>
              <div style={{ color: textTokens.muted }}>
                Select one option below. You will be asked to confirm before your response is sent.
              </div>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                <Button type="button" onClick={() => setConfirming("renew")}>
                  Begin New Term
                </Button>
                <Button type="button" variant="secondary" onClick={() => setConfirming("quit")}>
                  Quit Lease
                </Button>
              </div>
            </Card>
          )}
        </>
      ) : null}
    </Card>
  );
}
