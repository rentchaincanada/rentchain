import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, Input, Button } from "../components/ui/Ui";
import { colors, spacing, text } from "../styles/tokens";
import { apiFetch } from "../lib/apiClient";

type InviteState =
  | "loading"
  | "ready"
  | "expired"
  | "used"
  | "invalid"
  | "error"
  | "accepted";

export default function InvitePage() {
  const { token } = useParams();
  const [state, setState] = useState<InviteState>("loading");
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setState("invalid");
      return;
    }
    setState("loading");
    apiFetch(`/public/landlord-invites/${token}`, { method: "GET" })
      .then((res: any) => {
        if (!active) return;
        if (res?.ok) {
          setEmail(String(res.email || "").toLowerCase());
          setExpiresAt(res.expiresAt ? Number(res.expiresAt) : null);
          setState("ready");
          return;
        }
        const err = String(res?.error || "");
        if (err === "invite_expired") setState("expired");
        else if (err === "invite_used") setState("used");
        else setState("invalid");
      })
      .catch(() => {
        if (!active) return;
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res: any = await apiFetch(`/public/landlord-invites/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({ password, fullName }),
      });
      if (!res?.ok) {
        const err = String(res?.error || "Unable to accept invite");
        setError(err);
        if (err === "invite_expired") setState("expired");
        if (err === "invite_used") setState("used");
        return;
      }
      setVerificationSent(Boolean(res.verificationSent));
      setState("accepted");
    } catch (e: any) {
      setError(e?.message || "Unable to accept invite");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!token) return;
    setResending(true);
    try {
      const res: any = await apiFetch(`/public/landlord-invites/${token}/resend-verification`, {
        method: "POST",
      });
      if (res?.ok) {
        setVerificationSent(true);
      } else {
        setError(String(res?.error || "Unable to resend verification"));
      }
    } catch (e: any) {
      setError(e?.message || "Unable to resend verification");
    } finally {
      setResending(false);
    }
  };

  const renderBody = () => {
    if (state === "loading") {
      return <div style={{ color: text.muted }}>Loading invite…</div>;
    }
    if (state === "expired") {
      return <div style={{ color: colors.danger }}>This invite has expired.</div>;
    }
    if (state === "used") {
      return <div style={{ color: colors.danger }}>This invite has already been used.</div>;
    }
    if (state === "invalid") {
      return <div style={{ color: colors.danger }}>Invite not found.</div>;
    }
    if (state === "error") {
      return <div style={{ color: colors.danger }}>Could not load invite.</div>;
    }
    if (state === "accepted") {
      return (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Check your email to verify your account.</div>
          <div style={{ color: text.muted, fontSize: "0.9rem" }}>
            We sent a verification link to {email}.
          </div>
          <Button type="button" onClick={handleResend} disabled={resending}>
            {resending ? "Resending…" : "Resend verification"}
          </Button>
          <Link to="/login" style={{ color: colors.accent, fontWeight: 600 }}>
            Back to login
          </Link>
        </div>
      );
    }

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAccept();
        }}
        style={{ display: "grid", gap: spacing.sm }}
      >
        <div style={{ color: text.subtle, fontSize: "0.9rem" }}>You’ve been invited to RentChain</div>
        <div style={{ fontWeight: 700, fontSize: "1.2rem" }}>{email}</div>
        {expiresAt ? (
          <div style={{ color: text.muted, fontSize: "0.85rem" }}>
            Invite expires {new Date(expiresAt).toLocaleString()}
          </div>
        ) : null}
        <label style={{ display: "grid", gap: 6 }}>
          Full name (optional)
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Password
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            required
          />
        </label>
        {error ? <div style={{ color: colors.danger }}>{error}</div> : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Accept invite"}
        </Button>
        <div style={{ fontSize: "0.85rem", color: text.muted }}>
          After accepting, you’ll need to verify your email before logging in.
        </div>
      </form>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: colors.bg,
        backgroundImage: colors.bgAmbient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 5vw, 40px)",
      }}
    >
      <Card elevated style={{ width: "min(520px, 92vw)", padding: spacing.lg }}>
        {renderBody()}
      </Card>
    </div>
  );
}
