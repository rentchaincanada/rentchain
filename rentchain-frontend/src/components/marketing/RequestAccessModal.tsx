import React, { useEffect, useState } from "react";
import { Button, Input } from "../ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";
import { requestLandlordInquiry } from "../../api/public";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const RequestAccessModal: React.FC<Props> = ({ open, onClose }) => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [portfolioSize, setPortfolioSize] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSent(false);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await requestLandlordInquiry({ email, firstName, portfolioSize, note });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Request access"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        zIndex: 4000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.md,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(560px, 95vw)",
          background: colors.card,
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          padding: spacing.lg,
          boxShadow: "0 18px 40px rgba(15,23,42,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Request Access</div>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              Tell us a bit about your portfolio and we’ll follow up.
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {sent ? (
          <div style={{ color: text.primary }}>
            <div style={{ fontWeight: 700 }}>Thanks — we’ll be in touch shortly.</div>
            <div style={{ color: text.muted, marginTop: spacing.xs }}>
              Watch your inbox for a confirmation email.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: spacing.md }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>First name</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jamie"
                required
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Portfolio size</label>
              <Input
                value={portfolioSize}
                onChange={(e) => setPortfolioSize(e.target.value)}
                placeholder="e.g. 5 units, 2 properties"
                required
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Notes (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tell us what you’re looking for."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
                  color: text.primary,
                  resize: "vertical",
                }}
              />
            </div>

            {error ? (
              <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div>
            ) : null}

            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting…" : "Request access"}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
