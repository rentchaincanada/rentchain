import { useAutomationTimeline } from "./useAutomationTimeline";

export default function AutomationTimelinePage() {
  const { events } = useAutomationTimeline();

  return (
    <section style={{ display: "grid", gap: 12, padding: 20 }}>
      <h1 style={{ margin: 0 }}>Automation Timeline</h1>
      <p style={{ margin: 0, color: "#475569" }}>Unified Event Ledger (v1)</p>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        {events.length === 0
          ? "No events yet. This will become the system-wide ledger timeline."
          : null}
      </div>
    </section>
  );
}
