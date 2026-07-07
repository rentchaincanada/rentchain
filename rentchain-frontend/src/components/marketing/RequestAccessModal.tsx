import React, { useEffect, useState } from "react";
import { Button, Input } from "../ui/Ui";
import { radius, spacing } from "../../styles/tokens";
import { requestLandlordInquiry } from "../../api/public";
import {
  authGhostButtonStyle,
  authInputProps,
  authLabelTextStyle,
  authPalette,
  authPrimaryButtonStyle,
  authSecondaryButtonStyle,
  authTextareaStyle,
} from "../auth/authPageStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  referralCode?: string | null;
};

export const RequestAccessModal: React.FC<Props> = ({ open, onClose, referralCode }) => {
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
      await requestLandlordInquiry({ email, firstName, portfolioSize, note, referralCode: referralCode || undefined });
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
        background: "rgba(23, 20, 17, 0.48)",
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
          background: authPalette.card,
          borderRadius: radius.lg,
          border: `1px solid ${authPalette.fieldBorder}`,
          padding: spacing.lg,
          boxShadow: "0 22px 52px rgba(69, 55, 33, 0.16)",
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 760, fontSize: "1.1rem", color: authPalette.ink }}>Request Access</div>
            <div style={{ color: authPalette.muted, fontSize: "0.95rem" }}>
              Tell us a bit about your portfolio and we’ll follow up.
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} style={authGhostButtonStyle}>
            Close
          </Button>
        </div>

        {sent ? (
          <div style={{ color: authPalette.ink }}>
            <div style={{ fontWeight: 700 }}>Thanks — we’ll be in touch shortly.</div>
            <div style={{ color: authPalette.muted, marginTop: spacing.xs }}>
              Watch your inbox for a confirmation email.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: spacing.md }}>
            {referralCode ? (
              <div
                style={{
                  padding: "10px 12px",
                  border: `1px solid ${authPalette.sageBorder}`,
                  borderRadius: radius.md,
                  background: authPalette.sage,
                  color: authPalette.ink,
                }}
              >
                You were invited by a RentChain landlord.
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={authLabelTextStyle}>Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                {...authInputProps()}
                required
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={authLabelTextStyle}>First name</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jamie"
                {...authInputProps()}
                required
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={authLabelTextStyle}>Portfolio size</label>
              <Input
                value={portfolioSize}
                onChange={(e) => setPortfolioSize(e.target.value)}
                placeholder="e.g. 5 units, 2 properties"
                {...authInputProps()}
                required
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={authLabelTextStyle}>Notes (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tell us what you’re looking for."
                rows={3}
                style={authTextareaStyle}
                onFocus={(event) => {
                  event.currentTarget.style.borderColor = authPalette.fieldBorderFocus;
                  event.currentTarget.style.boxShadow = "0 0 0 3px rgba(105, 82, 49, 0.22)";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.borderColor = authPalette.fieldBorder;
                  event.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {error ? (
              <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div>
            ) : null}

            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button type="submit" disabled={loading} style={authPrimaryButtonStyle}>
                {loading ? "Submitting…" : "Request access"}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose} style={authSecondaryButtonStyle}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
