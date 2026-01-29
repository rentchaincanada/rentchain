import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { Card, Input, Button } from "@/components/ui/Ui";
import { colors, spacing, text } from "@/styles/tokens";
import { getFirebaseAuth } from "@/lib/firebase";

const SUCCESS_MESSAGE = "If an account exists, a reset email has been sent.";

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, trimmed);
      setSuccess(SUCCESS_MESSAGE);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-email") {
        setError("Enter a valid email address.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many requests. Please try again later.");
      } else if (code === "firebase_not_configured") {
        setError("Password reset is not configured. Please contact support.");
      } else {
        setError("Unable to send reset email. Please try again.");
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
        padding: spacing.xl,
      }}
    >
      <Card elevated style={{ width: "100%", maxWidth: 460, padding: spacing.lg }}>
        <div style={{ marginBottom: spacing.xs, color: text.subtle, fontSize: "0.9rem" }}>
          RentChain Landlord Portal
        </div>
        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 700,
            marginBottom: spacing.md,
            letterSpacing: "-0.01em",
            color: text.primary,
          }}
        >
          Reset your password
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontSize: "0.9rem", color: text.muted }}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <Button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              opacity: submitting ? 0.8 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
              justifyContent: "center",
            }}
          >
            {submitting ? "Sending..." : "Send reset email"}
          </Button>
        </form>

        <div
          style={{
            marginTop: spacing.sm,
            minHeight: "1.2rem",
            fontSize: "0.9rem",
            color: error ? colors.danger : text.muted,
          }}
        >
          {error ? error : success ? success : "We will email you a reset link."}
        </div>

        <div style={{ marginTop: spacing.sm }}>
          <Link to="/login" style={{ color: colors.accent, fontWeight: 600, fontSize: "0.9rem" }}>
            Back to login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
