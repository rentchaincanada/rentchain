import React from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Input, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import {
  captureRecoveryIntent,
  fetchRecoveryLogs,
  inspectRecoveryWorkflow,
  validateRecoveryGate,
  type DecisionRecoveryInspection,
  type OperatorRecoveryLog,
  type RecoveryActionIntent,
  type RecoveryActionType,
  type RecoveryDivergenceType,
  type RecoveryGateValidation,
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

const ACTION_TYPES: RecoveryActionType[] = ["ACCEPT_CANONICAL", "ACCEPT_DERIVED", "EVIDENCE_REVIEW_REQUIRED"];

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

function RecoveryIntentPanel({
  inspection,
  intents,
  gate,
  actionType,
  reason,
  authorizationConfirmed,
  submitting,
  onActionTypeChange,
  onReasonChange,
  onAuthorizationChange,
  onSubmit,
}: {
  inspection: DecisionRecoveryInspection | null;
  intents: RecoveryActionIntent[];
  gate: RecoveryGateValidation | null;
  actionType: RecoveryActionType;
  reason: string;
  authorizationConfirmed: boolean;
  submitting: boolean;
  onActionTypeChange: (value: RecoveryActionType) => void;
  onReasonChange: (value: string) => void;
  onAuthorizationChange: (value: boolean) => void;
  onSubmit: () => void;
}) {
  if (!inspection) {
    return (
      <Card>
        <div style={{ fontWeight: 700 }}>No recovery candidate selected.</div>
        <div style={{ color: "#64748b", marginTop: 6 }}>Select or inspect a recovery workflow to capture operator intent.</div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Recovery action intent</h2>
          <Pill tone="muted">Append only</Pill>
          <Pill tone="muted">Gate validation</Pill>
        </div>
        <div style={{ color: "#475569" }}>
          Capture operator intent before future recovery action. This records authorization intent only; diagnostics remain read-only.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Action type</div>
            <select
              aria-label="Recovery action type"
              value={actionType}
              onChange={(event) => onActionTypeChange(event.target.value as RecoveryActionType)}
              style={{ width: "100%", minHeight: 42 }}
            >
              {ACTION_TYPES.map((item) => <option key={item} value={item}>{label(item)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Reason comment</div>
            <textarea
              aria-label="Intent reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Describe the operator review basis for this recovery intent"
              rows={4}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input
              aria-label="Authorization confirmation"
              type="checkbox"
              checked={authorizationConfirmed}
              onChange={(event) => onAuthorizationChange(event.target.checked)}
            />
            <span>I confirm this records operator intent only and does not mutate recovery state.</span>
          </label>
          <Button onClick={onSubmit} disabled={submitting}>
            Capture intent
          </Button>
        </div>
        {gate ? (
          <div style={{ border: "1px solid rgba(15, 23, 42, 0.12)", borderRadius: 8, padding: 12 }}>
            <strong>Gate status {label(gate.gateStatus)}</strong>
            <div style={{ color: "#475569", marginTop: 4 }}>
              Authorization {gate.authorizationValid ? "valid" : "not valid"} · intent {gate.intentFresh ? "fresh" : "not fresh"}
              {gate.reason ? ` · ${label(gate.reason)}` : ""}
            </div>
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 8 }}>
          <strong>Intent history</strong>
          {intents.length ? intents.map((intent) => (
            <div key={intent.intentId} style={{ border: "1px solid rgba(15, 23, 42, 0.12)", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill tone="muted">{label(intent.actionType)}</Pill>
                <Pill tone="muted">{label(intent.operator.role)}</Pill>
                <Pill tone="muted">{label(intent.status)}</Pill>
              </div>
              <div style={{ color: "#475569", marginTop: 6 }}>{intent.reasonSummary}</div>
              <div style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>
                Captured {formatTime(intent.capturedAt)} · expires {formatTime(intent.expiresAt)}
              </div>
            </div>
          )) : <div style={{ color: "#64748b" }}>No intent has been captured for this recovery candidate.</div>}
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
  const [intents, setIntents] = React.useState<RecoveryActionIntent[]>([]);
  const [candidates, setCandidates] = React.useState<DecisionRecoveryInspection[]>([]);
  const [selectedLog, setSelectedLog] = React.useState<OperatorRecoveryLog | null>(null);
  const [intentActionType, setIntentActionType] = React.useState<RecoveryActionType>("ACCEPT_CANONICAL");
  const [intentReason, setIntentReason] = React.useState("");
  const [intentConfirmed, setIntentConfirmed] = React.useState(false);
  const [intentSubmitting, setIntentSubmitting] = React.useState(false);
  const [gate, setGate] = React.useState<RecoveryGateValidation | null>(null);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [inspecting, setInspecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadLogs = React.useCallback(async () => {
    try {
      setLoadingLogs(true);
      setError(null);
      const response = await fetchRecoveryLogs({ includeCandidates: true, limit: 25 });
      setLogs(response.logs || []);
      setIntents(response.intents || []);
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
      if (response.reconciliation.proposedDecision !== "NO_ACTION") setIntentActionType(response.reconciliation.proposedDecision);
      setGate(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to inspect recovery state";
      setError(message);
      showToast({ message: "Failed to inspect recovery state", description: message, variant: "error" });
    } finally {
      setInspecting(false);
    }
  };

  const selectedIntents = React.useMemo(() => {
    if (!inspection) return [];
    return intents.filter((intent) => intent.workflowInstanceKey === inspection.workflowInstanceKey);
  }, [inspection, intents]);

  const captureIntent = async () => {
    if (!inspection) {
      setError("Select a recovery candidate before capturing intent.");
      return;
    }
    if (!intentReason.trim()) {
      setError("Intent reason is required.");
      return;
    }
    if (!intentConfirmed) {
      setError("Authorization confirmation is required.");
      return;
    }
    try {
      setIntentSubmitting(true);
      setError(null);
      const captured = await captureRecoveryIntent({
        recoveryId: inspection.workflowInstanceKey,
        actionType: intentActionType,
        reason: intentReason.trim(),
        authorizationConfirmed: intentConfirmed,
      });
      setIntents((current) => [captured.intent, ...current.filter((intent) => intent.intentId !== captured.intent.intentId)]);
      const validated = await validateRecoveryGate({
        recoveryId: inspection.workflowInstanceKey,
        intentId: captured.intent.intentId,
      });
      setGate(validated.gate);
      setIntentReason("");
      setIntentConfirmed(false);
      showToast({ message: "Recovery intent captured", description: "Gate validation completed without mutating recovery state." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to capture recovery intent";
      setError(message);
      showToast({ message: "Failed to capture recovery intent", description: message, variant: "error" });
    } finally {
      setIntentSubmitting(false);
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
                      onClick={() => {
                        setInspection(candidate);
                        if (candidate.proposedDecision !== "NO_ACTION") setIntentActionType(candidate.proposedDecision);
                        setGate(null);
                      }}
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

        <RecoveryIntentPanel
          inspection={inspection}
          intents={selectedIntents}
          gate={gate}
          actionType={intentActionType}
          reason={intentReason}
          authorizationConfirmed={intentConfirmed}
          submitting={intentSubmitting}
          onActionTypeChange={setIntentActionType}
          onReasonChange={setIntentReason}
          onAuthorizationChange={setIntentConfirmed}
          onSubmit={() => void captureIntent()}
        />

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
