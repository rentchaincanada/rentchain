import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTenantAccess,
  revokeTenantAccessShare,
  type TenantAccessActivity,
  type TenantAccessGrant,
  type TenantAccessWorkspace,
} from "../../api/tenantAccess";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantLoadingState,
  TenantSurfaceShell,
  TenantUnauthorizedState,
  formatDate,
} from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";

function activityLabel(item: TenantAccessActivity) {
  switch (item.type) {
    case "access_viewed":
      return "Viewed";
    case "access_revoked":
      return "Revoked";
    case "access_expired":
      return "Expired";
    default:
      return "Shared";
  }
}

function statusTone(status: TenantAccessGrant["status"]) {
  switch (status) {
    case "revoked":
      return { label: "Revoked", color: "#991b1b", background: "#fee2e2" };
    case "expired":
      return { label: "Expired", color: "#9a3412", background: "#ffedd5" };
    default:
      return { label: "Active", color: "#166534", background: "#dcfce7" };
  }
}

export default function TenantAccessPage() {
  const [data, setData] = useState<TenantAccessWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await getTenantAccess();
        if (!cancelled) setData(next);
      } catch (err: any) {
        if (!cancelled) setError(err?.payload?.error || err?.message || "Unable to load access details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRevoke = async (shareId: string) => {
    setRevokingId(shareId);
    setActionError(null);
    setActionMessage(null);
    try {
      await revokeTenantAccessShare(shareId);
      const next = await getTenantAccess();
      setData(next);
      setActionMessage("Access revoked.");
    } catch (err: any) {
      setActionError(err?.payload?.error || err?.message || "Unable to revoke access right now.");
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <TenantSurfaceShell
        title="Access"
        subtitle="Review what you’ve shared, any open requests, and the access that is currently active."
      >
        <TenantLoadingState label="Loading access visibility..." />
      </TenantSurfaceShell>
    );
  }

  if (error) {
    const unauthorized = /unauthorized|forbidden|ambiguous/i.test(error);
    return (
      <TenantSurfaceShell
        title="Access"
        subtitle="This page only shows tenant-safe access details tied to your current rental context."
      >
        {unauthorized ? <TenantUnauthorizedState /> : <TenantErrorState message={error} />}
      </TenantSurfaceShell>
    );
  }

  const summary = data?.summary;
  const activeAccess = data?.activeAccess || [];
  const pendingRequests = data?.pendingRequests || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <TenantSurfaceShell
      title="Access"
      subtitle="Manage who can view your profile information and review what you’ve already shared with your permission."
      action={
        <Link
          to="/tenant/profile"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px 12px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 700,
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          View profile
        </Link>
      }
    >
      <TenantInfoCard heading="Access Summary" accent="#0f766e">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: spacing.sm,
          }}
        >
          <div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#0f766e" }}>
              {summary?.activeGrants || 0}
            </div>
            <div style={{ color: textTokens.secondary, fontWeight: 700 }}>Active access grants</div>
          </div>
          <div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#1d4ed8" }}>
              {summary?.pendingRequests || 0}
            </div>
            <div style={{ color: textTokens.secondary, fontWeight: 700 }}>Pending requests</div>
          </div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: textTokens.primary }}>
              {formatDate(summary?.latestActivityAt)}
            </div>
            <div style={{ color: textTokens.secondary, fontWeight: 700 }}>Latest access activity</div>
          </div>
        </div>
        <div style={{ color: textTokens.secondary, marginTop: spacing.sm }}>
          {data?.guidance?.headline || "You can manage who can view your profile here."}
        </div>
        <div style={{ color: textTokens.muted }}>{data?.guidance?.body}</div>
        {actionError ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{actionError}</div> : null}
        {actionMessage ? <div style={{ color: "#166534", fontWeight: 600 }}>{actionMessage}</div> : null}
      </TenantInfoCard>

      <TenantInfoCard heading="Access Requests" accent="#1d4ed8">
        {pendingRequests.length ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 800, color: textTokens.primary }}>{request.requestedByLabel}</div>
                <div style={{ color: textTokens.secondary }}>{request.categories.join(", ")}</div>
                <div style={{ color: textTokens.muted }}>
                  Requested: <strong>{formatDate(request.requestedAt)}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TenantEmptyState
            title="No access requests right now"
            body="When someone asks to view profile information through a supported tenant-safe flow, you’ll be able to review it here."
          />
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Active Access" accent="#0891b2">
        {activeAccess.length ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {activeAccess.map((grant) => {
              const tone = statusTone(grant.status);
              return (
                <div
                  key={grant.id}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: textTokens.primary }}>{grant.grantedToLabel}</div>
                      <div style={{ color: textTokens.secondary }}>{grant.categories.join(", ")}</div>
                    </div>
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: tone.color,
                        background: tone.background,
                      }}
                    >
                      {tone.label}
                    </div>
                  </div>

                  <div style={{ color: textTokens.secondary }}>{grant.accessLabel}</div>

                  <div style={{ color: textTokens.muted }}>
                    Shared: <strong>{formatDate(grant.grantedAt)}</strong>
                    {grant.lastActivityAt ? (
                      <>
                        {" • "}Last activity: <strong>{formatDate(grant.lastActivityAt)}</strong>
                      </>
                    ) : null}
                  </div>

                  {grant.canRevoke ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => void handleRevoke(grant.id)}
                        disabled={revokingId === grant.id}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(15,23,42,0.12)",
                          background: "#fff",
                          color: textTokens.primary,
                          fontWeight: 700,
                          cursor: revokingId === grant.id ? "wait" : "pointer",
                        }}
                      >
                        {revokingId === grant.id ? "Revoking..." : "Revoke access"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <TenantEmptyState
            title="Nothing shared yet"
            body="When you share supported profile information, active access will appear here so you can review it clearly."
            action={
              <Link to="/tenant/profile" style={{ fontWeight: 700 }}>
                Review your profile
              </Link>
            }
          />
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Recent Activity" accent="#7c3aed">
        {recentActivity.length ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {recentActivity.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 800, color: textTokens.primary }}>{item.title}</div>
                <div style={{ color: textTokens.secondary }}>{activityLabel(item)}</div>
                <div style={{ color: textTokens.muted }}>
                  <strong>{formatDate(item.occurredAt)}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TenantEmptyState
            title="No recent access activity"
            body="Recent sharing activity will appear here when supported access events are available in your tenant record."
          />
        )}
      </TenantInfoCard>
    </TenantSurfaceShell>
  );
}
