// src/pages/LoginPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { colors, spacing, text } from "../styles/tokens";
import { Card, Input, Button } from "../components/ui/Ui";
import { DEBUG_AUTH_KEY, JUST_LOGGED_IN_KEY } from "../lib/authKeys";
import { getAuthToken } from "../lib/authToken";
import { useToast } from "../components/ui/ToastProvider";

export const LoginPage: React.FC = () => {
  const { login, loginDemo, user, isLoading, isTwoFactorRequired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const searchParams = new URLSearchParams(location.search);
  const rawNext = searchParams.get("next");
  const expired = searchParams.get("reason") === "expired";

  const nextPath = React.useMemo(() => {
    if (!rawNext) return "/dashboard";
    try {
      const decoded = decodeURIComponent(rawNext);
      if (decoded.startsWith("/")) return decoded;
      return "/dashboard";
    } catch {
      return "/dashboard";
    }
  }, [rawNext]);

  const defaultEmail = import.meta.env.DEV ? "demo@rentchain.dev" : "";
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (user && !isTwoFactorRequired) {
      navigate(nextPath, { replace: true });
    }
  }, [user, isTwoFactorRequired, navigate, nextPath]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window.sessionStorage.getItem("authExpiredToast");
    if (flag) {
      window.sessionStorage.removeItem("authExpiredToast");
      showToast({ message: "Session expired. Please sign in again.", variant: "error" });
    }
  }, [showToast]);

  const handleDemoLogin = async () => {
    if (isSubmittingRef.current) return;

    setError(null);
    setSubmitting(true);
    isSubmittingRef.current = true;

    try {
      await loginDemo("core");
      const dbg = localStorage.getItem(DEBUG_AUTH_KEY) === "1";
      try {
        localStorage.setItem(JUST_LOGGED_IN_KEY, String(Date.now()));
        sessionStorage.setItem(JUST_LOGGED_IN_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      if (dbg) {
        const tok = getAuthToken();
        console.info("[auth debug] demo login stored", {
          tokenLen: tok?.length || 0,
        });
      }
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 150));
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Demo login failed");
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleLoginClick = async (
    override?: { email: string; password: string },
    opts?: RequestInit
  ) => {
    if (isSubmittingRef.current) return;

    setError(null);
    setSubmitting(true);
    isSubmittingRef.current = true;

    try {
      const creds = override ?? { email, password };
      const result = await login(creds.email, creds.password, opts);

      if (result.requires2fa) {
        navigate("/2fa", { replace: true });
        return;
      }

      const dbg = localStorage.getItem(DEBUG_AUTH_KEY) === "1";
      try {
        localStorage.setItem(JUST_LOGGED_IN_KEY, String(Date.now()));
        sessionStorage.setItem(JUST_LOGGED_IN_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      if (dbg) {
        const tok = getAuthToken();
        console.info("[auth debug] login stored", {
          tokenLen: tok?.length || 0,
        });
      }
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 150));
      navigate(nextPath, { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid email or password";
      setError(message || "Invalid email or password");
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
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
        overflowX: "hidden",
      }}
    >
      <Card elevated style={{ width: "min(460px, 92vw)", padding: spacing.lg }}>
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
          RentChain Landlord Login
        </h1>
        {new URLSearchParams(location.search).get("reason") === "expired" ? (
          <div
            style={{
              marginBottom: spacing.sm,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: colors.danger,
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Session expired. Please log in again.
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLoginClick();
          }}
          style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontSize: "0.9rem", color: text.muted }}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontSize: "0.9rem", color: text.muted }}>Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link
              to="/forgot-password"
              style={{ color: colors.accent, fontWeight: 600, fontSize: "0.9rem" }}
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            onClick={() => handleLoginClick()}
            disabled={submitting || isLoading}
            style={{
              width: "100%",
              opacity: submitting || isLoading ? 0.8 : 1,
              cursor: submitting || isLoading ? "not-allowed" : "pointer",
              justifyContent: "center",
            }}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </Button>

          {import.meta.env.DEV && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDemoLogin}
              style={{ width: "100%" }}
            >
              Login as Demo (dev)
            </Button>
          )}
        </form>

        <div
          style={{
            marginTop: spacing.sm,
            minHeight: "1.2rem",
            fontSize: "0.9rem",
            color: error ? colors.danger : text.muted,
          }}
        >
          {error
            ? error
            : expired
            ? "Session expired. Please log in again."
            : "Sign in to access your landlord workspace."}
        </div>
        <div style={{ marginTop: spacing.sm, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <Link to="/signup" style={{ color: colors.accent, textDecoration: "none", fontWeight: 600 }}>
            Create free account
          </Link>
          <Link to="/request-access" style={{ color: text.muted, textDecoration: "none" }}>
            Request access
          </Link>
          <Link to="/invite" style={{ color: text.muted, textDecoration: "none" }}>
            Have an invite?
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
