import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, Input, Button } from "../components/ui/Ui";
import { colors, spacing, text } from "../styles/tokens";
import { useAuth } from "../context/useAuth";
import { resolvePostAuthDestination } from "../lib/authDestination";
import { trackAuthEvent } from "../lib/authAnalytics";

function maskEmail(value: string): string {
  const email = String(value || "").trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `${local[0] || "*"}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup, isLoading, user } = useAuth();
  const searchParams = new URLSearchParams(location.search);
  const nextPath = React.useMemo(() => {
    const resolved = resolvePostAuthDestination({
      search: location.search,
      role: String(user?.actorRole || user?.role || "").toLowerCase() || undefined,
      fallback: "/dashboard",
    });
    trackAuthEvent("auth.destination.resolved", {
      source: "signup",
      resultSource: resolved.source,
      destination: resolved.destination,
      usedFallback: resolved.usedFallback,
    });
    if (resolved.usedFallback) {
      trackAuthEvent("auth.destination.fallback_used", {
        source: "signup",
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
    console.info("[auth-shell] signup onboarding context", {
      nextPath,
      onboardSource,
      inviteContextType,
    });
  }, [inviteContextType, nextPath, onboardSource]);

  const inviteBanner = React.useMemo(() => {
    if (inviteContextType === "contractor") {
      return {
        title: "Complete your contractor invitation",
        body: "Create your account to accept this RentChain contractor invitation and access assigned work orders.",
      };
    }
    if (inviteContextType === "tenant") {
      return {
        title: "Complete your tenant invitation",
        body: "Create your account to accept this RentChain tenant invitation and access your tenant workspace.",
      };
    }
    if (inviteContextType === "landlord") {
      return {
        title: "Complete your landlord setup",
        body: "Create your account to continue your RentChain landlord workspace setup.",
      };
    }
    return null;
  }, [inviteContextType]);
  const contractorOnboardContext = React.useMemo(() => {
    if (!nextPath.startsWith("/auth/onboard?")) {
      return { token: "", source: "" };
    }
    try {
      const nextUrl = new URL(nextPath, window.location.origin);
      const token = String(nextUrl.searchParams.get("token") || "").trim();
      const source = String(nextUrl.searchParams.get("source") || "").trim().toLowerCase();
      return { token, source };
    } catch {
      return { token: "", source: "" };
    }
  }, [nextPath]);
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
      const normalizedEmail = email.trim().toLowerCase();
      const isContractorOnboardSignup =
        contractorOnboardContext.source === "contractor" && Boolean(contractorOnboardContext.token);
      if (import.meta.env.DEV && isContractorOnboardSignup) {
        console.info("[signup] contractor invite context detected", {
          email: maskEmail(normalizedEmail),
          source: contractorOnboardContext.source,
          hasToken: Boolean(contractorOnboardContext.token),
          destination: nextPath,
        });
      }
      await signup(normalizedEmail, password, fullName.trim() || undefined, {
        inviteToken: isContractorOnboardSignup ? contractorOnboardContext.token : undefined,
        inviteSource: isContractorOnboardSignup ? "contractor" : undefined,
      });
      if (import.meta.env.DEV) {
        console.info("[signup] completed", {
          email: maskEmail(normalizedEmail),
          destination: nextPath,
          contractorContext: isContractorOnboardSignup,
        });
      }
      trackAuthEvent("auth.onboard.signup_completed", { destination: nextPath });
      navigate(nextPath, { replace: true });
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
          Create your RentChain account
        </h1>
        <p style={{ marginTop: 0, color: text.muted }}>
          Create an account to access your RentChain workspace.
        </p>
        {inviteBanner ? (
          <div
            style={{
              marginBottom: spacing.sm,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(37,99,235,0.08)",
              border: "1px solid rgba(37,99,235,0.25)",
              color: "#1d4ed8",
              fontSize: "0.9rem",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{inviteBanner.title}</div>
            <div>{inviteBanner.body}</div>
          </div>
        ) : null}

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
          <Link
            to={nextPath !== "/dashboard" ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
            style={{ color: colors.accent, textDecoration: "none", fontWeight: 600 }}
          >
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
