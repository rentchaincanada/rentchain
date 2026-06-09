// src/pages/LoginPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { colors, text } from "../styles/tokens";
import { Button } from "../components/ui/Ui";
import { LoginForm } from "../components/auth/LoginForm";
import { DEBUG_AUTH_KEY, JUST_LOGGED_IN_KEY } from "../lib/authKeys";
import { getAuthToken } from "../lib/authToken";
import { useToast } from "../components/ui/ToastProvider";
import { resolvePostAuthDestination } from "../lib/authDestination";
import { trackAuthEvent } from "../lib/authAnalytics";

export const LoginPage: React.FC = () => {
  const { login, loginDemo, user, isLoading, isTwoFactorRequired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const searchParams = new URLSearchParams(location.search);
  const expired = searchParams.get("reason") === "expired";

  const nextPath = React.useMemo(() => {
    const resolved = resolvePostAuthDestination({
      search: location.search,
      role: String(user?.actorRole || user?.role || "").toLowerCase() || undefined,
      fallback: "/dashboard",
    });
    trackAuthEvent("auth.destination.resolved", {
      source: "login",
      resultSource: resolved.source,
      destination: resolved.destination,
      usedFallback: resolved.usedFallback,
    });
    if (resolved.usedFallback) {
      trackAuthEvent("auth.destination.fallback_used", {
        source: "login",
        destination: resolved.destination,
      });
    }
    return resolved.destination;
  }, [location.search, user?.actorRole, user?.role]);
  const inviteContextType = React.useMemo<"contractor" | "tenant" | "landlord" | null>(() => {
    if (nextPath.startsWith("/contractor/invite/") || nextPath.startsWith("/contractor/signup?invite=")) {
      return "contractor";
    }
    if (nextPath.startsWith("/tenant/invite/")) {
      return "tenant";
    }
    if (!nextPath.startsWith("/auth/onboard?")) return null;
    try {
      const nextUrl = new URL(nextPath, window.location.origin);
      const source = String(nextUrl.searchParams.get("source") || "").trim().toLowerCase();
      if (source === "contractor" || source === "tenant" || source === "landlord") return source;
      return null;
    } catch {
      return null;
    }
  }, [nextPath]);
  const onboardSource = React.useMemo(() => {
    if (!nextPath.startsWith("/auth/onboard?")) return null;
    try {
      const nextUrl = new URL(nextPath, window.location.origin);
      return String(nextUrl.searchParams.get("source") || "").trim().toLowerCase() || null;
    } catch {
      return null;
    }
  }, [nextPath]);

  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!nextPath.startsWith("/auth/onboard?")) return;
    console.info("[auth-shell] login onboarding context", {
      nextPath,
      onboardSource,
      inviteContextType,
    });
  }, [inviteContextType, nextPath, onboardSource]);

  const inviteBanner = React.useMemo(() => {
    if (inviteContextType === "contractor") {
      return {
        title: "Contractor invitation detected",
        body: "Sign in or create an account to accept your RentChain contractor invitation.",
      };
    }
    if (inviteContextType === "tenant") {
      return {
        title: "Tenant invitation detected",
        body: "Sign in or create an account to accept your RentChain tenant invitation.",
      };
    }
    if (inviteContextType === "landlord") {
      return {
        title: "Landlord setup detected",
        body: "Sign in or create an account to continue your RentChain landlord setup.",
      };
    }
    return null;
  }, [inviteContextType]);

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
      if (nextPath.startsWith("/auth/onboard")) {
        trackAuthEvent("auth.onboard.password_login_completed", {
          destination: nextPath,
        });
      }
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
      if (nextPath.startsWith("/auth/onboard")) {
        trackAuthEvent("auth.onboard.password_login_completed", {
          destination: nextPath,
        });
      }
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
    <LoginForm
      title="Sign in to RentChain"
      subtitle="Sign in to continue to your workspace."
      roleLabel="Landlord and contractor access"
      email={email}
      onEmailChange={setEmail}
      password={password}
      onPasswordChange={setPassword}
      onSubmit={(event) => {
        event.preventDefault();
        void handleLoginClick();
      }}
      isLoading={submitting || isLoading}
      error={error}
      statusMessage={expired ? "Session expired. Please log in again." : "Sign in to continue to your workspace."}
      banner={
        expired
          ? { title: "Session expired", body: "Please log in again.", tone: "warning" }
          : inviteBanner
      }
      demoAction={
        import.meta.env.DEV ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDemoLogin}
            style={{ width: "100%" }}
          >
            Login as Demo (dev)
          </Button>
        ) : null
      }
      footer={
        <>
          <Link to="/signup" style={{ color: colors.accent, textDecoration: "none", fontWeight: 600 }}>
            Create free account
          </Link>
          <Link to="/tenant" style={{ color: colors.accent, textDecoration: "none", fontWeight: 600 }}>
            Are you a tenant? Access your profile
          </Link>
          <Link to="/request-access" style={{ color: text.muted, textDecoration: "none" }}>
            Request access
          </Link>
          <Link to="/invite" style={{ color: text.muted, textDecoration: "none" }}>
            Have an invite?
          </Link>
        </>
      }
    />
  );
};

export default LoginPage;
