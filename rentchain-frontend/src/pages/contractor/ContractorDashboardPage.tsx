import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Ui";
import { listWorkOrders } from "../../api/workOrdersApi";

export default function ContractorDashboardPage() {
  const [counts, setCounts] = React.useState({
    assigned: 0,
    waiting: 0,
    inProgress: 0,
    completed: 0,
  });

  React.useEffect(() => {
    const load = async () => {
      const items = await listWorkOrders();
      setCounts({
        assigned: items.filter((i) => i.status === "assigned" || i.status === "accepted").length,
        waiting: items.filter((i) => i.status === "invited").length,
        inProgress: items.filter((i) => i.status === "in_progress").length,
        completed: items.filter((i) => i.status === "completed").length,
      });
    };
    void load();
  }, []);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ fontWeight: 700, fontSize: "1.06rem" }}>Contractor Dashboard</div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          Assigned jobs, responses needed, and progress updates.
        </div>
      </Card>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <Card>
          <div style={{ fontSize: 13, color: "#64748b" }}>Assigned to You</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{counts.assigned}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: "#64748b" }}>Waiting Response</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{counts.waiting}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: "#64748b" }}>In Progress</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{counts.inProgress}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: "#64748b" }}>Completed</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{counts.completed}</div>
        </Card>
      </div>
      <Card>
        <Link to="/contractor/jobs">Open Jobs</Link>
      </Card>
    </div>
  );
}
