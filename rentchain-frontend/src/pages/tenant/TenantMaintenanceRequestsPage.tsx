import React from "react";
import { Link } from "react-router-dom";
import { Card, Button } from "../../components/ui/Ui";
import { listTenantMaintenance, type MaintenanceWorkflowItem } from "../../api/maintenanceWorkflowApi";
import { colors, spacing, text as textTokens } from "../../styles/tokens";

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
    <Card elevated style={{ display: "grid", gap: spacing.md, padding: spacing.lg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", color: textTokens.primary }}>Maintenance Requests</h1>
          <div style={{ color: textTokens.muted, marginTop: 6 }}>
            Track submitted, assigned, and completed requests.
          </div>
        </div>
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
      </div>

      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}
      {loading ? (
        <div style={{ color: textTokens.muted }}>Loading requests…</div>
      ) : items.length === 0 ? (
        <div style={{ color: textTokens.muted }}>
          No maintenance requests yet. Submit your first request.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/tenant/maintenance/${item.id}`}
              style={{
                textDecoration: "none",
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                background: colors.card,
                padding: "10px 12px",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ color: textTokens.primary, fontWeight: 700 }}>{item.title || "Request"}</div>
              <div style={{ color: textTokens.muted, fontSize: "0.92rem" }}>
                {item.status} • {item.priority} • {item.category}
              </div>
              <div style={{ color: textTokens.secondary, fontSize: "0.9rem" }}>
                Created {fmtDate(item.createdAt)} • Last update {fmtDate(item.updatedAt)}
                {item.assignedContractorName ? ` • Contractor: ${item.assignedContractorName}` : ""}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
