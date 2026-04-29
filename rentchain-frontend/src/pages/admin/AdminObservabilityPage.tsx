import React from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import {
  fetchAdminObservabilitySummary,
  type SystemObservabilitySummary,
} from "../../api/adminObservabilityApi";

const EMPTY_SUMMARY: SystemObservabilitySummary = {
  generatedAt: new Date(0).toISOString(),
  totals: {
    openCritical: 0,
    openWarnings: 0,
    resolvedLast7Days: 0,
  },
  workflows: [],
  topIssues: [],
};

function formatWorkflowLabel(workflow: string): string {
  return workflow
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTimestamp(value: string): string {
  const ts = Date.parse(String(value || ""));
  if (!Number.isFinite(ts)) return "Unknown";
  return new Date(ts).toLocaleString();
}

export default function AdminObservabilityPage() {
  const { showToast } = useToast();
  const [summary, setSummary] = React.useState<SystemObservabilitySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const next = await fetchAdminObservabilitySummary({ period: "7d" });
      setSummary(next);
    } catch (err: any) {
      const message = err?.message || "Failed to load workflow health";
      setError(message);
      showToast({
        message: "Failed to load workflow health",
        description: message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const hasData =
    summary.totals.openCritical > 0 ||
    summary.totals.openWarnings > 0 ||
    summary.totals.resolvedLast7Days > 0 ||
    summary.workflows.some(
      (workflow) => workflow.openCritical > 0 || workflow.openWarnings > 0 || workflow.recentCompleted > 0
    ) ||
    summary.topIssues.length > 0;

  return (
    <MacShell title="Admin · Workflow health">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Workflow health</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 820 }}>
                Internal workflow health summary across high-signal payment, screening, lease, and institutional events.
              </div>
            </div>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        {loading ? <Card>Loading workflow health…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load workflow health: {error}</Card> : null}

        {!loading && !error ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <Card>
                <div style={{ fontSize: 12, color: "#64748b" }}>Open critical</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.totals.openCritical}</div>
              </Card>
              <Card>
                <div style={{ fontSize: 12, color: "#64748b" }}>Open warnings</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.totals.openWarnings}</div>
              </Card>
              <Card>
                <div style={{ fontSize: 12, color: "#64748b" }}>Recent completions</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.totals.resolvedLast7Days}</div>
              </Card>
              <Card>
                <div style={{ fontSize: 12, color: "#64748b" }}>Last generated</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatTimestamp(summary.generatedAt)}</div>
              </Card>
            </div>

            {hasData ? (
              <>
                <Card>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>Workflow health</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ textAlign: "left", color: "#64748b", fontSize: 13 }}>
                            <th style={{ padding: "0 0 10px" }}>Workflow</th>
                            <th style={{ padding: "0 0 10px" }}>Open critical</th>
                            <th style={{ padding: "0 0 10px" }}>Open warnings</th>
                            <th style={{ padding: "0 0 10px" }}>Recent completed</th>
                            <th style={{ padding: "0 0 10px" }}>Health</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.workflows.map((workflow) => (
                            <tr key={workflow.workflow} style={{ borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
                              <td style={{ padding: "10px 0", fontWeight: 600 }}>
                                {formatWorkflowLabel(workflow.workflow)}
                              </td>
                              <td style={{ padding: "10px 0" }}>{workflow.openCritical}</td>
                              <td style={{ padding: "10px 0" }}>{workflow.openWarnings}</td>
                              <td style={{ padding: "10px 0" }}>{workflow.recentCompleted}</td>
                              <td style={{ padding: "10px 0" }}>
                                <Pill tone={workflow.health === "attention" ? "accent" : "muted"}>
                                  {workflow.health === "attention"
                                    ? "Needs attention"
                                    : workflow.health === "watch"
                                    ? "Watch"
                                    : "Healthy"}
                                </Pill>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>Top issues</div>
                    {summary.topIssues.length ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        {summary.topIssues.map((issue) => (
                          <div
                            key={`${issue.workflow}-${issue.severity}-${issue.title}`}
                            style={{ borderTop: "1px solid rgba(15, 23, 42, 0.08)", paddingTop: 10 }}
                          >
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 600 }}>{issue.title}</div>
                              <Pill tone={issue.severity === "critical" ? "accent" : "muted"}>
                                {issue.severity}
                              </Pill>
                            </div>
                            <div style={{ color: "#475569" }}>
                              {formatWorkflowLabel(issue.workflow)} · Count {issue.count} · Last seen {formatTimestamp(issue.lastSeenAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "#64748b" }}>No open workflow issues need attention right now.</div>
                    )}
                  </div>
                </Card>
              </>
            ) : (
              <Card>No workflow health issues or recent completions are available right now.</Card>
            )}
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
