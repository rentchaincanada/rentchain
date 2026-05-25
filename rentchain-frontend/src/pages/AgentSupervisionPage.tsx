import React from "react";
import { Link } from "react-router-dom";
import { fetchAgentSupervisionSnapshot, type AgentSupervisionSnapshot } from "@/api/agentSupervisionApi";
import { AgentSupervisionConsole } from "@/components/agentSupervision/AgentSupervisionConsole";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load agent supervision snapshot";
}

export default function AgentSupervisionPage() {
  const { showToast } = useToast();
  const [data, setData] = React.useState<AgentSupervisionSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const snapshot = await fetchAgentSupervisionSnapshot();
        if (mounted) setData(snapshot);
      } catch (err) {
        if (!mounted) return;
        const message = errorMessage(err);
        setError(message);
        showToast({ message: "Failed to load agent supervision", description: message, variant: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  return (
    <MacShell title="Agent supervision" showTopNav={false}>
      <div style={{ display: "grid", gap: 16, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start", minWidth: 0 }}>
            <div style={{ display: "grid", gap: 6, minWidth: 0, maxWidth: "100%" }}>
              <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Agent supervision</h1>
              <div style={{ color: "#475569", maxWidth: 900, overflowWrap: "anywhere" }}>
                A read-only control tower for workflow previews, policy-gated suggestions, blocked states, escalation
                visibility, and review lineage.
              </div>
            </div>
            <Link to="/decision-inbox" style={{ color: "#2563eb", fontWeight: 800 }}>
              Decision inbox
            </Link>
          </div>
        </Section>

        {loading ? <Card>Loading agent supervision...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}
        {!loading && !error && data ? <AgentSupervisionConsole snapshot={data} /> : null}
      </div>
    </MacShell>
  );
}
