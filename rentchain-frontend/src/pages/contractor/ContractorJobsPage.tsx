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

function toLocalInputValue(ts?: number | null) {
  if (!ts) return "";
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function fromLocalInputValue(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function findScheduledDate(item: MaintenanceWorkflowItem) {
  if (typeof item.scheduledFor === "number") return item.scheduledFor;
  const history = Array.isArray(item.statusHistory) ? item.statusHistory : [];
  const scheduledEntry = [...history]
    .filter((entry) => entry.status === "scheduled")
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
  return scheduledEntry?.createdAt || item.serviceWindowStartAt || null;
}

function statusLabel(status?: MaintenanceWorkflowStatus | string | null) {
  switch (status) {
    case "in_progress":
      return "in progress";
    case "blocked":
      return "blocked";
    case "submitted":
    case "reviewed":
    case "assigned":
    case "scheduled":
    case "completed":
    case "cancelled":
      return status;
    default:
      return "assigned";
  }
}

function normalizeJob(item: any): MaintenanceWorkflowItem | null {
  const id = String(item?.id || "").trim();
  const title = String(item?.title || "").trim();
  const description = String(item?.description || "").trim();
  if (!id || !title || !description) return null;
  const status = statusLabel(item?.status) as MaintenanceWorkflowStatus;
  return {
    ...item,
    id,
    title,
    description,
    status,
    priority: item?.priority === "low" || item?.priority === "urgent" ? item.priority : "normal",
    tenantId: String(item?.tenantId || "").trim(),
    landlordId: String(item?.landlordId || "").trim(),
    propertyId: item?.propertyId ? String(item.propertyId) : null,
    unitId: item?.unitId ? String(item.unitId) : null,
    tenantName: item?.tenantName ? String(item.tenantName) : null,
    propertyLabel: item?.propertyLabel ? String(item.propertyLabel) : null,
    unitLabel: item?.unitLabel ? String(item.unitLabel) : null,
    notes: item?.notes ? String(item.notes) : null,
    landlordNote: item?.landlordNote ? String(item.landlordNote) : null,
    contractorStatus: item?.contractorStatus ? String(item.contractorStatus) : null,
    contractorLastUpdate: item?.contractorLastUpdate ? String(item.contractorLastUpdate) : null,
    scheduledFor: typeof item?.scheduledFor === "number" ? item.scheduledFor : null,
    serviceStartedAt: typeof item?.serviceStartedAt === "number" ? item.serviceStartedAt : null,
    serviceCompletedAt: typeof item?.serviceCompletedAt === "number" ? item.serviceCompletedAt : null,
    executionBlockedReason: item?.executionBlockedReason ? String(item.executionBlockedReason) : null,
    completionSummary: item?.completionSummary ? String(item.completionSummary) : null,
    completionOutcome:
      item?.completionOutcome === "completed" ||
      item?.completionOutcome === "partially_completed" ||
      item?.completionOutcome === "follow_up_required"
        ? item.completionOutcome
        : null,
    createdAt: Number(item?.createdAt || 0),
    updatedAt: Number(item?.updatedAt || 0),
    statusHistory: Array.isArray(item?.statusHistory) ? item.statusHistory : [],
  };
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
  const [scheduledForInput, setScheduledForInput] = React.useState("");
  const [completionSummary, setCompletionSummary] = React.useState("");
  const [completionOutcome, setCompletionOutcome] = React.useState<"completed" | "partially_completed" | "follow_up_required">("completed");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listContractorMaintenanceJobs();
      const nextItems = (Array.isArray(res?.items)
        ? res.items
        : Array.isArray((res as any)?.data)
        ? (res as any).data
        : [])
        .map((item) => normalizeJob(item))
        .filter((item): item is MaintenanceWorkflowItem => Boolean(item));
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

  React.useEffect(() => {
    if (!selected) {
      setScheduledForInput("");
      setCompletionSummary("");
      setCompletionOutcome("completed");
      setNote("");
      return;
    }
    setScheduledForInput(toLocalInputValue(selected.scheduledFor || findScheduledDate(selected)));
    setCompletionSummary(String(selected.completionSummary || ""));
    setCompletionOutcome(
      selected.completionOutcome === "partially_completed" || selected.completionOutcome === "follow_up_required"
        ? selected.completionOutcome
        : "completed"
    );
    setNote(String(selected.executionBlockedReason || selected.contractorLastUpdate || ""));
  }, [selected]);

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
    async (
      status: "assigned" | "scheduled" | "blocked" | "in_progress" | "completed",
      fallbackMessage: string
    ) => {
      if (!selected) return;
      const scheduledFor = fromLocalInputValue(scheduledForInput);
      if (status === "scheduled" && scheduledForInput && !scheduledFor) {
        setError("Enter a valid scheduled service time.");
        return;
      }
      if (status === "blocked" && !note.trim()) {
        setError("A blocked job needs a reason.");
        return;
      }
      if (status === "completed" && !completionSummary.trim()) {
        setError("Add a completion summary before finishing the job.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await patchContractorMaintenanceJobStatus(selected.id, {
          status,
          message: note.trim() || fallbackMessage,
          scheduledFor: status === "scheduled" ? scheduledFor : undefined,
          blockedReason: status === "blocked" ? note.trim() : undefined,
          completionSummary: status === "completed" ? completionSummary.trim() : undefined,
          completionOutcome: status === "completed" ? completionOutcome : undefined,
        });
        if (status === "completed") {
          setCompletionSummary("");
        }
        await load();
      } catch (err: any) {
        setError(String(err?.message || "Failed to update job"));
      } finally {
        setSaving(false);
      }
    },
    [completionOutcome, completionSummary, load, note, scheduledForInput, selected]
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
        label: "Schedule service",
        onClick: () => updateStatus("scheduled", "Contractor scheduled the visit."),
      });
    }
    if (["assigned", "scheduled", "blocked"].includes(selected.status)) {
      next.push({
        label: "Start work",
        onClick: () => updateStatus("in_progress", "Contractor started the work."),
      });
    }
    if (["scheduled", "in_progress"].includes(selected.status)) {
      next.push({
        label: "Mark blocked",
        onClick: () => updateStatus("blocked", "Contractor reported a blocked visit."),
      });
    }
    if (["scheduled", "blocked", "in_progress"].includes(selected.status)) {
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
                    <div style={{ color: text.primary, fontWeight: 700 }}>{statusLabel(selected?.status)}</div>
                  </div>

                  <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Priority</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>{selected.priority}</div>
                    </div>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Scheduled service</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>{fmtDate(findScheduledDate(selected))}</div>
                    </div>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Last update</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>{fmtDate(selected.updatedAt)}</div>
                    </div>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Started</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>{fmtDate(selected.serviceStartedAt)}</div>
                    </div>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Completed</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                        {fmtDate(selected.serviceCompletedAt)}
                      </div>
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

                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      padding: "12px 14px",
                      background: colors.panel,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: text.primary }}>Execution details</div>
                    <div style={{ color: text.secondary }}>
                      {selected.executionBlockedReason
                        ? `Blocked reason: ${selected.executionBlockedReason}`
                        : selected.completionSummary
                        ? `Completion summary: ${selected.completionSummary}`
                        : selected.contractorLastUpdate || "Use the actions below to keep service progress current."}
                    </div>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ color: text.muted, fontSize: 12 }}>Scheduled service time</span>
                      <input
                        type="datetime-local"
                        value={scheduledForInput}
                        onChange={(e) => setScheduledForInput(e.target.value)}
                        style={{
                          padding: "9px 10px",
                          borderRadius: radius.md,
                          border: `1px solid ${colors.border}`,
                          background: colors.panel,
                          color: text.primary,
                        }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: text.muted, fontSize: 12 }}>
                        {selected.status === "completed" ? "Completion update" : "Execution note / blocked reason"}
                      </span>
                      <textarea
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add schedule details, a blocked reason, or a progress note"
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
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: text.muted, fontSize: 12 }}>Completion summary</span>
                      <textarea
                        rows={3}
                        value={completionSummary}
                        onChange={(e) => setCompletionSummary(e.target.value)}
                        placeholder="Summarize what work was completed"
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
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ color: text.muted, fontSize: 12 }}>Completion outcome</span>
                      <select
                        value={completionOutcome}
                        onChange={(e) =>
                          setCompletionOutcome(e.target.value as "completed" | "partially_completed" | "follow_up_required")
                        }
                        style={{
                          padding: "9px 10px",
                          borderRadius: radius.md,
                          border: `1px solid ${colors.border}`,
                          background: colors.panel,
                          color: text.primary,
                        }}
                      >
                        <option value="completed">Completed</option>
                        <option value="partially_completed">Partially completed</option>
                        <option value="follow_up_required">Follow-up required</option>
                      </select>
                    </label>
                  </div>

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
