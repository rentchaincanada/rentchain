import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Ui";
import { listTenantMaintenance, type MaintenanceWorkflowItem } from "../../api/maintenanceWorkflowApi";
import { colors, spacing, text as textTokens } from "../../styles/tokens";
import { buildMaintenanceWorkspaceState } from "../maintenanceWorkspaceState";
import { buildMaintenanceAssignmentRoutingView } from "../maintenanceAssignmentRoutingState";
import { buildMaintenanceConfirmationAccessView } from "../maintenanceConfirmationAccessState";
import { buildMaintenanceSchedulingAccessView } from "../maintenanceSchedulingAccessState";
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

  const workspaceView = React.useMemo(() => buildMaintenanceWorkspaceState(items, "tenant"), [items]);

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
          <TenantInfoCard heading="Maintenance workflow" accent="#1d4ed8">
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ color: textTokens.primary, fontWeight: 800 }}>{workspaceView.summaryTitle}</div>
              <div style={{ color: textTokens.secondary }}>{workspaceView.summaryDescription}</div>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                }}
              >
                {[
                  { label: "Submitted", value: workspaceView.counts.submitted },
                  { label: "Acknowledged", value: workspaceView.counts.acknowledged },
                  { label: "In progress", value: workspaceView.counts.in_progress },
                  { label: "Completed", value: workspaceView.counts.completed },
                  { label: "Needs attention", value: workspaceView.counts.needs_attention },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      padding: "12px 14px",
                      background: colors.panel,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ color: textTokens.muted, fontSize: "0.8rem", textTransform: "uppercase" }}>{item.label}</div>
                    <div style={{ color: textTokens.primary, fontWeight: 800, fontSize: "1.3rem" }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ color: textTokens.primary, fontWeight: 700 }}>What happens next</div>
                {workspaceView.nextSteps.map((step) => (
                  <div key={step} style={{ color: textTokens.secondary }}>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </TenantInfoCard>
          {items.map((item) => (
            (() => {
              const requestView = workspaceView.requestViews.find((entry) => entry.id === item.id);
              const assignmentView = buildMaintenanceAssignmentRoutingView(item, "tenant");
              const schedulingView = buildMaintenanceSchedulingAccessView(item, "tenant");
              const confirmationView = buildMaintenanceConfirmationAccessView(item, "tenant");
              return (
                <TenantInfoCard
                  key={item.id}
                  heading={item.title || "Maintenance request"}
                  accent={requestView?.needsAttention ? "#dc2626" : "#b45309"}
                >
                                   <div style={{ color: textTokens.muted, fontSize: "0.92rem" }}>
                    {requestView?.lifecycleLabel || prettyStatus(item.status)} • {prettyStatus(item.priority)} •{" "}
                    {prettyStatus(item.category)}
                  </div>
                  <div style={{ color: textTokens.secondary, lineHeight: 1.5 }}>
                    {requestView?.summary || "This request is visible in your tenant maintenance workspace."}
                  </div>
                  <div style={{ color: textTokens.secondary, fontSize: "0.9rem" }}>
                    Created {fmtDate(item.createdAt)} • Last update {fmtDate(item.updatedAt)}
                    {` • Handling: ${assignmentView.tenantVisibleLabel}`}
                  </div>
                  <div style={{ color: textTokens.secondary }}>{assignmentView.summary}</div>
                  <div
                    style={{
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ color: textTokens.primary, fontWeight: 700 }}>Scheduling / access</div>
                    <div style={{ color: textTokens.secondary }}>{schedulingView.summary}</div>
                    <div style={{ color: textTokens.secondary }}>
                      {`${schedulingView.tenantVisibleLabel} • ${schedulingView.accessLabel}`}
                    </div>
                    <div style={{ color: textTokens.secondary }}>
                      Upcoming service window: {schedulingView.serviceWindowSummary}
                    </div>
                  </div>
                  <div
                    style={{
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ color: textTokens.primary, fontWeight: 700 }}>Confirmation / access</div>
                    <div style={{ color: textTokens.secondary }}>{confirmationView.summary}</div>
                    <div style={{ color: textTokens.secondary }}>
                      {`${confirmationView.tenantVisibleState} • ${confirmationView.accessLabel}`}
                    </div>
                  </div>
                  {requestView?.nextSteps.length ? (
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ color: textTokens.primary, fontWeight: 700 }}>Next step</div>
                      <div style={{ color: textTokens.secondary }}>{requestView.nextSteps[0]}</div>
                    </div>
                  ) : null}
                  <div>
                    <Link to={`/tenant/maintenance/${item.id}`}>Open request</Link>
                  </div>
                </TenantInfoCard>
              );
            })()
          ))}
        </div>
      )}
    </TenantSurfaceShell>
  );
}
