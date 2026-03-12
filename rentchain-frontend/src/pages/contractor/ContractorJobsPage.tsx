import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input, Section } from "../../components/ui/Ui";
import { ResponsiveMasterDetail } from "../../components/layout/ResponsiveMasterDetail";
import {
  listContractorMaintenanceJobs,
  patchContractorMaintenanceJobStatus,
  type MaintenanceWorkflowItem,
  type MaintenanceWorkflowStatus,
} from "../../api/maintenanceWorkflowApi";
import { colors, radius, spacing, text } from "../../styles/tokens";

function fmtDate(ts?: number | null) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function findScheduledDate(item: MaintenanceWorkflowItem) {
  const history = Array.isArray(item.statusHistory) ? item.statusHistory : [];
  const scheduledEntry = [...history]
    .filter((entry) => entry.status === "scheduled")
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
  return scheduledEntry?.createdAt || null;
}

function statusLabel(status: MaintenanceWorkflowStatus) {
  switch (status) {
    case "in_progress":
      return "in progress";
    default:
      return status;
  }
}

export default function ContractorJobsPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = React.useState<MaintenanceWorkflowItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState(routeId || "");
  const [search, setSearch] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listContractorMaintenanceJobs();
      const nextItems = Array.isArray(res?.items)
        ? res.items
        : Array.isArray((res as any)?.data)
        ? (res as any).data
        : [];
      setItems(nextItems);
    } catch (err: any) {
      setError(String(err?.message || "Failed to load jobs"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setSelectedId(routeId || "");
  }, [routeId]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!q) return true;
      return [item.title, item.tenantName, item.propertyLabel, item.unitLabel, item.description]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(q));
    });
  }, [items, search]);

  const selected = React.useMemo(
    () => filtered.find((item) => item.id === selectedId) || items.find((item) => item.id === selectedId) || null,
    [filtered, items, selectedId]
  );

  React.useEffect(() => {
    if (!selected && filtered.length > 0 && !routeId) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, routeId, selected]);

  const selectJob = (item: MaintenanceWorkflowItem | null) => {
    if (!item) {
      setSelectedId("");
      navigate("/contractor/jobs");
      return;
    }
    setSelectedId(item.id);
    navigate(`/contractor/jobs/${item.id}`);
  };

  const updateStatus = React.useCallback(
    async (status: "assigned" | "scheduled" | "in_progress" | "completed", fallbackMessage: string) => {
      if (!selected) return;
      setSaving(true);
      setError(null);
      try {
        await patchContractorMaintenanceJobStatus(selected.id, {
          status,
          message: note.trim() || fallbackMessage,
        });
        setNote("");
        await load();
      } catch (err: any) {
        setError(String(err?.message || "Failed to update job"));
      } finally {
        setSaving(false);
      }
    },
    [load, note, selected]
  );

  const actions = React.useMemo(() => {
    if (!selected) return [] as Array<{ label: string; onClick: () => Promise<void> }>;
    const next: Array<{ label: string; onClick: () => Promise<void> }> = [];
    if (selected.status === "assigned" && selected.contractorStatus !== "assigned") {
      next.push({
        label: "Accept job",
        onClick: () => updateStatus("assigned", "Contractor accepted the assigned job."),
      });
    }
    if (selected.status === "assigned") {
      next.push({
        label: "Mark scheduled",
        onClick: () => updateStatus("scheduled", "Contractor scheduled the visit."),
      });
    }
    if (selected.status === "scheduled") {
      next.push({
        label: "Mark in progress",
        onClick: () => updateStatus("in_progress", "Contractor started the work."),
      });
    }
    if (selected.status === "in_progress") {
      next.push({
        label: "Mark completed",
        onClick: () => updateStatus("completed", "Contractor completed the work."),
      });
    }
    return next;
  }, [selected, updateStatus]);

  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <Card elevated>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.2rem", color: text.primary }}>Contractor Jobs</div>
            <div style={{ color: text.muted, marginTop: 4 }}>
              Review assigned jobs, update visit status, and keep tenants informed.
            </div>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading || saving}>
            Refresh
          </Button>
        </div>
      </Card>

      {error ? <Card style={{ borderColor: colors.danger, color: colors.danger }}>{error}</Card> : null}

      <Card elevated>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs by request, tenant, property, or unit"
        />
      </Card>

      <Card elevated>
        <ResponsiveMasterDetail
          masterTitle="Assigned jobs"
          master={
            loading ? (
              <div style={{ color: text.muted }}>Loading jobs...</div>
            ) : filtered.length === 0 ? (
              <div style={{ color: text.muted }}>No assigned jobs yet.</div>
            ) : (
              <div style={{ display: "grid", gap: spacing.xs, overflowY: "auto" }}>
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectJob(item)}
                    style={{
                      textAlign: "left",
                      display: "grid",
                      gap: 4,
                      padding: "10px 12px",
                      borderRadius: radius.md,
                      border: `1px solid ${selected?.id === item.id ? colors.accent : colors.border}`,
                      background: selected?.id === item.id ? "rgba(37,99,235,0.08)" : colors.card,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ color: text.primary, fontWeight: 800 }}>{item.title}</div>
                    <div style={{ color: text.secondary, fontSize: 12 }}>
                      {item.tenantName || item.tenantId} • {item.propertyLabel || item.propertyId || "No property"}
                      {item.unitLabel ? ` • ${item.unitLabel}` : ""}
                    </div>
                    <div style={{ color: text.muted, fontSize: 12 }}>
                      {item.priority} • {item.status} • scheduled {fmtDate(findScheduledDate(item))}
                    </div>
                  </button>
                ))}
              </div>
            )
          }
          masterDropdown={
            filtered.length ? (
              <select
                value={selected?.id || ""}
                onChange={(e) => {
                  const item = filtered.find((entry) => entry.id === e.target.value) || null;
                  selectJob(item);
                }}
                className="rc-full-width-mobile"
              >
                <option value="">Select job</option>
                {filtered.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            ) : null
          }
          hasSelection={Boolean(selected)}
          selectedLabel={selected?.title || "Job"}
          onClearSelection={() => selectJob(null)}
          detail={
            <Section style={{ minHeight: 0 }}>
              {!selected ? (
                <div style={{ color: text.muted }}>Select a job to review its details.</div>
              ) : (
                <div style={{ display: "grid", gap: spacing.md }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: text.primary, fontSize: "1.2rem", fontWeight: 800 }}>{selected.title}</div>
                      <div style={{ color: text.muted, marginTop: 4 }}>
                        {selected.tenantName || selected.tenantId} • {selected.propertyLabel || selected.propertyId || "No property"}
                        {selected.unitLabel ? ` • ${selected.unitLabel}` : ""}
                      </div>
                    </div>
                    <div style={{ color: text.primary, fontWeight: 700 }}>{statusLabel(selected.status)}</div>
                  </div>

                  <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Priority</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>{selected.priority}</div>
                    </div>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Scheduled date</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>{fmtDate(findScheduledDate(selected))}</div>
                    </div>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Last update</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>{fmtDate(selected.updatedAt)}</div>
                    </div>
                  </div>

                  <div style={{ whiteSpace: "pre-wrap", color: text.primary }}>{selected.description}</div>
                  {selected.notes ? (
                    <div style={{ color: text.secondary }}>
                      <strong>Tenant notes:</strong> {selected.notes}
                    </div>
                  ) : null}
                  {selected.landlordNote ? (
                    <div style={{ color: text.secondary }}>
                      <strong>Landlord notes:</strong> {selected.landlordNote}
                    </div>
                  ) : null}

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: text.muted, fontSize: 12 }}>Update note</span>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add schedule details or a progress note"
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: radius.md,
                        border: `1px solid ${colors.border}`,
                        background: colors.panel,
                        color: text.primary,
                        resize: "vertical",
                      }}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {actions.map((action) => (
                      <Button key={action.label} onClick={() => void action.onClick()} disabled={saving}>
                        {saving ? "Saving..." : action.label}
                      </Button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontWeight: 700, color: text.primary }}>Job timeline</div>
                    {selected.statusHistory && selected.statusHistory.length ? (
                      [...selected.statusHistory]
                        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
                        .map((entry, index) => (
                          <div
                            key={`${entry.status}-${entry.createdAt}-${index}`}
                            style={{
                              border: `1px solid ${colors.border}`,
                              borderRadius: radius.md,
                              padding: "8px 10px",
                              background: colors.panel,
                            }}
                          >
                            <div style={{ color: text.primary, fontWeight: 700 }}>{entry.status}</div>
                            <div style={{ color: text.muted, fontSize: 12 }}>
                              {entry.actorRole || "system"} • {fmtDate(entry.createdAt)}
                            </div>
                            {entry.message ? <div style={{ color: text.secondary, marginTop: 4 }}>{entry.message}</div> : null}
                          </div>
                        ))
                    ) : (
                      <div style={{ color: text.muted }}>No updates yet.</div>
                    )}
                  </div>
                </div>
              )}
            </Section>
          }
        />
      </Card>
    </div>
  );
}
