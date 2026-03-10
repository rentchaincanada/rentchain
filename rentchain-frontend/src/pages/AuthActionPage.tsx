import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { Card, Input, Button } from "@/components/ui/Ui";
import { colors, spacing, text } from "@/styles/tokens";
import { getFirebaseAuth } from "@/lib/firebase";
import { resolvePostAuthDestination } from "@/lib/authDestination";
import { trackAuthEvent } from "@/lib/authAnalytics";

type ViewState =
  | "loading"
  | "reset-form"
  | "reset-success"
  | "invalid-link"
  | "verify-success"
  | "unsupported";

const passwordRules = [
  "At least 12 characters",
  "At least 1 uppercase letter",
  "At least 1 lowercase letter",
  "At least 1 number",
  "At least 1 symbol",
];

function validatePassword(password: string, email?: string | null): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a symbol.";

  if (email && password.toLowerCase().includes(email.toLowerCase())) {
    return "Password cannot contain your email address.";
  }

  return null;
}

function maskEmail(email: string | null): string {
  if (!email) return "";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  if (localPart.length <= 2) return `${localPart[0] || "*"}*@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

async function sendResetConfirmationEmail(email: string) {
  try {
    const response = await fetch("/api/auth/password-reset/confirmation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      credentials: "include",
    });

    if (!response.ok) {
      console.warn("Password reset confirmation email failed:", response.status);
    }
  } catch (error) {
    console.warn("Password reset confirmation email request failed:", error);
  }
}

const AuthActionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");
  const continueUrl = searchParams.get("continueUrl");

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const auth = useMemo(() => {
    try {
      setAuthError(null);
      return getFirebaseAuth();
    } catch (err: any) {
      const code = String(err?.code || "");
      if (code === "firebase_not_configured") {
        setAuthError("Password reset is not configured. Please contact support.");
      } else {
        setAuthError("Unable to initialize secure auth action.");
      }
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      if (!auth) {
        if (!cancelled) setViewState("invalid-link");
        return;
      }

      if (!mode || !oobCode) {
        if (!cancelled) setViewState("invalid-link");
        return;
      }

      try {
        if (mode === "resetPassword") {
          const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
          if (!cancelled) {
            setEmail(verifiedEmail);
            setViewState("reset-form");
          }
          return;
        }

        if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);
          if (!cancelled) setViewState("verify-success");
          return;
        }

        if (!cancelled) setViewState("unsupported");
      } catch (err) {
        console.error("Auth action failed:", err);
        if (!cancelled) {
          setViewState("invalid-link");
          setError("This link is invalid or has expired.");
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [auth, mode, oobCode]);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode || submitting || !auth) return;

    setError(null);

    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    const passwordError = validatePassword(newPassword, email);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);

      if (email) {
        await sendResetConfirmationEmail(email);
      }

      setViewState("reset-success");
    } catch (err: any) {
      console.error("Password reset confirmation failed:", err);
      const code = err?.code || "";

      if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
        setViewState("invalid-link");
        setError("This reset link is invalid or has expired.");
      } else if (code === "auth/weak-password") {
        setError("Choose a stronger password.");
      } else {
        setError("Unable to reset password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goToLogin = () => {
    const resolved = resolvePostAuthDestination({
      search: searchParams.toString() ? `?${searchParams.toString()}` : "",
      explicitDestination: continueUrl,
      fallback: "/login",
    });
    trackAuthEvent("auth.destination.resolved", {
      source: "auth-action",
      destination: resolved.destination,
      resultSource: resolved.source,
      usedFallback: resolved.usedFallback,
    });
    if (resolved.usedFallback) {
      trackAuthEvent("auth.destination.fallback_used", {
        source: "auth-action",
        destination: resolved.destination,
      });
    }
    navigate(resolved.destination, { replace: true });
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
      <Card elevated style={{ width: "100%", maxWidth: 520, padding: spacing.lg }}>
        <div style={{ marginBottom: spacing.xs, color: text.subtle, fontSize: "0.9rem" }}>
          RentChain Secure Access
        </div>

        {viewState === "loading" && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: spacing.sm, color: text.primary }}>
              Checking your link
            </h1>
            <p style={{ color: text.muted }}>Please wait while we validate your secure action link.</p>
          </>
        )}

        {viewState === "reset-form" && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: spacing.sm, color: text.primary }}>
              Set a new password
            </h1>

            <p style={{ color: text.muted, marginBottom: spacing.md }}>
              Resetting password for <strong>{maskEmail(email)}</strong>
            </p>

            <form onSubmit={handleResetSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                <span style={{ fontSize: "0.9rem", color: text.muted }}>New password</span>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                <span style={{ fontSize: "0.9rem", color: text.muted }}>Confirm new password</span>
                <Input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <div
                style={{
                  fontSize: "0.88rem",
                  color: text.muted,
                  background: colors.panel,
                  borderRadius: 12,
                  padding: spacing.sm,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>Password requirements</div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  {passwordRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>

              {error && (
                <div style={{ fontSize: "0.9rem", color: colors.danger }}>
                  {error}
                </div>
              )}

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
                {submitting ? "Updating..." : "Update password"}
              </Button>
            </form>

            <div style={{ marginTop: spacing.sm }}>
              <Link to="/login" style={{ color: colors.accent, fontWeight: 600, fontSize: "0.9rem" }}>
                Back to login
              </Link>
            </div>
          </>
        )}

        {viewState === "reset-success" && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: spacing.sm, color: text.primary }}>
              Password updated
            </h1>
            <p style={{ color: text.muted, marginBottom: spacing.md }}>
              Your password has been changed successfully. Please sign in with your new password.
            </p>

            <Button
              type="button"
              onClick={goToLogin}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Back to login
            </Button>
          </>
        )}

        {viewState === "verify-success" && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: spacing.sm, color: text.primary }}>
              Email verified
            </h1>
            <p style={{ color: text.muted, marginBottom: spacing.md }}>
              Your email has been verified successfully.
            </p>

            <Button
              type="button"
              onClick={goToLogin}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Continue
            </Button>
          </>
        )}

        {viewState === "invalid-link" && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: spacing.sm, color: text.primary }}>
              Link expired or invalid
            </h1>
            <p style={{ color: text.muted, marginBottom: spacing.sm }}>
              {authError || error || "This secure link is no longer valid."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <Link to="/forgot-password" style={{ color: colors.accent, fontWeight: 600 }}>
                Send a new reset email
              </Link>
              <Link to="/login" style={{ color: colors.accent, fontWeight: 600 }}>
                Back to login
              </Link>
            </div>
          </>
        )}

        {viewState === "unsupported" && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: spacing.sm, color: text.primary }}>
              Unsupported action
            </h1>
            <p style={{ color: text.muted, marginBottom: spacing.md }}>
              This action type is not supported by this page.
            </p>

            <Link to="/login" style={{ color: colors.accent, fontWeight: 600 }}>
              Back to login
            </Link>
          </>
        )}
      </Card>
    </div>
  );
};

export default AuthActionPage;
