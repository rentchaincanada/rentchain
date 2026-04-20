import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getTenantWorkspace,
  redeemTenantWorkspaceInvite,
  type TenantWorkspaceContext,
} from "../../api/tenantPortal";
import { TenantInfoCard, TenantSurfaceShell } from "./TenantWorkspaceShared";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";
import { buildTenantApplicationEntryPath } from "./tenantApplicationFlow";
import { buildTenantWorkspaceModeView } from "./tenantWorkspaceMode";
import TenantWorkspaceModeBanner from "./TenantWorkspaceModeBanner";

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
    } catch (err: any) {
      setError(mapInviteError(err?.payload?.error || err?.message || null));
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    setToken(prefilledToken);
  }, [prefilledToken]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let cancelled = false;
    void getTenantWorkspace()
      .then((next) => {
        if (!cancelled) {
          setWorkspace(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
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
      title="Redeem Invite"
      subtitle="Redeem a one-time tenancy invite from inside your authenticated tenant workspace. Invite redemption stays server-scoped and follows the backend token lifecycle rules."
    >
      <TenantWorkspaceModeBanner view={modeView} />

      <TenantInfoCard heading="Invite Redemption" accent="#0f766e">
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
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: textTokens.primary,
              }}
            />
          </label>

          {error ? (
            <div
              style={{
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: radius.md,
                background: "#fff7ed",
                color: "#9a3412",
                padding: "10px 12px",
              }}
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                background: "#ecfdf5",
                color: "#166534",
                padding: "12px 14px",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 800 }}>Invite redeemed</div>
              <div>Status: {success.status || "redeemed"}</div>
              {success.propertyId ? <div>Property: {success.propertyId}</div> : null}
              {success.applicationId ? <div>Application: {success.applicationId}</div> : null}
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                <Link to={nextApplicationPath}>Continue to application readiness</Link>
                <Link to="/tenant">Return to workspace</Link>
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
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: textTokens.primary,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Redeeming..." : "Redeem invite"}
            </button>
            <Link to="/tenant" style={{ alignSelf: "center" }}>
              Back to workspace
            </Link>
          </div>
        </form>
      </TenantInfoCard>
    </TenantSurfaceShell>
  );
}
