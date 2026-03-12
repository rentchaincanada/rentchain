import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input, Section } from "../components/ui/Ui";
import { useToast } from "../components/ui/ToastProvider";
import { ResponsiveMasterDetail } from "../components/layout/ResponsiveMasterDetail";
import {
  assignLandlordMaintenance,
  listLandlordMaintenance,
  patchLandlordMaintenance,
  type LandlordMaintenanceContractor,
  type MaintenanceWorkflowItem,
  type MaintenanceWorkflowStatus,
} from "../api/maintenanceWorkflowApi";
import { getContractorProfileById, listContractorInvites } from "../api/workOrdersApi";
import { colors, radius, spacing, text } from "../styles/tokens";

const FILTERS: Array<{ value: "all" | MaintenanceWorkflowStatus; label: string }> = [
  { value: "all", label: "All requests" },
  { value: "submitted", label: "Submitted" },
  { value: "reviewed", label: "Reviewed" },
  { value: "assigned", label: "Assigned" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function fmtDate(ts?: number | null) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function statusTone(status: string) {
  switch (status) {
    case "completed":
      return { bg: "rgba(34,197,94,0.12)", color: "#166534" };
    case "cancelled":
      return { bg: "rgba(239,68,68,0.12)", color: "#991b1b" };
    case "in_progress":
      return { bg: "rgba(14,165,233,0.12)", color: "#0c4a6e" };
    case "scheduled":
      return { bg: "rgba(59,130,246,0.12)", color: "#1d4ed8" };
    case "assigned":
      return { bg: "rgba(124,58,237,0.12)", color: "#6d28d9" };
    case "reviewed":
      return { bg: "rgba(245,158,11,0.16)", color: "#92400e" };
    default:
      return { bg: colors.accentSoft, color: colors.accent };
  }
}

function contractorLabel(contractor: LandlordMaintenanceContractor) {
  return contractor.businessName || contractor.contactName || contractor.email || contractor.id;
}

export default function MaintenanceRequestsPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [items, setItems] = React.useState<MaintenanceWorkflowItem[]>([]);
  const [contractors, setContractors] = React.useState<LandlordMaintenanceContractor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>(routeId || "");
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | MaintenanceWorkflowStatus>("all");
  const [saving, setSaving] = React.useState(false);
  const [landlordNote, setLandlordNote] = React.useState("");
  const [priority, setPriority] = React.useState<"low" | "normal" | "urgent">("normal");
  const [contractorId, setContractorId] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestsRes, invites] = await Promise.all([
        listLandlordMaintenance(filter === "all" ? undefined : filter),
        listContractorInvites(),
      ]);
      const nextItems = Array.isArray(requestsRes?.items)
        ? requestsRes.items
        : Array.isArray((requestsRes as any)?.data)
        ? (requestsRes as any).data
        : [];
      const acceptedInvites = Array.isArray(invites)
        ? invites.filter((invite) => invite.status === "accepted" && invite.acceptedByUserId)
        : [];
      const contractorProfiles = await Promise.all(
        acceptedInvites.map(async (invite) => {
          const contractorId = String(invite.acceptedByUserId || "").trim();
          if (!contractorId) return null;
          try {
            const profile = await getContractorProfileById(contractorId);
            return {
              id: contractorId,
              businessName: String(profile?.businessName || "").trim() || null,
              contactName: String(profile?.contactName || "").trim() || null,
              email: String(profile?.email || invite.email || "").trim() || null,
            } as LandlordMaintenanceContractor;
          } catch {
            return {
              id: contractorId,
              businessName: null,
              contactName: null,
              email: String(invite.email || "").trim() || null,
            } as LandlordMaintenanceContractor;
          }
        })
      );
      const nextContractors = contractorProfiles.filter(
        (item, index, list): item is LandlordMaintenanceContractor =>
          Boolean(item?.id) && list.findIndex((entry) => entry?.id === item?.id) === index
      );
      setItems(nextItems);
      setContractors(nextContractors);
    } catch (err: any) {
      setItems([]);
      setContractors([]);
      setError(String(err?.message || "Failed to load maintenance requests"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
      return [
        item.title,
        item.tenantName,
        item.propertyLabel,
        item.unitLabel,
        item.description,
        item.category,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(q));
    });
  }, [items, search]);

  const selected = React.useMemo(
    () => filtered.find((item) => item.id === selectedId) || items.find((item) => item.id === selectedId) || null,
    [filtered, items, selectedId]
  );

  React.useEffect(() => {
    if (selected) {
      setLandlordNote(String(selected.landlordNote || ""));
      setPriority(selected.priority || "normal");
      setContractorId(String(selected.assignedContractorId || ""));
      return;
    }
    if (filtered.length > 0 && !routeId) {
      const first = filtered[0];
      setSelectedId(first.id);
      setLandlordNote(String(first.landlordNote || ""));
      setPriority(first.priority || "normal");
      setContractorId(String(first.assignedContractorId || ""));
    }
  }, [filtered, routeId, selected]);

  const selectRequest = (item: MaintenanceWorkflowItem | null) => {
    if (!item) {
      setSelectedId("");
      navigate("/maintenance");
      return;
    }
    setSelectedId(item.id);
    navigate(`/maintenance/${item.id}`);
  };

  const saveMeta = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await patchLandlordMaintenance(selected.id, {
        priority,
        landlordNote,
      });
      showToast({ message: "Request details saved.", variant: "success" });
      await load();
    } catch (err: any) {
      setError(String(err?.message || "Failed to save request"));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = React.useCallback(
    async (status: MaintenanceWorkflowStatus, message: string) => {
      if (!selected) return;
      setSaving(true);
      setError(null);
      try {
        await patchLandlordMaintenance(selected.id, {
          status,
          priority,
          landlordNote,
          message,
        });
        showToast({ message: `Request moved to ${status}.`, variant: "success" });
        await load();
      } catch (err: any) {
        setError(String(err?.message || "Failed to update status"));
      } finally {
        setSaving(false);
      }
    },
    [landlordNote, load, priority, selected, showToast]
  );

  const assignContractor = React.useCallback(async () => {
    if (!selected || !contractorId) return;
    setSaving(true);
    setError(null);
    try {
      await assignLandlordMaintenance(selected.id, contractorId);
      showToast({ message: "Contractor assigned.", variant: "success" });
      await load();
    } catch (err: any) {
      setError(String(err?.message || "Failed to assign contractor"));
    } finally {
      setSaving(false);
    }
  }, [contractorId, load, selected, showToast]);

  const requestActions = React.useMemo(() => {
    if (!selected) return [] as Array<{ label: string; onClick: () => Promise<void> }>;
    const actions: Array<{ label: string; onClick: () => Promise<void> }> = [];
    if (selected.status === "submitted") {
      actions.push({
        label: "Mark reviewed",
        onClick: () => updateStatus("reviewed", "Landlord reviewed the request."),
      });
    }
    if ((selected.status === "reviewed" || selected.status === "assigned") && contractorId) {
      actions.push({
        label: selected.assignedContractorId ? "Reassign contractor" : "Assign contractor",
        onClick: assignContractor,
      });
    }
    if (selected.status === "assigned") {
      actions.push({
        label: "Mark scheduled",
        onClick: () => updateStatus("scheduled", "Visit scheduled with the assigned contractor."),
      });
    }
    if (!["completed", "cancelled"].includes(selected.status)) {
      actions.push({
        label: selected.status === "in_progress" ? "Close as completed" : "Close request",
        onClick: () =>
          updateStatus(
            selected.status === "in_progress" ? "completed" : "cancelled",
            selected.status === "in_progress"
              ? "Landlord closed the request as completed."
              : "Landlord closed the request."
          ),
      });
    }
    return actions;
  }, [assignContractor, contractorId, selected, updateStatus]);

  const totalOpen = items.filter((item) => !["completed", "cancelled"].includes(item.status)).length;
  const needsReview = items.filter((item) => item.status === "submitted").length;
  const activeJobs = items.filter((item) => ["assigned", "scheduled", "in_progress"].includes(item.status)).length;

  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <Card elevated>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: text.primary }}>Maintenance Workflow</h1>
            <div style={{ color: text.muted, marginTop: 6 }}>
              Review tenant requests, assign contractors, and track operational progress.
            </div>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading || saving}>
            Refresh
          </Button>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: spacing.md }}>
          {[
            { label: "Open requests", value: totalOpen },
            { label: "Need review", value: needsReview },
            { label: "Active jobs", value: activeJobs },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: "10px 12px",
                background: colors.panel,
              }}
            >
              <div style={{ color: text.muted, fontSize: 12 }}>{item.label}</div>
              <div style={{ color: text.primary, fontSize: 24, fontWeight: 800 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {error ? <Card style={{ borderColor: colors.danger, color: colors.danger }}>{error}</Card> : null}

      <Card elevated>
        <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tenant, property, unit, or title"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | MaintenanceWorkflowStatus)}
            style={{
              padding: "9px 10px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              color: text.primary,
            }}
          >
            {FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card elevated>
        <ResponsiveMasterDetail
          masterTitle="Requests"
          master={
            <div style={{ minHeight: 0, display: "grid", gap: spacing.sm }}>
              {loading ? (
                <div style={{ color: text.muted }}>Loading requests...</div>
              ) : filtered.length === 0 ? (
                <div style={{ color: text.muted }}>No requests match the current filters.</div>
              ) : (
                <div style={{ display: "grid", gap: spacing.xs, overflowY: "auto" }}>
                  {filtered.map((item) => {
                    const tone = statusTone(item.status);
                    const active = item.id === selected?.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectRequest(item)}
                        style={{
                          display: "grid",
                          gap: 4,
                          padding: "10px 12px",
                          textAlign: "left",
                          borderRadius: radius.md,
                          border: `1px solid ${active ? colors.accent : colors.border}`,
                          background: active ? "rgba(37,99,235,0.08)" : colors.card,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 800, color: text.primary }}>{item.title}</div>
                        <div style={{ color: text.secondary, fontSize: 12 }}>
                          {item.tenantName || item.tenantId} • {item.propertyLabel || item.propertyId || "No property"}
                          {item.unitLabel ? ` • ${item.unitLabel}` : ""}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "4px 8px",
                              borderRadius: radius.pill,
                              background: tone.bg,
                              color: tone.color,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {item.status}
                          </span>
                          <span style={{ color: text.muted, fontSize: 12 }}>{item.priority}</span>
                          <span style={{ color: text.muted, fontSize: 12 }}>{fmtDate(item.createdAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          }
          masterDropdown={
            filtered.length ? (
              <select
                value={selected?.id || ""}
                onChange={(e) => {
                  const item = filtered.find((entry) => entry.id === e.target.value) || null;
                  selectRequest(item);
                }}
                className="rc-full-width-mobile"
              >
                <option value="">Select request</option>
                {filtered.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            ) : null
          }
          hasSelection={Boolean(selected)}
          selectedLabel={selected?.title || "Request"}
          onClearSelection={() => selectRequest(null)}
          detail={
            <Section style={{ minHeight: 0 }}>
              {!selected ? (
                <div style={{ color: text.muted }}>Select a request to review details.</div>
              ) : (
                <div style={{ display: "grid", gap: spacing.md }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: text.primary }}>{selected.title}</div>
                      <div style={{ color: text.muted, marginTop: 4 }}>
                        {selected.tenantName || selected.tenantId} • {selected.propertyLabel || selected.propertyId || "No property"}
                        {selected.unitLabel ? ` • ${selected.unitLabel}` : ""}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        padding: "6px 10px",
                        borderRadius: radius.pill,
                        background: statusTone(selected.status).bg,
                        color: statusTone(selected.status).color,
                        fontWeight: 700,
                      }}
                    >
                      {selected.status}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Priority</div>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as "low" | "normal" | "urgent")}
                        style={{
                          width: "100%",
                          marginTop: 4,
                          padding: "9px 10px",
                          borderRadius: radius.md,
                          border: `1px solid ${colors.border}`,
                          background: colors.panel,
                        }}
                      >
                        <option value="low">low</option>
                        <option value="normal">normal</option>
                        <option value="urgent">urgent</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Contractor</div>
                      <select
                        value={contractorId}
                        onChange={(e) => setContractorId(e.target.value)}
                        style={{
                          width: "100%",
                          marginTop: 4,
                          padding: "9px 10px",
                          borderRadius: radius.md,
                          border: `1px solid ${colors.border}`,
                          background: colors.panel,
                        }}
                      >
                        <option value="">Select contractor</option>
                        {contractors.map((contractor) => (
                          <option key={contractor.id} value={contractor.id}>
                            {contractorLabel(contractor)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{ color: text.muted, fontSize: 12 }}>Created</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 8 }}>{fmtDate(selected.createdAt)}</div>
                    </div>
                  </div>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ color: text.muted, fontSize: 12 }}>Landlord notes</span>
                    <textarea
                      value={landlordNote}
                      onChange={(e) => setLandlordNote(e.target.value)}
                      rows={4}
                      style={{
                        padding: "10px",
                        borderRadius: radius.md,
                        border: `1px solid ${colors.border}`,
                        background: colors.panel,
                        color: text.primary,
                        resize: "vertical",
                      }}
                    />
                  </label>

                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ color: text.muted, fontSize: 12 }}>Description</div>
                    <div style={{ whiteSpace: "pre-wrap", color: text.primary }}>{selected.description}</div>
                    {selected.notes ? (
                      <div style={{ color: text.secondary }}>
                        <strong>Tenant notes:</strong> {selected.notes}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button onClick={() => void saveMeta()} disabled={saving}>
                      {saving ? "Saving..." : "Save details"}
                    </Button>
                    {requestActions.map((action) => (
                      <Button key={action.label} variant="secondary" onClick={() => void action.onClick()} disabled={saving}>
                        {saving ? "Saving..." : action.label}
                      </Button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontWeight: 700, color: text.primary }}>Status timeline</div>
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
                      <div style={{ color: text.muted }}>No status updates yet.</div>
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
