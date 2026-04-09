import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Ui";
import { listTenantMaintenance, type MaintenanceWorkflowItem } from "../../api/maintenanceWorkflowApi";
import { colors, spacing, text as textTokens } from "../../styles/tokens";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantLoadingState,
  TenantSurfaceShell,
  prettyStatus,
} from "./TenantWorkspaceShared";

function fmtDate(ts?: number | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function TenantMaintenanceRequestsPage() {
  const [items, setItems] = React.useState<MaintenanceWorkflowItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listTenantMaintenance();
      const list = Array.isArray(res?.items) ? res.items : Array.isArray((res as any)?.data) ? (res as any).data : [];
      setItems(list);
    } catch (err: any) {
      setError(err?.message || "Unable to load maintenance requests.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <TenantSurfaceShell
      title="Maintenance"
      subtitle="Track tenant-safe maintenance summaries and submit a new request when something needs attention."
      action={
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
          <Link
            to="/tenant/maintenance/new"
            style={{
              textDecoration: "none",
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              color: textTokens.primary,
              fontWeight: 700,
            }}
          >
            New request
          </Link>
        </div>
      }
    >
      {error ? <TenantErrorState message={error} retry={() => void load()} /> : null}
      {loading ? (
        <TenantLoadingState label="Loading maintenance requests..." />
      ) : items.length === 0 ? (
        <TenantEmptyState
          title="No maintenance requests yet"
          body="You can submit your first request from this workspace when you need help with the property."
          action={<Link to="/tenant/maintenance/new">Create a request</Link>}
        />
      ) : (
        <div style={{ display: "grid", gap: spacing.md }}>
          {items.map((item) => (
            <TenantInfoCard key={item.id} heading={item.title || "Maintenance request"} accent="#b45309">
              <div style={{ color: textTokens.muted, fontSize: "0.92rem" }}>
                {prettyStatus(item.status)} • {prettyStatus(item.priority)} • {prettyStatus(item.category)}
              </div>
              <div style={{ color: textTokens.secondary, fontSize: "0.9rem" }}>
                Created {fmtDate(item.createdAt)} • Last update {fmtDate(item.updatedAt)}
                {item.assignedContractorName ? ` • Contractor: ${item.assignedContractorName}` : ""}
              </div>
              <div>
                <Link to={`/tenant/maintenance/${item.id}`}>Open request</Link>
              </div>
            </TenantInfoCard>
          ))}
        </div>
      )}
    </TenantSurfaceShell>
  );
}
