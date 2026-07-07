import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getTenantWorkspace,
  redeemTenantWorkspaceInvite,
  type TenantWorkspaceContext,
} from "../../api/tenantPortal";
import { TenantInfoCard, TenantSurfaceShell } from "./TenantWorkspaceShared";
import { radius, spacing, text as textTokens } from "../../styles/tokens";
import { buildTenantApplicationEntryPath } from "./tenantApplicationFlow";
import { buildTenantWorkspaceModeView } from "./tenantWorkspaceMode";
import TenantWorkspaceModeBanner from "./TenantWorkspaceModeBanner";
import {
  tenantEntryGhostButtonStyle,
  tenantEntryLinkStyle,
  tenantEntryPalette,
  tenantEntryPrimaryLinkStyle,
} from "./tenantEntryStyles";

function canLoadWorkspaceModeContext() {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof window.location !== "undefined" &&
    Boolean((import.meta as any)?.env?.VITE_API_BASE_URL)
  );
}

function mapInviteError(input: string | null) {
  const normalized = String(input || "").trim().toLowerCase();
  if (normalized === "invite_expired") return "This invite has expired. Ask your landlord to send a new one.";
  if (normalized === "invite_used") return "This invite was already redeemed.";
  if (normalized === "invite_not_found") return "We couldn't find an invite with that token.";
  if (normalized === "invite_email_mismatch") {
    return "This invite is tied to a different email address than your current tenant session.";
  }
  return "We couldn't redeem that invite right now.";
}

function getInviteErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const payload = "payload" in error ? (error as { payload?: { error?: unknown } }).payload : undefined;
    const message = "message" in error ? (error as { message?: unknown }).message : null;
    return mapInviteError(
      typeof payload?.error === "string" ? payload.error : typeof message === "string" ? message : null
    );
  }

  return mapInviteError(typeof error === "string" ? error : null);
}

export default function TenantInviteRedeemPage() {
  const location = useLocation();
  const [workspace, setWorkspace] = React.useState<Awaited<ReturnType<typeof getTenantWorkspace>> | null>(null);
  const prefilledToken = React.useMemo(
    () => String(new URLSearchParams(location.search).get("token") || "").trim(),
    [location.search]
  );
  const [token, setToken] = React.useState(prefilledToken);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<{
    inviteId: string | null;
    propertyId: string | null;
    applicationId: string | null;
    rc_prop_id: string | null;
    status: string | null;
  } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token.trim()) {
      setError("Enter an invite token to continue.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await redeemTenantWorkspaceInvite(token.trim());
      setSuccess(result);
      setToken("");
    } catch (err: unknown) {
      setError(getInviteErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    setToken(prefilledToken);
  }, [prefilledToken]);

  React.useEffect(() => {
    if (!canLoadWorkspaceModeContext()) {
      return;
    }
    let cancelled = false;
    const workspaceRequest = getTenantWorkspace();
    if (!workspaceRequest || typeof (workspaceRequest as Promise<unknown>).then !== "function") {
      return;
    }
    void workspaceRequest
      .then((next) => {
        if (!cancelled && canLoadWorkspaceModeContext()) {
          setWorkspace(next);
        }
      })
      .catch(() => {
        if (!cancelled && canLoadWorkspaceModeContext()) {
          setWorkspace(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const nextApplicationPath = success
    ? buildTenantApplicationEntryPath({ entry: "invite", token: success.applicationId || success.inviteId || prefilledToken })
    : buildTenantApplicationEntryPath({ entry: "invite", token: prefilledToken });
  const modeContext: TenantWorkspaceContext = workspace?.context || {
    authority: "invite",
    propertyId: null,
    rc_prop_id: null,
    applicationId: null,
    leaseId: null,
    tenantId: null,
    unitId: null,
    invitedEmail: null,
  };
  const modeView = buildTenantWorkspaceModeView(modeContext);

  return (
    <TenantSurfaceShell
      title="Redeem invite"
      subtitle="Use an invite from your landlord or property manager to connect this tenant workspace."
    >
      <TenantWorkspaceModeBanner view={modeView} />

      <TenantInfoCard heading="Invite redemption" accent={tenantEntryPalette.charcoal}>
        <form onSubmit={submit} style={{ display: "grid", gap: spacing.md }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: textTokens.muted }}>Invite token</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste your invite token"
              style={{
                padding: "11px 12px",
                borderRadius: radius.md,
                border: `1px solid ${tenantEntryPalette.fieldBorder}`,
                background: tenantEntryPalette.field,
                color: tenantEntryPalette.ink,
              }}
            />
          </label>

          {error ? (
            <div
              role="alert"
              style={{
                border: "1px solid rgba(180, 35, 24, 0.24)",
                borderRadius: radius.md,
                background: "rgba(254, 242, 242, 0.92)",
                color: tenantEntryPalette.danger,
                padding: "10px 12px",
              }}
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div
              style={{
                border: `1px solid ${tenantEntryPalette.sageBorder}`,
                borderRadius: radius.md,
                background: tenantEntryPalette.sage,
                color: tenantEntryPalette.ink,
                padding: "12px 14px",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 800 }}>Invite redeemed</div>
              <div>Your tenant workspace is connected. Continue when you are ready.</div>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                <Link to={nextApplicationPath} style={tenantEntryLinkStyle}>
                  Continue to application readiness
                </Link>
                <Link to="/tenant" style={tenantEntryLinkStyle}>
                  Return to workspace
                </Link>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "10px 14px",
                borderRadius: radius.md,
                border: 0,
                ...tenantEntryPrimaryLinkStyle,
                minHeight: "auto",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.72 : 1,
              }}
            >
              {submitting ? "Redeeming..." : "Redeem invite"}
            </button>
            <Link
              to="/tenant"
              style={{
                ...tenantEntryGhostButtonStyle,
                alignSelf: "center",
                textDecoration: "none",
              }}
            >
              Back to workspace
            </Link>
          </div>
        </form>
      </TenantInfoCard>
    </TenantSurfaceShell>
  );
}
