import React, { useEffect, useMemo, useState } from "react";
import { Card, Section, Button, Input } from "../components/ui/Ui";
import { spacing, text, colors } from "../styles/tokens";
import { createReferral, listReferrals, type ReferralRecord } from "../api/referralsApi";
import { useToast } from "../components/ui/ToastProvider";
import { useAuth } from "../context/useAuth";

const statusLabel: Record<string, string> = {
  sent: "Invite sent",
  accepted: "Request received",
  approved: "Approved",
  expired: "Expired",
};

const fmt = (value?: number | null) => (value ? new Date(value).toLocaleString() : "—");

const ReferralsPage: React.FC = () => {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const { showToast } = useToast();

  const role = String(user?.role || "").toLowerCase();
  const canUseReferrals = role === "landlord" || role === "admin";

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listReferrals();
      setReferrals(rows);
    } catch (err: any) {
      const detail = String(err?.payload?.detail || "").trim();
      const message =
        detail === "not_approved"
          ? "Referral access is pending approval."
          : detail || err?.payload?.error || err?.message || "Failed to load referrals";
      showToast({ message: "Failed to load referrals", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canUseReferrals) {
      setLoading(false);
      return;
    }
    void load();
  }, [canUseReferrals]);

  const referralCount = useMemo(
    () => referrals.filter((row) => row.status === "approved" || row.status === "accepted").length,
    [referrals]
  );

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await createReferral({ refereeEmail: email, refereeName: name, note });
      showToast({
        message: res.deduped ? "Referral already active" : "Referral sent",
        description: res.emailed === false ? "Saved but email was not sent." : undefined,
        variant: "success",
      });
      setCopiedLink(res.referral?.link || null);
      setEmail("");
      setName("");
      setNote("");
      await load();
    } catch (err: any) {
      const detail = String(err?.payload?.detail || "").trim();
      const message =
        detail === "not_approved"
          ? "Referral access is pending approval."
          : detail || err?.payload?.error || err?.message || "Request failed";
      showToast({ message: "Could not send referral", description: message, variant: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Section style={{ display: "grid", gap: spacing.md }}>
      {!canUseReferrals ? (
        <Card style={{ padding: spacing.md }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Referrals</div>
          <div style={{ color: text.muted }}>Referrals are available to landlord accounts.</div>
        </Card>
      ) : (
        <>
          <Card style={{ padding: spacing.md, display: "grid", gap: spacing.sm }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Refer a landlord</h1>
                <div style={{ color: text.muted }}>Invite trusted landlords and track each referral status.</div>
              </div>
              <div style={{ color: text.muted }}>Referrals progressed: {referralCount}</div>
            </div>
            <form onSubmit={handleSend} style={{ display: "grid", gap: spacing.sm }}>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="landlord@example.com"
                required
              />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Optional note"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: colors.card,
                  color: text.primary,
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                <Button type="submit" disabled={sending}>
                  {sending ? "Sending..." : "Send referral"}
                </Button>
                <Button type="button" variant="ghost" onClick={load} disabled={loading}>
                  Refresh
                </Button>
              </div>
            </form>
            {copiedLink ? (
              <div style={{ color: text.muted }}>
                Referral link:{" "}
                <a href={copiedLink} target="_blank" rel="noreferrer">
                  {copiedLink}
                </a>
              </div>
            ) : null}
          </Card>

          <Card style={{ padding: spacing.md }}>
            {loading ? (
              <div style={{ color: text.muted }}>Loading referrals...</div>
            ) : referrals.length === 0 ? (
              <div style={{ color: text.muted }}>No referrals yet.</div>
            ) : (
              <div style={{ display: "grid", gap: spacing.sm }}>
                {referrals.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      padding: spacing.sm,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700 }}>{row.refereeEmail}</div>
                      <div style={{ color: text.muted }}>{statusLabel[row.status] || row.status}</div>
                    </div>
                    <div style={{ color: text.muted }}>
                      {row.refereeName || "—"} · Sent {fmt(row.createdAt)} · Accepted {fmt(row.acceptedAt)} · Approved{" "}
                      {fmt(row.approvedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </Section>
  );
};

export default ReferralsPage;
