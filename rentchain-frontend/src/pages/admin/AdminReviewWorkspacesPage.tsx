import React from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import {
  fetchAdminReviewWorkspaceDetail,
  fetchAdminReviewWorkspaces,
  type GovernedReviewWorkspaceDetail,
  type GovernedReviewWorkspaceRecord,
  type GovernedReviewWorkspaceSummary,
} from "../../api/adminReviewWorkspacesApi";

const WORKSPACE_TYPES = [
  "security_review",
  "support_escalation_review",
  "export_governance_review",
  "evidence_review",
  "policy_failure_review",
  "projection_safety_review",
  "operational_readiness_review",
  "other",
];

const EMPTY_SUMMARY: GovernedReviewWorkspaceSummary = {
  total: 0,
  metadataOnly: true,
  emptyState: null,
};

function label(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Not specified";
  return raw
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTime(value: string | null | undefined) {
  const ts = Date.parse(String(value || ""));
  if (!Number.isFinite(ts)) return "Not scheduled";
  return new Date(ts).toLocaleString();
}

function WorkspaceRow({
  workspace,
  selected,
  onSelect,
}: {
  workspace: GovernedReviewWorkspaceRecord;
  selected: boolean;
  onSelect: (workspace: GovernedReviewWorkspaceRecord) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(workspace)}
      style={{
        textAlign: "left",
        border: selected ? "1px solid #2563eb" : "1px solid rgba(15, 23, 42, 0.12)",
        background: selected ? "#eff6ff" : "#fff",
        borderRadius: 8,
        padding: 12,
        display: "grid",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong>{workspace.title}</strong>
        <Pill tone="muted">{label(workspace.workspaceType)}</Pill>
        <Pill tone="muted">Append only</Pill>
      </div>
      <div style={{ color: "#475569" }}>{workspace.summary}</div>
      <div style={{ color: "#64748b", fontSize: 13 }}>
        {label(workspace.reviewStateSummary)} · {workspace.appendEventCount} append events · {formatTime(workspace.lastAppendedAt)}
      </div>
    </button>
  );
}

function DetailPanel({ workspace }: { workspace: GovernedReviewWorkspaceDetail | null }) {
  if (!workspace) {
    return (
      <Card>
        <div style={{ color: "#64748b" }}>Select a workspace to review metadata-only details.</div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{workspace.title}</h2>
          <Pill tone="muted">Metadata only</Pill>
          <Pill tone="muted">Read only</Pill>
        </div>
        <div style={{ color: "#475569" }}>{workspace.summary}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Workspace type</div>
            <strong>{label(workspace.workspaceType)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Approval expectation</div>
            <strong>{label(workspace.approvalExpectationSummary)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Retention class</div>
            <strong>{label(workspace.retentionClass)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Retention review</div>
            <strong>{formatTime(workspace.retentionReviewAt)}</strong>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Related metadata</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <Pill tone="muted">{workspace.relatedIncidentCount} incidents</Pill>
            <Pill tone="muted">{workspace.relatedEscalationCount} escalations</Pill>
            <Pill tone="muted">{workspace.relatedEvidenceCount} evidence refs</Pill>
            <Pill tone="muted">{workspace.relatedNoteCount} notes</Pill>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Append event summaries</div>
          {workspace.appendEventSummaries.length ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {workspace.appendEventSummaries.map((event) => (
                <div key={event.eventRefId} style={{ color: "#475569" }}>
                  {formatTime(event.occurredAt)} · {label(event.eventType)} · {event.eventSummary}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#64748b", marginTop: 8 }}>No append event summaries are available.</div>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Safe evidence references</div>
          {workspace.safeEvidenceRefs.length ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {workspace.safeEvidenceRefs.map((ref) => (
                <div key={`${ref.referenceType}:${ref.referenceId}`} style={{ color: "#475569" }}>
                  {label(ref.referenceType)} · {ref.label}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#64748b", marginTop: 8 }}>No safe evidence references are available.</div>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Related workspace links</div>
          {workspace.relatedWorkspaceLinks.length ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {workspace.relatedWorkspaceLinks.map((link) => (
                <div key={link.linkId} style={{ color: "#475569" }}>
                  {label(link.linkType)} · {link.sourceSummary.label} → {link.targetSummary.label}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#64748b", marginTop: 8 }}>No metadata-only workspace links are available.</div>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Redaction summary</div>
          <div style={{ color: "#475569" }}>{workspace.redactionSummary}</div>
        </div>
      </div>
    </Card>
  );
}

export default function AdminReviewWorkspacesPage() {
  const { showToast } = useToast();
  const [workspaces, setWorkspaces] = React.useState<GovernedReviewWorkspaceRecord[]>([]);
  const [summary, setSummary] = React.useState<GovernedReviewWorkspaceSummary>(EMPTY_SUMMARY);
  const [selected, setSelected] = React.useState<GovernedReviewWorkspaceRecord | null>(null);
  const [detail, setDetail] = React.useState<GovernedReviewWorkspaceDetail | null>(null);
  const [workspaceType, setWorkspaceType] = React.useState("");
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchAdminReviewWorkspaces({
        workspaceType: workspaceType || null,
        q: q || null,
        limit: 50,
      });
      setWorkspaces(response.workspaces || []);
      setSummary(response.summary || EMPTY_SUMMARY);
      setSelected((current) => {
        if (!current) return response.workspaces[0] || null;
        return response.workspaces.find((item) => item.workspaceId === current.workspaceId) || response.workspaces[0] || null;
      });
    } catch (err: any) {
      const message = err?.message || "Failed to load governed review workspaces";
      setError(message);
      showToast({ message: "Failed to load governed review workspaces", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [q, showToast, workspaceType]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let active = true;
    fetchAdminReviewWorkspaceDetail(selected.workspaceId)
      .then((response) => {
        if (active) setDetail(response.workspace);
      })
      .catch(() => {
        if (active) setDetail(null);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  return (
    <MacShell title="Admin · Governed review workspaces">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Governed review workspaces</h1>
                <Pill tone="accent">Admin</Pill>
                <Pill tone="muted">Metadata only</Pill>
                <Pill tone="muted">Read only</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 860 }}>
                Admin-only review surface for append-only governed workspace metadata. Raw notes, documents, provider payloads,
                storage paths, tokens, secrets, debug payloads, and mutation controls are excluded.
              </div>
            </div>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Card><strong>{summary.total}</strong><div style={{ color: "#64748b" }}>Workspaces</div></Card>
          <Card><strong>{workspaces.reduce((sum, item) => sum + item.appendEventCount, 0)}</strong><div style={{ color: "#64748b" }}>Append events</div></Card>
          <Card><strong>{workspaces.reduce((sum, item) => sum + item.relatedEvidenceCount, 0)}</strong><div style={{ color: "#64748b" }}>Evidence refs</div></Card>
          <Card><strong>{workspaces.reduce((sum, item) => sum + item.relatedNoteCount, 0)}</strong><div style={{ color: "#64748b" }}>Review notes</div></Card>
        </div>

        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12, minWidth: 0 }}>
            <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Workspace type</div>
              <select
                aria-label="Workspace type"
                value={workspaceType}
                onChange={(event) => setWorkspaceType(event.target.value)}
                style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
              >
                <option value="">All workspace types</option>
                {WORKSPACE_TYPES.map((item) => <option key={item} value={item}>{label(item)}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Search</div>
              <input
                aria-label="Search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search metadata"
                style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
              />
            </label>
          </div>
        </Card>

        {error ? <Card><div style={{ color: "#b91c1c" }}>{error}</div></Card> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 16 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {loading ? <Card><div>Loading governed review workspace metadata...</div></Card> : null}
            {!loading && workspaces.length === 0 ? (
              <Card>
                <div style={{ fontWeight: 700 }}>No governed review workspace records are available yet.</div>
                <div style={{ color: "#64748b", marginTop: 6, display: "grid", gap: 6 }}>
                  <div>This metadata-only surface is ready, but no persisted governed review workspace records exist yet.</div>
                  <div>Workspace records will appear after append-only persistence and write governance are enabled.</div>
                  <div>Unsupported or raw-only records are excluded by default.</div>
                  {summary.emptyState ? <div>{summary.emptyState}</div> : null}
                </div>
              </Card>
            ) : null}
            {workspaces.map((workspace) => (
              <WorkspaceRow
                key={workspace.workspaceId}
                workspace={workspace}
                selected={selected?.workspaceId === workspace.workspaceId}
                onSelect={setSelected}
              />
            ))}
          </div>
          <DetailPanel workspace={detail} />
        </div>
      </div>
    </MacShell>
  );
}
