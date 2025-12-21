import { useEffect, useState } from "react";
import { fetchOnboarding } from "../api/onboardingApi";

export function OnboardingChecklist() {
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    fetchOnboarding().then(setState).catch(() => {});
  }, []);

  if (!state) return null;

  const steps = state.steps || {};
  const completed = state.completed;

  return (
    <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>Getting Started</strong>
        {completed && <span style={{ fontWeight: 700 }}>✅ You’re Live</span>}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <Row label="Add a property" done={!!steps.addProperty?.done} />
        <Row label="Add your first units" done={!!steps.addUnits?.done} />
        <Row label="View dashboard" done={!!steps.viewDashboard?.done} />
      </div>

      {completed && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => (window.location.href = "/dashboard")}>
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span>{done ? "✅" : "⬜️"}</span>
      <span>{label}</span>
    </div>
  );
}
