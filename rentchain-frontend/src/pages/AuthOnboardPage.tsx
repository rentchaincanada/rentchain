import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, Button } from "../components/ui/Ui";
import { colors, spacing, text } from "../styles/tokens";
import { apiFetch } from "../api/apiFetch";
import { useAuth } from "../context/useAuth";
import { setTenantToken } from "../lib/tenantAuth";
import { clearAuthToken } from "../lib/authToken";
import {
  buildOnboardContinuationPath,
  getRoleDefaultDestination,
  getSafeInternalRedirect,
  resolvePostAuthDestination,
} from "../lib/authDestination";
import { fingerprintToken, trackAuthEvent } from "../lib/authAnalytics";

/**
 * Auth onboarding gateway inventory (v1):
 * - /invite and /invite/:token -> landlord invite/redeem via /api/invites/redeem -> /dashboard
 * - /tenant/invite/:token -> tenant invite alias resolve/accept -> /tenant
 * - /contractor/invite/:token -> contractor invite resolve/redeem -> /contractor
 * - /tenant/magic stays specialized for now (magic-link token flow)
 */

type ViewState =
  | "loading"
  | "invalid"
  | "expired"
  | "already-accepted"
  | "login-required"
  | "signup-required"
  | "wrong-account"
  | "ready-to-accept"
  | "accepting"
  | "success"
  | "error";

type InviteType = "landlord" | "tenant" | "contractor" | "unknown";

type ResolvePayload = {
  ok: boolean;
  token: string;
  inviteType: InviteType;
  role: "landlord" | "tenant" | "contractor" | "admin" | null;
  email: string | null;
  maskedEmail: string | null;
  status: "valid" | "expired" | "invalid" | "accepted";
  requiresAuth: boolean;
  requiresSignup: boolean;
  requiresExistingAccount: boolean;
  alreadyAccepted: boolean;
  workspaceId: string | null;
  propertyId: string | null;
  inviteId: string | null;
  redirectTo: string | null;
  legacyRedirectTo?: string | null;
  suggestedAuthMethod?: "password" | "magic_link" | "password_or_magic" | null;
  copy: {
    title: string;
    description: string;
    cta: string;
  };
};

type AcceptPayload = {
  ok: boolean;
  accepted?: boolean;
  role?: "landlord" | "tenant" | "contractor" | "admin" | null;
  redirectTo?: string | null;
  workspaceId?: string | null;
  propertyId?: string | null;
  tenantToken?: string | null;
  message?: string;
  code?: string;
  expectedEmail?: string | null;
  maskedExpectedEmail?: string | null;
};

const AuthOnboardPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const token = String(params.get("token") || "").trim();
  const source = String(params.get("source") || "").trim().toLowerCase();

  const [viewState, setViewState] = React.useState<ViewState>("loading");
  const [resolved, setResolved] = React.useState<ResolvePayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [wrongAccountMaskedEmail, setWrongAccountMaskedEmail] = React.useState<string | null>(null);

  const nextOnboardPath = React.useMemo(() => buildOnboardContinuationPath(token, source), [token, source]);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setViewState("invalid");
        setError("Invite token missing.");
        trackAuthEvent("auth.onboard.invalid", { reason: "missing_token" });
        return;
      }

      setViewState("loading");
      setError(null);
      setWrongAccountMaskedEmail(null);

      try {
        const query = new URLSearchParams({ token });
        if (source) query.set("source", source);
        const data = await apiFetch<ResolvePayload>(`/auth/onboard/resolve?${query.toString()}`, {
          method: "GET",
          allowStatuses: [404, 410],
        });
        trackAuthEvent("auth.onboard.resolved", {
          inviteType: data?.inviteType || "unknown",
          status: data?.status || "invalid",
          tokenFingerprint: fingerprintToken(token),
        });
        if (cancelled) return;
        setResolved(data);

        if (!data?.ok || data.status === "invalid") {
          setViewState("invalid");
          trackAuthEvent("auth.onboard.invalid", {
            inviteType: data?.inviteType || "unknown",
            status: data?.status || "invalid",
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }
        if (data.status === "expired") {
          setViewState("expired");
          trackAuthEvent("auth.onboard.expired", {
            inviteType: data.inviteType,
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }
        if (data.status === "accepted") {
          setViewState("already-accepted");
          trackAuthEvent("auth.onboard.already_accepted", {
            inviteType: data.inviteType,
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }

        const role = String(user?.actorRole || user?.role || "").toLowerCase();
        const email = String(user?.email || "").trim().toLowerCase();
        const invitedEmail = String(data.email || "").trim().toLowerCase();
        const requiresAuth = Boolean(data.requiresAuth);
        const requiresSignup = Boolean(data.requiresSignup);

        if (requiresAuth && !user) {
          setViewState("login-required");
          trackAuthEvent("auth.onboard.login_required", {
            inviteType: data.inviteType,
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }
        if (requiresSignup && !user) {
          setViewState("signup-required");
          trackAuthEvent("auth.onboard.signup_required", {
            inviteType: data.inviteType,
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }
        if (user && invitedEmail && email && invitedEmail !== email) {
          setWrongAccountMaskedEmail(data.maskedEmail || null);
          setViewState("wrong-account");
          trackAuthEvent("auth.onboard.wrong_account", {
            inviteType: data.inviteType,
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }
        if (user && (role === "admin" || role === "landlord") && data.inviteType === "contractor") {
          setWrongAccountMaskedEmail(data.maskedEmail || null);
          setViewState("wrong-account");
          trackAuthEvent("auth.onboard.wrong_account", {
            inviteType: data.inviteType,
            role,
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }
        if (user && (role === "admin" || role === "landlord" || role === "contractor") && data.inviteType === "tenant") {
          setWrongAccountMaskedEmail(data.maskedEmail || null);
          setViewState("wrong-account");
          trackAuthEvent("auth.onboard.wrong_account", {
            inviteType: data.inviteType,
            role,
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }

        setViewState("ready-to-accept");
        trackAuthEvent("auth.onboard.opened", {
          inviteType: data.inviteType,
          tokenFingerprint: fingerprintToken(token),
        });
      } catch (err: any) {
        if (cancelled) return;
        setError(String(err?.message || "Unable to resolve invite."));
        setViewState("error");
        trackAuthEvent("auth.onboard.failed", {
          phase: "resolve",
          tokenFingerprint: fingerprintToken(token),
        });
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token, source, user?.actorRole, user?.role, user?.email, user?.id]);

  const doAccept = async () => {
    if (!token || !resolved) return;
    setViewState("accepting");
    setError(null);
    trackAuthEvent("auth.onboard.accept_clicked", {
      inviteType: resolved.inviteType,
      tokenFingerprint: fingerprintToken(token),
    });
    try {
      const payload = await apiFetch<AcceptPayload>("/auth/onboard/accept", {
        method: "POST",
        body: { token, source },
        allowStatuses: [401, 404, 409, 410],
      });

      if (!payload?.ok) {
        const code = String(payload?.code || "");
        if (code === "login_required") {
          setViewState("login-required");
          trackAuthEvent("auth.onboard.login_required", {
            inviteType: resolved.inviteType,
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }
        if (code === "signup_required") {
          setViewState("signup-required");
          return;
        }
        if (code === "wrong_account") {
          setWrongAccountMaskedEmail(payload.maskedExpectedEmail || resolved.maskedEmail || null);
          setViewState("wrong-account");
          trackAuthEvent("auth.onboard.wrong_account", {
            inviteType: resolved.inviteType,
            tokenFingerprint: fingerprintToken(token),
          });
          return;
        }
        if (code === "expired") {
          setViewState("expired");
          return;
        }
        if (code === "invalid") {
          setViewState("invalid");
          return;
        }
        throw new Error(payload?.message || "Unable to accept invite.");
      }

      if (payload.tenantToken) {
        setTenantToken(payload.tenantToken);
        try {
          clearAuthToken();
        } catch {
          // ignore
        }
      }
      setViewState("success");
      const redirectResolved = resolvePostAuthDestination({
        explicitDestination: payload.redirectTo || resolved.redirectTo,
        role: (payload.role || resolved.role) as any,
        fallback: "/dashboard",
      });
      trackAuthEvent("auth.destination.resolved", {
        source: "onboard-accept",
        destination: redirectResolved.destination,
        resultSource: redirectResolved.source,
        usedFallback: redirectResolved.usedFallback,
      });
      if (redirectResolved.usedFallback) {
        trackAuthEvent("auth.destination.fallback_used", {
          source: "onboard-accept",
          destination: redirectResolved.destination,
        });
      }
      trackAuthEvent("auth.onboard.accept_succeeded", {
        inviteType: resolved.inviteType,
        role: payload.role || resolved.role,
        destination: redirectResolved.destination,
        tokenFingerprint: fingerprintToken(token),
      });
      setTimeout(() => {
        navigate(redirectResolved.destination || "/dashboard", { replace: true });
      }, 400);
    } catch (err: any) {
      setError(String(err?.message || "Unable to accept invite."));
      setViewState("error");
      trackAuthEvent("auth.onboard.accept_failed", {
        phase: "accept",
        inviteType: resolved.inviteType,
        tokenFingerprint: fingerprintToken(token),
      });
    }
  };

  const loginPath = `/login?next=${encodeURIComponent(nextOnboardPath)}`;
  const signupPath = `/signup?next=${encodeURIComponent(nextOnboardPath)}`;
  const legacyPath = getSafeInternalRedirect(resolved?.legacyRedirectTo || null);

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
      <Card elevated style={{ width: "100%", maxWidth: 560, padding: spacing.lg, display: "grid", gap: spacing.sm }}>
        <div style={{ marginBottom: spacing.xs, color: text.subtle, fontSize: "0.9rem" }}>
          RentChain Secure Onboarding
        </div>

        {viewState === "loading" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Checking your invite</h1>
            <p style={{ margin: 0, color: text.muted }}>Please wait while we verify your secure onboarding link.</p>
          </>
        ) : null}

        {viewState === "invalid" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Invite not found</h1>
            <p style={{ margin: 0, color: text.muted }}>
              {resolved?.copy?.description || "This invite is invalid or no longer available."}
            </p>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Link to="/login"><Button>Back to login</Button></Link>
              <Link to="/request-access"><Button variant="secondary">Request access</Button></Link>
            </div>
          </>
        ) : null}

        {viewState === "expired" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Invite expired</h1>
            <p style={{ margin: 0, color: text.muted }}>
              {resolved?.copy?.description || "This invite has expired. Request a new invite to continue."}
            </p>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Link to="/request-access"><Button>Request new invite</Button></Link>
              <Link to="/login"><Button variant="secondary">Back to login</Button></Link>
            </div>
          </>
        ) : null}

        {viewState === "already-accepted" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Invite accepted</h1>
            <p style={{ margin: 0, color: text.muted }}>
              Your access has already been configured. Continue to your workspace.
            </p>
            <Button
              onClick={() => {
                const path =
                  getSafeInternalRedirect(resolved?.redirectTo) ||
                  getRoleDefaultDestination((resolved?.role || user?.actorRole || user?.role) as any);
                navigate(path || "/dashboard", { replace: true });
              }}
            >
              Continue
            </Button>
          </>
        ) : null}

        {viewState === "login-required" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Sign in to continue</h1>
            <p style={{ margin: 0, color: text.muted }}>
              This invite is ready. Sign in with the invited account to continue.
            </p>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Link to={loginPath}><Button>Go to login</Button></Link>
              <Link to={signupPath}><Button variant="secondary">Go to signup</Button></Link>
              {resolved?.inviteType === "tenant" &&
              (resolved?.suggestedAuthMethod === "magic_link" || resolved?.suggestedAuthMethod === "password_or_magic") ? (
                <Link
                  to={`/tenant/login?next=${encodeURIComponent(nextOnboardPath)}&token=${encodeURIComponent(
                    token
                  )}${source ? `&source=${encodeURIComponent(source)}` : ""}`}
                >
                  <Button
                    variant="ghost"
                    onClick={() =>
                      trackAuthEvent("auth.onboard.magic_link_requested", {
                        inviteType: resolved.inviteType,
                        tokenFingerprint: fingerprintToken(token),
                        destination: nextOnboardPath,
                      })
                    }
                  >
                    Use magic link
                  </Button>
                </Link>
              ) : null}
            </div>
          </>
        ) : null}

        {viewState === "signup-required" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Create your account</h1>
            <p style={{ margin: 0, color: text.muted }}>
              Complete your account setup to accept this invite.
            </p>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              {legacyPath ? (
                <Link to={legacyPath}><Button>Continue to signup</Button></Link>
              ) : (
                <Link to={signupPath}><Button>Continue to signup</Button></Link>
              )}
              <Link to={loginPath}><Button variant="secondary">Go to login</Button></Link>
            </div>
          </>
        ) : null}

        {viewState === "wrong-account" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Wrong account signed in</h1>
            <p style={{ margin: 0, color: text.muted }}>
              This invite must be accepted by the exact invited email address.
            </p>
            {wrongAccountMaskedEmail ? (
              <p style={{ margin: 0, color: text.muted }}>
                Expected account: <strong>{wrongAccountMaskedEmail}</strong>
              </p>
            ) : null}
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button
                onClick={async () => {
                  await logout();
                  navigate(loginPath, { replace: true });
                }}
              >
                Sign out and continue
              </Button>
              <Link to="/login"><Button variant="secondary">Back to login</Button></Link>
            </div>
          </>
        ) : null}

        {viewState === "ready-to-accept" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>
              {resolved?.copy?.title || "You’re invited to join RentChain"}
            </h1>
            <p style={{ margin: 0, color: text.muted }}>
              {resolved?.copy?.description || "Accept this invite to continue."}
            </p>
            {resolved?.maskedEmail ? (
              <p style={{ margin: 0, color: text.muted }}>
                Invited account: <strong>{resolved.maskedEmail}</strong>
              </p>
            ) : null}
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button onClick={doAccept}>Accept invite</Button>
              <Link to="/login"><Button variant="secondary">Cancel</Button></Link>
            </div>
          </>
        ) : null}

        {viewState === "accepting" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Accepting invite</h1>
            <p style={{ margin: 0, color: text.muted }}>Please wait while we configure your access.</p>
          </>
        ) : null}

        {viewState === "success" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Invite accepted</h1>
            <p style={{ margin: 0, color: text.muted }}>Your access has been configured successfully.</p>
            <p style={{ margin: 0, color: text.muted }}>Redirecting you now...</p>
          </>
        ) : null}

        {viewState === "error" ? (
          <>
            <h1 style={{ margin: 0, color: text.primary, fontSize: "1.5rem" }}>Unable to continue</h1>
            <p style={{ margin: 0, color: colors.danger }}>
              {error || "Something went wrong while processing your invite."}
            </p>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button onClick={() => window.location.reload()}>Try again</Button>
              <Link to="/login"><Button variant="secondary">Back to login</Button></Link>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
};

export default AuthOnboardPage;
