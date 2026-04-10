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

  return (
    <TenantSurfaceShell
      title="Notifications & Feed"
      subtitle="Track the tenant-safe updates that matter most: application progress, identity steps, communications, lease changes, and maintenance."
    >
      {items.length === 0 ? (
        <TenantEmptyState
          title="No notifications yet"
          body="Recent updates will appear here once your application, tenancy, or communications begin generating tenant-visible events."
        />
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: spacing.sm,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.title}</div>
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    color: item.status === "success" ? "#166534" : item.status === "warning" ? "#9a3412" : "#1d4ed8",
                    background: item.status === "success" ? "#dcfce7" : item.status === "warning" ? "#ffedd5" : "#dbeafe",
                  }}
                >
                  {prettyStatus(item.type)}
                </div>
              </div>
              <div style={{ color: textTokens.secondary }}>{item.summary}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ color: textTokens.muted, fontSize: "0.9rem" }}>{formatDate(item.createdAt)}</div>
                {item.relatedPath ? (
                  <Link to={item.relatedPath} style={{ fontWeight: 700 }}>
                    Open
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
