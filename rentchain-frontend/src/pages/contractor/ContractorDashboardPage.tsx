import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Ui";
import { listContractorMaintenanceJobs } from "../../api/maintenanceWorkflowApi";
import { colors, radius, text } from "../../styles/tokens";

export default function ContractorDashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [counts, setCounts] = React.useState({
    assigned: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
  });

  React.useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await listContractorMaintenanceJobs();
        const items = Array.isArray(res?.items) ? res.items : Array.isArray((res as any)?.data) ? (res as any).data : [];
        setCounts({
          assigned: items.filter((item) => item.status === "assigned").length,
          scheduled: items.filter((item) => item.status === "scheduled").length,
          inProgress: items.filter((item) => item.status === "in_progress").length,
          completed: items.filter((item) => item.status === "completed").length,
        });
      } catch (err: any) {
        setError(String(err?.message || "Failed to load contractor dashboard"));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ fontWeight: 700, fontSize: "1.06rem", color: text.primary }}>Contractor Dashboard</div>
        <div style={{ color: text.muted, marginTop: 4 }}>
          Assigned maintenance jobs, scheduled visits, and active work.
        </div>
      </Card>

      {error ? <Card style={{ borderColor: colors.danger, color: colors.danger }}>{error}</Card> : null}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        {[
          { label: "Assigned jobs", value: counts.assigned },
          { label: "Scheduled visits", value: counts.scheduled },
          { label: "In progress", value: counts.inProgress },
          { label: "Completed", value: counts.completed },
        ].map((item) => (
          <Card key={item.label}>
            <div style={{ fontSize: 13, color: text.muted }}>{item.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{loading ? "-" : item.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <Link
          to="/contractor/jobs"
          style={{
            display: "inline-flex",
            padding: "8px 12px",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            textDecoration: "none",
            color: text.primary,
            fontWeight: 700,
            background: colors.panel,
          }}
        >
          Open jobs inbox
        </Link>
      </Card>
    </div>
  );
}
