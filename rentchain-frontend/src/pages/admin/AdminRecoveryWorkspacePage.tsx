import React from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Input, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import {
  fetchRecoveryLogs,
  inspectRecoveryWorkflow,
  type DecisionRecoveryInspection,
  type OperatorRecoveryLog,
  type RecoveryDivergenceType,
  type RecoveryWorkflowType,
} from "../../api/adminRecoveryApi";

const WORKFLOW_TYPES: RecoveryWorkflowType[] = ["screening", "lease", "maintenance", "payment", "decision"];

const DIVERGENCE_LABELS: Record<RecoveryDivergenceType, string> = {
  NONE: "No divergence",
  MISSING_TRANSITION: "Missing transition",
  ORPHANED_DECISION: "Orphaned decision",
  EVIDENCE_MISMATCH: "Evidence mismatch",
  METADATA_DIVERGENCE: "Metadata divergence",
};

function label(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Not available";
  return raw
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTime(value: string | null | undefined) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return "Not recorded";
  return new Date(parsed).toLocaleString();
}

function StateComparison({ inspection }: { inspection: DecisionRecoveryInspection | null }) {
  if (!inspection) {
    return (
      <Card>
        <div style={{ fontWeight: 700 }}>No workflow inspection selected.</div>
        <div style={{ color: "#64748b", marginTop: 6 }}>Enter a workflow type and reference to inspect current recovery state.</div>
      </Card>
    );
  }

  const rows = [
    { label: "Canonical state", state: inspection.canonicalState },
    { label: "Derived state", state: inspection.derivedState },
  ];

  return (
    <Card>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Recovery inspection</h2>
          <Pill tone={inspection.manualReviewRequired ? "accent" : "muted"}>{DIVERGENCE_LABELS[inspection.divergenceType]}</Pill>
          <Pill tone="muted">{label(inspection.workflowType)}</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ border: "1px solid rgba(15, 23, 42, 0.12)", borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>{row.label}</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>{label(row.state.state)}</div>
              <div style={{ color: "#475569", marginTop: 4 }}>
                {label(row.state.status)} · {label(row.state.source)} · {formatTime(row.state.observedAt)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill tone="muted">{inspection.evidence.evidenceRefCount} evidence refs</Pill>
          <Pill tone="muted">Latest evidence {formatTime(inspection.evidence.latestEvidenceAt)}</Pill>
          <Pill tone="muted">Evidence state {label(inspection.evidence.evidenceState)}</Pill>
          <Pill tone="muted">Proposal {label(inspection.proposedDecision)}</Pill>
        </div>
        <div style={{ color: "#475569" }}>{label(inspection.reasonCode)}</div>
      </div>
    </Card>
  );
}

function RecoveryHistory({
  logs,
  selectedLogId,
  onSelect,
}: {
  logs: OperatorRecoveryLog[];
  selectedLogId: string | null;
  onSelect: (log: OperatorRecoveryLog) => void;
}) {
  if (logs.length === 0) {
    return (
      <Card>
        <div style={{ fontWeight: 700 }}>No recovery actions recorded.</div>
        <div style={{ color: "#64748b", marginTop: 6 }}>Immutable recovery history will appear after supervised reconciliation is logged.</div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {logs.map((log) => (
        <button
          key={log.logId}
          type="button"
          onClick={() => onSelect(log)}
          style={{
            textAlign: "left",
            border: selectedLogId === log.logId ? "1px solid #2563eb" : "1px solid rgba(15, 23, 42, 0.12)",
            background: selectedLogId === log.logId ? "#eff6ff" : "#fff",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>{label(log.reconciliationDecision)}</strong>
            <Pill tone="muted">{DIVERGENCE_LABELS[log.divergenceType]}</Pill>
            <Pill tone="muted">{label(log.operator.role)}</Pill>
          </div>
          <div style={{ color: "#475569" }}>{log.reasonSummary}</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            {formatTime(log.createdAt)} · {log.evidence.evidenceRefCount} evidence refs · attempt {log.recoveryMetadata.recoveryAttemptCount}
          </div>
        </button>
      ))}
    </div>
  );
}

function RecoveryTimeline({ log }: { log: OperatorRecoveryLog | null }) {
  if (!log) {
    return (
      <Card>
        <div style={{ color: "#64748b" }}>Select a recovery log to review its timeline linkage.</div>
      </Card>
    );
  }
  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Recovery timeline</h2>
          <Pill tone="muted">Append only</Pill>
          <Pill tone="muted">Metadata only</Pill>
        </div>
        <div style={{ borderLeft: "3px solid #2563eb", paddingLeft: 12, display: "grid", gap: 4 }}>
          <strong>{label(log.reconciliationDecision)}</strong>
          <div style={{ color: "#475569" }}>{formatTime(log.recoveryMetadata.lastRecoveryTimestamp)}</div>
          <div style={{ color: "#475569" }}>Timeline entry {log.timelineEntryId}</div>
          <div style={{ color: "#64748b" }}>{log.redactionSummary}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {log.recoveryMetadata.associatedTimelineEntryIds.map((entryId) => (
            <Pill key={entryId} tone="muted">{entryId}</Pill>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function AdminRecoveryWorkspacePage() {
  const { showToast } = useToast();
  const [workflowType, setWorkflowType] = React.useState<RecoveryWorkflowType>("decision");
  const [workflowId, setWorkflowId] = React.useState("");
  const [inspection, setInspection] = React.useState<DecisionRecoveryInspection | null>(null);
  const [logs, setLogs] = React.useState<OperatorRecoveryLog[]>([]);
  const [candidates, setCandidates] = React.useState<DecisionRecoveryInspection[]>([]);
  const [selectedLog, setSelectedLog] = React.useState<OperatorRecoveryLog | null>(null);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [inspecting, setInspecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadLogs = React.useCallback(async () => {
    try {
      setLoadingLogs(true);
      setError(null);
      const response = await fetchRecoveryLogs({ includeCandidates: true, limit: 25 });
      setLogs(response.logs || []);
      setCandidates(response.candidates || []);
      setSelectedLog((current) => {
        if (!current) return response.logs?.[0] || null;
        return response.logs.find((item) => item.logId === current.logId) || response.logs?.[0] || null;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load recovery history";
      setError(message);
      showToast({ message: "Failed to load recovery history", description: message, variant: "error" });
    } finally {
      setLoadingLogs(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const inspect = async () => {
    const trimmed = workflowId.trim();
    if (!trimmed) {
      setError("Workflow reference is required.");
      return;
    }
    try {
      setInspecting(true);
      setError(null);
      const response = await inspectRecoveryWorkflow({ workflowType, workflowId: trimmed });
      setInspection(response.reconciliation);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to inspect recovery state";
      setError(message);
      showToast({ message: "Failed to inspect recovery state", description: message, variant: "error" });
    } finally {
      setInspecting(false);
    }
  };

  return (
    <MacShell title="Admin · Recovery workspace">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Recovery workspace</h1>
                <Pill tone="accent">Admin/support</Pill>
                <Pill tone="muted">Read only</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 860 }}>
                Inspect workflow divergence, review recovery history, and follow immutable timeline references from existing recovery records.
              </div>
            </div>
            <Button variant="secondary" onClick={() => void loadLogs()} disabled={loadingLogs}>
              Refresh
            </Button>
          </div>
        </Section>

        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 12, minWidth: 0 }}>
            <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Workflow type</div>
              <select
                aria-label="Workflow type"
                value={workflowType}
                onChange={(event) => setWorkflowType(event.target.value as RecoveryWorkflowType)}
                style={{ width: "100%", minWidth: 0, boxSizing: "border-box", minHeight: 42 }}
              >
                {WORKFLOW_TYPES.map((item) => <option key={item} value={item}>{label(item)}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Workflow reference</div>
              <Input
                aria-label="Workflow reference"
                value={workflowId}
                onChange={(event) => setWorkflowId(event.target.value)}
                placeholder="Enter workflow reference"
              />
            </label>
            <div style={{ display: "flex", alignItems: "end" }}>
              <Button onClick={() => void inspect()} disabled={inspecting} style={{ width: "100%" }}>
                Inspect
              </Button>
            </div>
          </div>
        </Card>

        {error ? <Card><div style={{ color: "#b91c1c" }}>{error}</div></Card> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 16 }}>
          <StateComparison inspection={inspection} />
          <Card>
            <div style={{ display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Recovery candidates</h2>
              {candidates.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {candidates.map((candidate) => (
                    <button
                      key={`${candidate.workflowType}:${candidate.workflowInstanceKey}`}
                      type="button"
                      onClick={() => setInspection(candidate)}
                      style={{
                        textAlign: "left",
                        border: "1px solid rgba(15, 23, 42, 0.12)",
                        background: "#fff",
                        borderRadius: 8,
                        padding: 10,
                        cursor: "pointer",
                      }}
                    >
                      <strong>{label(candidate.workflowType)}</strong>
                      <div style={{ color: "#475569" }}>{DIVERGENCE_LABELS[candidate.divergenceType]}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#64748b" }}>No recovery candidates are available.</div>
              )}
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 16 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Immutable recovery history</h2>
            {loadingLogs ? <Card><div>Loading recovery history...</div></Card> : null}
            {!loadingLogs ? (
              <RecoveryHistory logs={logs} selectedLogId={selectedLog?.logId || null} onSelect={setSelectedLog} />
            ) : null}
          </div>
          <RecoveryTimeline log={selectedLog} />
        </div>
      </div>
    </MacShell>
  );
}
