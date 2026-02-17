import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Input, Button } from "../components/ui/Ui";
import { colors, spacing, text } from "../styles/tokens";
import { useAuth } from "../context/useAuth";

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { signup, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setSubmitting(true);
    try {
      await signup(email.trim().toLowerCase(), password, fullName.trim() || undefined);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Unable to create account.");
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
      <Card elevated style={{ width: "min(520px, 94vw)", padding: spacing.lg }}>
        <div style={{ marginBottom: spacing.xs, color: text.subtle, fontSize: "0.9rem" }}>
          RentChain
        </div>
        <h1 style={{ marginTop: 0, marginBottom: spacing.xs, fontSize: "1.7rem" }}>
          Sign up (Free)
        </h1>
        <p style={{ marginTop: 0, color: text.muted }}>Start with Free - upgrade anytime.</p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: spacing.sm }}>
          <label style={{ display: "grid", gap: spacing.xs }}>
            <span style={{ color: text.muted, fontSize: "0.9rem" }}>Full name (optional)</span>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </label>
          <label style={{ display: "grid", gap: spacing.xs }}>
            <span style={{ color: text.muted, fontSize: "0.9rem" }}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label style={{ display: "grid", gap: spacing.xs }}>
            <span style={{ color: text.muted, fontSize: "0.9rem" }}>Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </label>
          <label style={{ display: "grid", gap: spacing.xs }}>
            <span style={{ color: text.muted, fontSize: "0.9rem" }}>Confirm password</span>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
              required
            />
          </label>

          <Button type="submit" disabled={submitting || isLoading} style={{ justifyContent: "center" }}>
            {submitting ? "Creating account..." : "Create free account"}
          </Button>
        </form>

        <div style={{ marginTop: spacing.sm, minHeight: "1.2rem", color: error ? colors.danger : text.muted }}>
          {error || "Already have an account? Sign in below."}
        </div>

        <div style={{ marginTop: spacing.sm, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <Link to="/login" style={{ color: colors.accent, textDecoration: "none", fontWeight: 600 }}>
            Go to login
          </Link>
          <Link to="/request-access" style={{ color: text.muted, textDecoration: "none" }}>
            Request access
          </Link>
          <Link to="/invite" style={{ color: text.muted, textDecoration: "none" }}>
            I have an invite
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default SignupPage;
