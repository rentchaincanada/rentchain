import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTenantNotifications, type TenantNotificationItem } from "../../api/tenantNotifications";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantLoadingState,
  TenantSurfaceShell,
  TenantUnauthorizedState,
  formatDate,
  prettyStatus,
} from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";
import { buildTenantStructuredActivityTimeline } from "../structuredActivityTimeline";

export default function TenantActivityPage() {
  const [items, setItems] = useState<TenantNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTenantNotifications();
        if (!cancelled) setItems(Array.isArray(res) ? res : []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Unable to load activity.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <TenantSurfaceShell
        title="Notifications & Feed"
        subtitle="Recent tenant-safe updates across your application, profile, communications, and tenancy."
      >
        <TenantLoadingState label="Loading your recent feed..." />
      </TenantSurfaceShell>
    );
  }

  if (error) {
    const unauthorized = /unauthorized|forbidden|ambiguous/i.test(error);
    return (
      <TenantSurfaceShell
        title="Notifications & Feed"
        subtitle="Only tenant-safe updates and system-visible events appear here."
      >
        {unauthorized ? <TenantUnauthorizedState /> : <TenantErrorState message={error} />}
      </TenantSurfaceShell>
    );
  }

  const timeline = buildTenantStructuredActivityTimeline(items);

  return (
    <TenantSurfaceShell
      title="Recent Activity"
      subtitle="Follow the recent timeline of tenant-safe workflow updates across your application, profile, documents, access, communications, and tenancy."
    >
      {timeline.length === 0 ? (
        <TenantEmptyState
          title="No recent activity yet"
          body="Timeline updates will appear here once your application, profile, or communications begin generating tenant-visible events."
        />
      ) : (
        <div style={{ display: "grid", gap: spacing.md }}>
          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: spacing.sm,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Timeline summary</div>
            <div style={{ color: textTokens.secondary }}>
              {timeline.filter((item) => item.actionRequired).length > 0
                ? `${timeline.filter((item) => item.actionRequired).length} recent update${timeline.filter((item) => item.actionRequired).length === 1 ? "" : "s"} may need your attention.`
                : "Your recent workflow updates are organized here so you can see what changed without guessing."}
            </div>
          </div>
          {timeline.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: spacing.sm,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.title}</div>
                  <div style={{ color: textTokens.muted, fontSize: "0.9rem" }}>
                    {item.actorLabel ? `${item.actorLabel} • ` : ""}
                    {formatDate(item.occurredAt)}
                  </div>
                </div>
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    color: item.actionRequired ? "#9a3412" : "#1d4ed8",
                    background: item.actionRequired ? "#ffedd5" : "#dbeafe",
                  }}
                >
                  {item.actionRequired ? "Needs attention" : prettyStatus(item.type)}
                </div>
              </div>
              <div style={{ color: textTokens.secondary }}>{item.description}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ color: textTokens.muted, fontSize: "0.9rem" }}>
                  {item.actionRequired ? "Action may be helpful" : "No immediate action required"}
                </div>
                {item.relatedPath ? (
                  <Link to={item.relatedPath} style={{ fontWeight: 700 }}>
                    {item.actionRequired ? "Review update" : "Open"}
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </TenantSurfaceShell>
  );
}
