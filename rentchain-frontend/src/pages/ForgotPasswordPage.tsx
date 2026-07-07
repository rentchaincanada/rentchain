import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { Card, Input, Button } from "@/components/ui/Ui";
import { spacing } from "@/styles/tokens";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  authBodyStyle,
  authCardStyle,
  authEyebrowStyle,
  authHeadingStyle,
  authInputProps,
  authLabelTextStyle,
  authLinkStyle,
  authPalette,
  authPrimaryButtonStyle,
  authShellStyle,
} from "@/components/auth/authPageStyles";

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
      const appUrl = import.meta.env.VITE_APP_URL || "https://rentchain.ai";
      await sendPasswordResetEmail(auth, trimmed, {
        url: `${appUrl}/auth/action`,
        handleCodeInApp: false,
      });
      setSuccess(SUCCESS_MESSAGE);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-email") {
        setError("Enter a valid email address.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many requests. Please try again later.");
      } else if (code === "firebase_not_configured") {
        setError("Password reset is not configured. Please contact support.");
      } else if (code === "auth/missing-continue-uri") {
        setError("Password reset link is temporarily unavailable. Please contact support.");
      } else if (code === "auth/unauthorized-continue-uri") {
        setError("Password reset link is not authorized. Please contact support.");
      } else {
        setError("Unable to send reset email. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ ...authShellStyle, padding: spacing.xl }}>
      <Card elevated style={authCardStyle("min(460px, 100%)")}>
        <div style={authEyebrowStyle}>
          RentChain Secure Access
        </div>
        <h1 style={{ ...authHeadingStyle, marginBottom: spacing.md }}>
          Reset your password
        </h1>
        <p style={{ ...authBodyStyle, marginBottom: spacing.sm }}>
          Enter your email to receive a password reset link.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={authLabelTextStyle}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              {...authInputProps()}
              required
            />
          </label>

          <Button
            type="submit"
            disabled={submitting}
            style={{
              ...authPrimaryButtonStyle,
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
            color: error ? authPalette.danger : authPalette.muted,
          }}
        >
          {error ? error : success ? success : "We will email you a reset link."}
        </div>

        <div style={{ marginTop: spacing.sm }}>
          <Link to="/login" style={{ ...authLinkStyle, fontSize: "0.9rem" }}>
            Back to login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
