import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card, Input, Button } from "../components/ui/Ui";
import { colors, spacing, text } from "../styles/tokens";
import { useAuth } from "../context/useAuth";
import { apiFetch } from "../api/http";
import { setAuthToken } from "../lib/authToken";

type InviteRedeemResponse = {
  ok: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    role?: string;
    landlordId?: string;
    plan?: string;
    approved?: boolean;
  };
};

const InviteRedeemPage: React.FC = () => {
  const navigate = useNavigate();
  const { token: tokenFromPath } = useParams();
  const { updateUser } = useAuth();
  const [code, setCode] = useState(tokenFromPath || "");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redeem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    if (!code.trim()) return setError("Invite code is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setSubmitting(true);
    try {
      const res = await apiFetch<InviteRedeemResponse>("/invites/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          email: email.trim().toLowerCase() || undefined,
          fullName: fullName.trim() || undefined,
          password,
        }),
      });
      if (!res?.token || !res?.user) {
        throw new Error("Unable to redeem invite.");
      }
      setAuthToken(res.token);
      updateUser({
        id: res.user.id,
        email: res.user.email,
        role: res.user.role,
        landlordId: res.user.landlordId,
        plan: res.user.plan,
        approved: res.user.approved,
      });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const msg = String(err?.message || "Unable to redeem invite.");
      if (/invite_not_found|invalid_token/i.test(msg)) {
        setError("Invite code not found. You can request access instead.");
      } else if (/invite_expired/i.test(msg)) {
        setError("Invite code expired. Request a new invite or request access.");
      } else if (/invite_used/i.test(msg)) {
        setError("Invite already used. Try signing in, or request access.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
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
      <Card elevated style={{ width: "min(540px, 94vw)", padding: spacing.lg }}>
        <div style={{ marginBottom: spacing.xs, color: text.subtle, fontSize: "0.9rem" }}>
          RentChain
        </div>
        <h1 style={{ marginTop: 0, marginBottom: spacing.xs, fontSize: "1.7rem" }}>I have an invite</h1>
        <p style={{ marginTop: 0, color: text.muted }}>
          Redeem your invite code to activate your account.
        </p>

        <form onSubmit={redeem} style={{ display: "grid", gap: spacing.sm }}>
          <label style={{ display: "grid", gap: spacing.xs }}>
            <span style={{ color: text.muted, fontSize: "0.9rem" }}>Invite code</span>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste invite code" required />
          </label>
          <label style={{ display: "grid", gap: spacing.xs }}>
            <span style={{ color: text.muted, fontSize: "0.9rem" }}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label style={{ display: "grid", gap: spacing.xs }}>
            <span style={{ color: text.muted, fontSize: "0.9rem" }}>Full name (optional)</span>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </label>
          <label style={{ display: "grid", gap: spacing.xs }}>
            <span style={{ color: text.muted, fontSize: "0.9rem" }}>Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              autoComplete="new-password"
              required
            />
          </label>

          <Button type="submit" disabled={submitting} style={{ justifyContent: "center" }}>
            {submitting ? "Redeeming..." : "Redeem invite"}
          </Button>
        </form>

        <div style={{ marginTop: spacing.sm, minHeight: "1.2rem", color: error ? colors.danger : text.muted }}>
          {error || "Need access without a code? Use Request access."}
        </div>

        <div style={{ marginTop: spacing.sm, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <Link to="/request-access" style={{ color: colors.accent, textDecoration: "none", fontWeight: 600 }}>
            Request access
          </Link>
          <Link to="/signup" style={{ color: text.muted, textDecoration: "none" }}>
            Sign up (Free)
          </Link>
          <Link to="/login" style={{ color: text.muted, textDecoration: "none" }}>
            Login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default InviteRedeemPage;
