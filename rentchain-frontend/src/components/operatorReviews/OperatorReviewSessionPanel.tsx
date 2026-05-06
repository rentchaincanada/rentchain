import React from "react";
import { Link } from "react-router-dom";
import {
  addOperatorReviewNote,
  closeOperatorReviewSession,
  fetchOperatorReviewSessions,
  openOperatorReviewSession,
  type OperatorReviewEvidenceReference,
  type OperatorReviewOutcomeResult,
  type OperatorReviewScope,
  type OperatorReviewSession,
} from "@/api/operatorReviewApi";
import { Button, Card } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const outcomeOptions: Array<{ value: OperatorReviewOutcomeResult; label: string }> = [
  { value: "reviewed", label: "Reviewed" },
  { value: "needs_follow_up", label: "Needs follow-up" },
  { value: "escalated", label: "Escalated" },
  { value: "blocked", label: "Blocked" },
  { value: "unresolved", label: "Unresolved" },
];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: string) {
  if (status === "escalated" || status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "open" || status === "needs_follow_up") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "completed" || status === "reviewed") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ children, status }: { children: React.ReactNode; status: string }) {
  const tone = statusTone(status);
  return (
    <span
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        background: tone.background,
        color: tone.color,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Review session request failed";
}

export function OperatorReviewSessionPanel({
  scope,
  scopeId,
  linkedEvidence = [],
}: {
  scope: OperatorReviewScope;
  scopeId: string;
  linkedEvidence?: OperatorReviewEvidenceReference[];
}) {
  const { showToast } = useToast();
  const [sessions, setSessions] = React.useState<OperatorReviewSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [outcome, setOutcome] = React.useState<OperatorReviewOutcomeResult>("reviewed");
  const [summary, setSummary] = React.useState("Reviewed by operator");

  const loadSessions = React.useCallback(async () => {
    try {
      setLoading(true);
      const next = await fetchOperatorReviewSessions({ scope, scopeId });
      setSessions(next);
    } catch (error) {
      showToast({ message: "Failed to load review sessions", description: errorMessage(error), variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [scope, scopeId, showToast]);

  React.useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const activeSession = sessions.find((session) => session.status === "open") || null;
  const latestSession = sessions[0] || null;

  async function handleOpenReview() {
    try {
      setWorking(true);
      const session = await openOperatorReviewSession({ scope, scopeId, linkedEvidence });
      setSessions((current) => [session, ...current.filter((item) => item.reviewSessionId !== session.reviewSessionId)]);
      showToast({ message: "Review session opened", variant: "success" });
    } catch (error) {
      showToast({ message: "Failed to open review session", description: errorMessage(error), variant: "error" });
    } finally {
      setWorking(false);
    }
  }

  async function handleAddNote() {
    if (!activeSession || !note.trim()) return;
    try {
      setWorking(true);
      const session = await addOperatorReviewNote(activeSession.reviewSessionId, note);
      setSessions((current) => [session, ...current.filter((item) => item.reviewSessionId !== session.reviewSessionId)]);
      setNote("");
      showToast({ message: "Review note added", variant: "success" });
    } catch (error) {
      showToast({ message: "Failed to add review note", description: errorMessage(error), variant: "error" });
    } finally {
      setWorking(false);
    }
  }

  async function handleCloseReview() {
    if (!activeSession || !summary.trim()) return;
    try {
      setWorking(true);
      const session = await closeOperatorReviewSession(activeSession.reviewSessionId, {
        result: outcome,
        summary,
        status: outcome === "escalated" ? "escalated" : "completed",
      });
      setSessions((current) => [session, ...current.filter((item) => item.reviewSessionId !== session.reviewSessionId)]);
      showToast({ message: "Review outcome recorded", variant: "success" });
    } catch (error) {
      showToast({ message: "Failed to close review session", description: errorMessage(error), variant: "error" });
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card style={{ borderRadius: 8, display: "grid", gap: 12, background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ color: "#0f172a" }}>Operator review session</strong>
          <div style={{ color: "#475569", fontSize: 13 }}>
            Manual operator review. Review sessions are audit logged. No automated approval or certification occurs.
          </div>
        </div>
        {latestSession ? <Badge status={latestSession.status}>{label(latestSession.status)}</Badge> : null}
      </div>

      {loading ? <div style={{ color: "#64748b", fontSize: 13 }}>Loading review history...</div> : null}

      {!loading && !activeSession ? (
        <Button type="button" variant="secondary" onClick={handleOpenReview} disabled={working}>
          Open review
        </Button>
      ) : null}

      {activeSession ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Opened {new Date(activeSession.openedAt).toLocaleString()}</div>
          <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Review note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1200}
              rows={3}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 10,
                resize: "vertical",
                color: "#0f172a",
              }}
            />
          </label>
          <Button type="button" variant="ghost" onClick={handleAddNote} disabled={working || !note.trim()}>
            Add note
          </Button>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 220px) 1fr", gap: 8 }}>
            <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Outcome
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as OperatorReviewOutcomeResult)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: "#0f172a",
                  background: "#fff",
                }}
              >
                {outcomeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Outcome summary
              <input
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                maxLength={500}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: "#0f172a",
                }}
              />
            </label>
          </div>
          <Button type="button" onClick={handleCloseReview} disabled={working || !summary.trim()}>
            Record outcome
          </Button>
        </div>
      ) : null}

      {latestSession?.linkedEvidence.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ color: "#0f172a", fontSize: 13 }}>Evidence references</strong>
          {latestSession.linkedEvidence.map((evidence) =>
            evidence.destination ? (
              <Link key={evidence.evidenceId} to={evidence.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13 }}>
                {evidence.label}
              </Link>
            ) : (
              <span key={evidence.evidenceId} style={{ color: "#475569", fontSize: 13 }}>
                {evidence.label}
              </span>
            )
          )}
        </div>
      ) : null}

      {sessions.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ color: "#0f172a", fontSize: 13 }}>View review history</strong>
          {sessions.slice(0, 3).map((session) => (
            <div key={session.reviewSessionId} style={{ color: "#475569", fontSize: 13 }}>
              {label(session.status)} - {new Date(session.updatedAt).toLocaleString()}
              {session.outcome ? ` - ${label(session.outcome.result)}: ${session.outcome.summary}` : ""}
              {session.notes.length ? ` - ${session.notes.length} note${session.notes.length === 1 ? "" : "s"}` : ""}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
