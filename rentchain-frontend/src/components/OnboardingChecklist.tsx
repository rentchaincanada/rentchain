import { useEffect, useState } from "react";
import { fetchOnboarding } from "../api/onboardingApi";

export function OnboardingChecklist() {
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    fetchOnboarding().then(setState).catch(() => {});
  }, []);

  if (!state) return null;

  const steps = state.steps || {};
  const completed =
    steps.propertyAdded &&
    steps.unitAdded &&
    steps.tenantInvited &&
    steps.applicationCreated &&
    steps.exportPreviewed;

  return (
    <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>Getting Started</strong>
        {completed && <span style={{ fontWeight: 700 }}>✅ You’re Live</span>}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <Row label="Add a property" done={!!steps.propertyAdded} />
        <Row label="Add units" done={!!steps.unitAdded} />
        <Row label="Invite tenant" done={!!steps.tenantInvited} />
        <Row label="Create application" done={!!steps.applicationCreated} />
        <Row label="Preview export" done={!!steps.exportPreviewed} />
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
