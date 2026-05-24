import React from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import {
  fetchAdminSecurityIncidentDetail,
  fetchAdminSecurityIncidents,
  type AdminSecurityIncidentDetail,
  type AdminSecurityIncidentRecord,
} from "../../api/adminSecurityIncidentsApi";

const CATEGORIES = [
  "impersonation_started",
  "impersonation_ended",
  "impersonation_denied",
  "policy_denied",
  "projection_safety_redaction",
  "export_blocked",
  "export_prepared",
  "support_metadata_redacted",
  "route_source_anomaly",
  "auth_required_failure",
  "admin_access_denied",
  "automation_blocked",
  "webhook_failure",
  "screening_provider_callback_anomaly",
];

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

function IncidentRow({
  incident,
  selected,
  onSelect,
}: {
  incident: AdminSecurityIncidentRecord;
  selected: boolean;
  onSelect: (incident: AdminSecurityIncidentRecord) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(incident)}
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
        <strong>{incident.title}</strong>
        <Pill tone={toneForSeverity(incident.severity) as any}>{incident.severity}</Pill>
        <Pill tone={incident.status === "open" ? "accent" : "muted"}>{label(incident.status)}</Pill>
      </div>
      <div style={{ color: "#475569" }}>{incident.summary}</div>
      <div style={{ color: "#64748b", fontSize: 13 }}>
        {label(incident.category)} · {formatTime(incident.lastSeenAt)}
      </div>
    </button>
  );
}

function DetailPanel({ incident }: { incident: AdminSecurityIncidentDetail | null }) {
  if (!incident) {
    return (
      <Card>
        <div style={{ color: "#64748b" }}>Select an incident to review safe metadata details.</div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{incident.title}</h2>
          <Pill tone="muted">Metadata only</Pill>
        </div>
        <div style={{ color: "#475569" }}>{incident.summary}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Actor</div>
            <strong>{incident.actorSummary.role || "Support/admin actor"}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Target</div>
            <strong>{incident.targetSummary.accountType || incident.targetSummary.resourceType || "Scoped resource"}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Route owner</div>
            <strong>{incident.routeSource || "Not specified"}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Policy outcome</div>
            <strong>{incident.policyOutcomeSummary || "Not specified"}</strong>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Review action</div>
          <div style={{ color: "#475569" }}>{incident.suggestedNextReviewStep}</div>
        </div>
        {incident.governedReviewWorkspace ? (
          <div>
            <div style={{ fontWeight: 700 }}>Governed review workspace</div>
            <div style={{ color: "#475569", marginTop: 6 }}>{incident.governedReviewWorkspace.summary}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <Pill tone="muted">{label(incident.governedReviewWorkspace.workspaceType)}</Pill>
              <Pill tone="muted">{incident.governedReviewWorkspace.relatedEvidenceCount} evidence refs</Pill>
              <Pill tone="muted">{incident.governedReviewWorkspace.relatedEscalationCount} escalation links</Pill>
            </div>
          </div>
        ) : null}
        <div>
          <div style={{ fontWeight: 700 }}>Redaction notes</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#475569" }}>
            {incident.redactionNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Safe timeline</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {incident.timeline.map((item) => (
              <div key={`${item.occurredAt}-${item.label}`} style={{ color: "#475569" }}>
                {formatTime(item.occurredAt)} · {item.label}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Related review workspace links</div>
          {incident.relatedWorkspaceLinks?.length ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {incident.relatedWorkspaceLinks.map((link) => (
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

export default function AdminSecurityIncidentsPage() {
  const { showToast } = useToast();
  const [incidents, setIncidents] = React.useState<AdminSecurityIncidentRecord[]>([]);
  const [summary, setSummary] = React.useState({ total: 0, open: 0, reviewing: 0, highOrCritical: 0, metadataOnly: true });
  const [selected, setSelected] = React.useState<AdminSecurityIncidentRecord | null>(null);
  const [detail, setDetail] = React.useState<AdminSecurityIncidentDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [q, setQ] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchAdminSecurityIncidents({
        category: category || null,
        severity: severity || null,
        status: status || null,
        q: q || null,
        limit: 50,
      });
      setIncidents(response.incidents || []);
      setSummary(response.summary);
      setSelected((current) => {
        if (!current) return response.incidents[0] || null;
        return response.incidents.find((incident) => incident.incidentId === current.incidentId) || response.incidents[0] || null;
      });
    } catch (err: any) {
      const message = err?.message || "Failed to load security incidents";
      setError(message);
      showToast({ message: "Failed to load security incidents", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [category, q, severity, showToast, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let active = true;
    fetchAdminSecurityIncidentDetail(selected.incidentId)
      .then((response) => {
        if (active) setDetail(response.incident);
      })
      .catch(() => {
        if (active) setDetail(null);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  return (
    <MacShell title="Admin · Security incidents">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Security incidents</h1>
                <Pill tone="accent">Admin</Pill>
                <Pill tone="muted">Metadata only</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 860 }}>
                Governed review of security-relevant operational signals. Raw event payloads, credentials, provider data, tenant documents, storage paths, and support internals are redacted.
              </div>
            </div>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Search</span>
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search incidents" />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map((next) => (
                  <option key={next} value={next}>
                    {label(next)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Severity</span>
              <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="">All severities</option>
                {["info", "low", "medium", "high", "critical"].map((next) => (
                  <option key={next} value={next}>
                    {label(next)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {["open", "reviewing", "resolved", "dismissed"].map((next) => (
                  <option key={next} value={next}>
                    {label(next)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, color: "#64748b" }}>Incidents</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.total}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: "#64748b" }}>Open</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.open}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: "#64748b" }}>Reviewing</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.reviewing}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: "#64748b" }}>High or critical</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.highOrCritical}</div>
          </Card>
        </div>

        {loading ? <Card>Loading security incidents…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load security incidents: {error}</Card> : null}

        {!loading && !error ? (
          incidents.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.9fr) minmax(320px, 1.1fr)", gap: 16 }}>
              <div style={{ display: "grid", gap: 10 }}>
                {incidents.map((incident) => (
                  <IncidentRow
                    key={incident.incidentId}
                    incident={incident}
                    selected={selected?.incidentId === incident.incidentId}
                    onSelect={setSelected}
                  />
                ))}
              </div>
              <DetailPanel incident={detail} />
            </div>
          ) : (
            <Card>
              No reviewable security incident metadata is available. Unsupported or raw-only events are excluded by default.
            </Card>
          )
        ) : null}
      </div>
    </MacShell>
  );
}
