import React from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import {
  fetchAdminSupportEscalationDetail,
  fetchAdminSupportEscalations,
  type AdminSupportEscalationDetail,
  type AdminSupportEscalationRecord,
  type AdminSupportEscalationSummary,
} from "../../api/adminSupportEscalationsApi";

const CATEGORIES = [
  "security_incident",
  "impersonation_review",
  "policy_failure",
  "projection_safety",
  "document_access",
  "export_governance",
  "credential_secret",
  "api_abuse",
  "tenant_data_exposure",
  "screening_provider",
  "billing_support",
  "technical_diagnostics",
  "compliance_review",
  "other",
];

const SEVERITIES = ["informational", "low", "medium", "high", "critical"];
const STATES = ["draft", "queued", "triage_required", "reviewing", "awaiting_approval", "approved_for_manual_action", "resolved", "dismissed"];
const APPROVALS = ["none_for_metadata_review", "support_lead_review", "admin_review", "security_review", "executive_review", "prohibited"];

function label(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Not specified";
  return raw
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTime(value: string) {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return "Unknown time";
  return new Date(ts).toLocaleString();
}

function toneForSeverity(severity: string) {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "accent";
  return "muted";
}

function EscalationRow({
  escalation,
  selected,
  onSelect,
}: {
  escalation: AdminSupportEscalationRecord;
  selected: boolean;
  onSelect: (escalation: AdminSupportEscalationRecord) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(escalation)}
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
        <strong>{escalation.title}</strong>
        <Pill tone={toneForSeverity(escalation.severity) as any}>{label(escalation.severity)}</Pill>
        <Pill tone={escalation.state === "awaiting_approval" ? "accent" : "muted"}>{label(escalation.state)}</Pill>
      </div>
      <div style={{ color: "#475569" }}>{escalation.summary}</div>
      <div style={{ color: "#64748b", fontSize: 13 }}>
        {label(escalation.category)} · {label(escalation.approvalExpectation)} · {formatTime(escalation.lastUpdatedAt)}
      </div>
    </button>
  );
}

function DetailPanel({ escalation }: { escalation: AdminSupportEscalationDetail | null }) {
  if (!escalation) {
    return (
      <Card>
        <div style={{ color: "#64748b" }}>Select an escalation to review metadata-only details.</div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{escalation.title}</h2>
          <Pill tone="muted">Metadata only</Pill>
        </div>
        <div style={{ color: "#475569" }}>{escalation.summary}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Approval expectation</div>
            <strong>{label(escalation.approvalExpectation)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Actor</div>
            <strong>{escalation.actorSummary?.displayName || escalation.actorSummary?.role || "Support/admin actor"}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>History</div>
            <strong>{escalation.historyCount} entries</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Notes</div>
            <strong>{escalation.noteCount} notes</strong>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Redaction summary</div>
          <div style={{ color: "#475569" }}>{escalation.redactionSummary}</div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Prohibited actions</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#475569" }}>
            {escalation.prohibitedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Related review workspace links</div>
          {escalation.relatedWorkspaceLinks?.length ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {escalation.relatedWorkspaceLinks.map((link) => (
                <div key={link.linkId} style={{ color: "#475569" }}>
                  {label(link.linkType)} · {link.sourceSummary.label} → {link.targetSummary.label}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#64748b", marginTop: 8 }}>No metadata-only workspace links are available yet.</div>
          )}
        </div>
      </div>
    </Card>
  );
}

const EMPTY_SUMMARY: AdminSupportEscalationSummary = {
  total: 0,
  highOrCritical: 0,
  awaitingApproval: 0,
  notes: 0,
  metadataOnly: true,
  emptyState: null,
};

export default function AdminSupportEscalationsPage() {
  const { showToast } = useToast();
  const [escalations, setEscalations] = React.useState<AdminSupportEscalationRecord[]>([]);
  const [summary, setSummary] = React.useState<AdminSupportEscalationSummary>(EMPTY_SUMMARY);
  const [selected, setSelected] = React.useState<AdminSupportEscalationRecord | null>(null);
  const [detail, setDetail] = React.useState<AdminSupportEscalationDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [state, setState] = React.useState("");
  const [approvalExpectation, setApprovalExpectation] = React.useState("");
  const [q, setQ] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchAdminSupportEscalations({
        category: category || null,
        severity: severity || null,
        state: state || null,
        approvalExpectation: approvalExpectation || null,
        q: q || null,
        limit: 50,
      });
      setEscalations(response.escalations || []);
      setSummary(response.summary);
      setSelected((current) => {
        if (!current) return response.escalations[0] || null;
        return response.escalations.find((item) => item.escalationId === current.escalationId) || response.escalations[0] || null;
      });
    } catch (err: any) {
      const message = err?.message || "Failed to load support escalations";
      setError(message);
      showToast({ message: "Failed to load support escalations", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [approvalExpectation, category, q, severity, showToast, state]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let active = true;
    fetchAdminSupportEscalationDetail(selected.escalationId)
      .then((response) => {
        if (active) setDetail(response.escalation);
      })
      .catch(() => {
        if (active) setDetail(null);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  return (
    <MacShell title="Admin · Support escalations">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Support escalations</h1>
                <Pill tone="accent">Admin</Pill>
                <Pill tone="muted">Metadata only</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 780 }}>
                Admin/support-only review surface for escalation history and manual notes. This page does not approve,
                resolve, remediate, impersonate, or expose raw note payloads.
              </div>
            </div>
          </div>
        </Section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Card><strong>{summary.total}</strong><div style={{ color: "#64748b" }}>Escalations</div></Card>
          <Card><strong>{summary.highOrCritical}</strong><div style={{ color: "#64748b" }}>High or critical</div></Card>
          <Card><strong>{summary.awaitingApproval}</strong><div style={{ color: "#64748b" }}>Awaiting approval</div></Card>
          <Card><strong>{summary.notes}</strong><div style={{ color: "#64748b" }}>Review notes</div></Card>
        </div>

        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <label>
              <div style={{ fontSize: 12, color: "#64748b" }}>Category</div>
              <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map((item) => <option key={item} value={item}>{label(item)}</option>)}
              </select>
            </label>
            <label>
              <div style={{ fontSize: 12, color: "#64748b" }}>Severity</div>
              <select aria-label="Severity" value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="">All severities</option>
                {SEVERITIES.map((item) => <option key={item} value={item}>{label(item)}</option>)}
              </select>
            </label>
            <label>
              <div style={{ fontSize: 12, color: "#64748b" }}>State</div>
              <select aria-label="State" value={state} onChange={(event) => setState(event.target.value)}>
                <option value="">All states</option>
                {STATES.map((item) => <option key={item} value={item}>{label(item)}</option>)}
              </select>
            </label>
            <label>
              <div style={{ fontSize: 12, color: "#64748b" }}>Approval expectation</div>
              <select aria-label="Approval expectation" value={approvalExpectation} onChange={(event) => setApprovalExpectation(event.target.value)}>
                <option value="">All approvals</option>
                {APPROVALS.map((item) => <option key={item} value={item}>{label(item)}</option>)}
              </select>
            </label>
            <label>
              <div style={{ fontSize: 12, color: "#64748b" }}>Search</div>
              <input aria-label="Search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search metadata" />
            </label>
          </div>
        </Card>

        {error ? <Card><div style={{ color: "#b91c1c" }}>{error}</div></Card> : null}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 420px)", gap: 16 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {loading ? <Card><div>Loading support escalation metadata...</div></Card> : null}
            {!loading && escalations.length === 0 ? (
              <Card>
                <div style={{ fontWeight: 700 }}>No support escalation metadata is available yet.</div>
                <div style={{ color: "#64748b", marginTop: 6 }}>
                  {summary.emptyState || "Append-only escalation history and review note metadata will appear here after an approved writer exists."}
                </div>
              </Card>
            ) : null}
            {escalations.map((item) => (
              <EscalationRow
                key={item.escalationId}
                escalation={item}
                selected={selected?.escalationId === item.escalationId}
                onSelect={setSelected}
              />
            ))}
          </div>
          <DetailPanel escalation={detail} />
        </div>
      </div>
    </MacShell>
  );
}
