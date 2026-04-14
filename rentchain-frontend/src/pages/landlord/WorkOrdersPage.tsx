import React from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { AddExpenseModal } from "../../components/expenses/AddExpenseModal";
import { useEntitlements } from "@/hooks/useEntitlements";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { fetchProperties } from "../../api/propertiesApi";
import {
  addWorkOrderUpdate,
  approveWorkOrderResolution,
  assignWorkOrderRework,
  completeWorkOrderRework,
  confirmWorkOrderCompletion,
  getWorkOrder,
  getContractorProfileById,
  listWorkOrderUpdates,
  listWorkOrders,
  markWorkOrderFollowUpRequired,
  patchWorkOrder,
  reopenWorkOrder,
  startWorkOrderRework,
  updateWorkOrderEvidence,
  uploadWorkOrderEvidence,
  type WorkOrderEvidenceType,
  type WorkOrderEvidenceVisibility,
  type WorkOrderRecord,
  type WorkOrderUpdateRecord,
} from "../../api/workOrdersApi";
import { type ExpenseCategory } from "../../api/expensesApi";

function formatDate(ms?: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

function canCompleteWorkOrder(item: WorkOrderRecord) {
  return item.status !== "completed" && item.status !== "cancelled";
}

function canConfirmCompletion(item: WorkOrderRecord) {
  return item.status === "completed" && !item.completionConfirmedByLandlordAt;
}

function canApproveResolution(item: WorkOrderRecord) {
  return item.status === "completed" && item.resolutionStatus !== "tenant_pending_signoff" && item.resolutionStatus !== "resolved";
}

function canReopenWorkOrder(item: WorkOrderRecord) {
  return item.status === "completed";
}

function resolutionStatusLabel(value?: WorkOrderRecord["resolutionStatus"]) {
  switch (value) {
    case "completed_pending_review":
      return "Completed, pending review";
    case "landlord_approved":
      return "Landlord approved";
    case "tenant_pending_signoff":
      return "Awaiting tenant signoff";
    case "resolved":
      return "Resolved";
    case "follow_up_required":
      return "Follow-up required";
    default:
      return "Not set";
  }
}

function completionOutcomeLabel(value?: WorkOrderRecord["completionOutcome"]) {
  switch (value) {
    case "partially_completed":
      return "Partially completed";
    case "follow_up_required":
      return "Follow-up required";
    case "completed":
      return "Completed";
    default:
      return "-";
  }
}

function evidenceTypeLabel(value?: WorkOrderEvidenceType | null) {
  switch (value) {
    case "before":
      return "Before";
    case "during":
      return "During";
    case "after":
      return "After";
    case "completion":
      return "Completion";
    case "inspection":
      return "Inspection";
    case "damage":
      return "Damage";
    default:
      return "Other";
  }
}

function evidenceVisibilityLabel(value?: WorkOrderEvidenceVisibility | null) {
  switch (value) {
    case "internal":
      return "Internal only";
    case "tenant_safe":
      return "Tenant-safe";
    default:
      return "Landlord + contractor";
  }
}

export default function WorkOrdersPage() {
  const entitlements = useEntitlements();
  const [items, setItems] = React.useState<WorkOrderRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<WorkOrderRecord | null>(null);
  const [updates, setUpdates] = React.useState<WorkOrderUpdateRecord[]>([]);
  const [newNote, setNewNote] = React.useState("");
  const [completionSummary, setCompletionSummary] = React.useState("");
  const [completionOutcome, setCompletionOutcome] = React.useState<"completed" | "partially_completed" | "follow_up_required">(
    "completed"
  );
  const [reopenReason, setReopenReason] = React.useState("");
  const [followUpReason, setFollowUpReason] = React.useState("");
  const [reworkContractorId, setReworkContractorId] = React.useState("");
  const [reworkNotes, setReworkNotes] = React.useState("");
  const [reworkOutcome, setReworkOutcome] = React.useState<"resolved" | "partial">("resolved");
  const [savingNote, setSavingNote] = React.useState(false);
  const [savingAction, setSavingAction] = React.useState(false);
  const [savingEvidence, setSavingEvidence] = React.useState(false);
  const [properties, setProperties] = React.useState<Array<{ id: string; name: string }>>([]);
  const [convertTarget, setConvertTarget] = React.useState<WorkOrderRecord | null>(null);
  const [convertVendor, setConvertVendor] = React.useState("");
  const [isMobile, setIsMobile] = React.useState(false);
  const [evidenceFile, setEvidenceFile] = React.useState<File | null>(null);
  const [evidenceType, setEvidenceType] = React.useState<WorkOrderEvidenceType>("inspection");
  const [evidenceCaption, setEvidenceCaption] = React.useState("");
  const [evidenceVisibility, setEvidenceVisibility] = React.useState<WorkOrderEvidenceVisibility>("internal");
  const canUseWorkOrders = entitlements.canUseWorkOrders;

  const normalizeCategory = React.useCallback((input: string): ExpenseCategory => {
    const raw = String(input || "").trim().toLowerCase();
    if (raw.includes("repair")) return "Repairs";
    if (raw.includes("maint")) return "Maintenance";
    if (raw.includes("clean")) return "Cleaning";
    if (raw.includes("util")) return "Utilities";
    if (raw.includes("land")) return "Landscaping";
    if (raw.includes("tax")) return "Taxes";
    if (raw.includes("insur")) return "Insurance";
    return "Other";
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await listWorkOrders();
      setItems(nextItems);
      setSelected((current) => (current ? nextItems.find((item) => item.id === current.id) || current : null));
    } catch (err: any) {
      setError(String(err?.message || "Failed to load work orders"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUpdates = React.useCallback(async (workOrderId: string) => {
    try {
      setUpdates(await listWorkOrderUpdates(workOrderId));
    } catch {
      setUpdates([]);
    }
  }, []);

  const refreshSelected = React.useCallback(
    async (workOrderId: string) => {
      const refreshed = await getWorkOrder(workOrderId).catch(() => null);
      if (refreshed) {
        setSelected(refreshed);
      }
      await loadUpdates(workOrderId);
    },
    [loadUpdates]
  );

  const syncSelectedItem = React.useCallback((next: WorkOrderRecord) => {
    setSelected(next);
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const markCompleted = React.useCallback(
    async (item: WorkOrderRecord) => {
      if (!canCompleteWorkOrder(item) || item.assignedContractorId) return;
      if (!completionSummary.trim()) {
        setError("Add a completion summary before marking the work order completed.");
        return;
      }
      setSavingAction(true);
      setError(null);
      try {
        await patchWorkOrder(item.id, {
          status: "completed",
          completionSummary: completionSummary.trim(),
          completionOutcome,
        });
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to complete work order"));
      } finally {
        setSavingAction(false);
      }
    },
    [completionOutcome, completionSummary, load, refreshSelected]
  );

  const handleConfirmCompletion = React.useCallback(
    async (item: WorkOrderRecord) => {
      if (!canConfirmCompletion(item)) return;
      setSavingAction(true);
      setError(null);
      try {
        await confirmWorkOrderCompletion(item.id);
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to confirm completion"));
      } finally {
        setSavingAction(false);
      }
    },
    [load, refreshSelected]
  );

  const handleApproveResolution = React.useCallback(
    async (item: WorkOrderRecord) => {
      if (!canApproveResolution(item)) return;
      setSavingAction(true);
      setError(null);
      try {
        await approveWorkOrderResolution(item.id);
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to approve resolution"));
      } finally {
        setSavingAction(false);
      }
    },
    [load, refreshSelected]
  );

  const handleMarkFollowUpRequired = React.useCallback(
    async (item: WorkOrderRecord) => {
      if (!item || item.status !== "completed") return;
      if (!followUpReason.trim()) {
        setError("Add a follow-up reason before marking the work order for follow-up.");
        return;
      }
      setSavingAction(true);
      setError(null);
      try {
        await markWorkOrderFollowUpRequired(item.id, { reason: followUpReason.trim() });
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to mark follow-up required"));
      } finally {
        setSavingAction(false);
      }
    },
    [followUpReason, load, refreshSelected]
  );

  const handleReopen = React.useCallback(
    async (item: WorkOrderRecord, status: "in_progress" | "blocked") => {
      if (!canReopenWorkOrder(item)) return;
      if (!reopenReason.trim()) {
        setError("Add a reason before reopening the work order.");
        return;
      }
      setSavingAction(true);
      setError(null);
      try {
        await reopenWorkOrder(item.id, { reason: reopenReason.trim(), status });
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to reopen work order"));
      } finally {
        setSavingAction(false);
      }
    },
    [load, refreshSelected, reopenReason]
  );

  const handleStartRework = React.useCallback(
    async (item: WorkOrderRecord) => {
      setSavingAction(true);
      setError(null);
      try {
        await startWorkOrderRework(item.id);
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to start rework"));
      } finally {
        setSavingAction(false);
      }
    },
    [load, refreshSelected]
  );

  const handleAssignRework = React.useCallback(
    async (item: WorkOrderRecord) => {
      if (!reworkContractorId.trim()) {
        setError("Add a contractor ID before assigning the rework cycle.");
        return;
      }
      setSavingAction(true);
      setError(null);
      try {
        await assignWorkOrderRework(item.id, reworkContractorId.trim());
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to assign rework"));
      } finally {
        setSavingAction(false);
      }
    },
    [load, refreshSelected, reworkContractorId]
  );

  const handleCompleteRework = React.useCallback(
    async (item: WorkOrderRecord) => {
      setSavingAction(true);
      setError(null);
      try {
        await completeWorkOrderRework(item.id, {
          outcome: reworkOutcome,
          notes: reworkNotes.trim() || undefined,
        });
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to complete rework"));
      } finally {
        setSavingAction(false);
      }
    },
    [load, refreshSelected, reworkNotes, reworkOutcome]
  );

  const handleEvidenceUpload = React.useCallback(async () => {
    if (!selected) return;
    if (!evidenceFile) {
      setError("Choose an image before uploading evidence.");
      return;
    }
    setSavingEvidence(true);
    setError(null);
    try {
      const refreshed = await uploadWorkOrderEvidence(selected.id, {
        file: evidenceFile,
        evidenceType,
        caption: evidenceCaption.trim() || undefined,
        visibility: evidenceVisibility,
      });
      syncSelectedItem(refreshed);
      await loadUpdates(selected.id);
      setEvidenceFile(null);
      setEvidenceCaption("");
      setEvidenceType("inspection");
      setEvidenceVisibility("internal");
    } catch (err: any) {
      setError(String(err?.message || "Failed to upload work order evidence"));
    } finally {
      setSavingEvidence(false);
    }
  }, [evidenceCaption, evidenceFile, evidenceType, evidenceVisibility, loadUpdates, selected, syncSelectedItem]);

  const markEvidenceTenantSafe = React.useCallback(
    async (evidenceId: string) => {
      if (!selected) return;
      setSavingEvidence(true);
      setError(null);
      try {
        const refreshed = await updateWorkOrderEvidence(selected.id, evidenceId, { visibility: "tenant_safe" });
        syncSelectedItem(refreshed);
      } catch (err: any) {
        setError(String(err?.message || "Failed to update evidence visibility"));
      } finally {
        setSavingEvidence(false);
      }
    },
    [selected, syncSelectedItem]
  );

  React.useEffect(() => {
    if (!selected) {
      setCompletionSummary("");
      setCompletionOutcome("completed");
      setReopenReason("");
      setFollowUpReason("");
      setReworkContractorId("");
      setReworkNotes("");
      setReworkOutcome("resolved");
      setEvidenceFile(null);
      setEvidenceCaption("");
      setEvidenceType("inspection");
      setEvidenceVisibility("internal");
      return;
    }
    setCompletionSummary(String(selected.completionSummary || ""));
    setCompletionOutcome(
      selected.completionOutcome === "partially_completed" || selected.completionOutcome === "follow_up_required"
        ? selected.completionOutcome
        : "completed"
    );
    setReopenReason(String(selected.reopenReason || ""));
    setFollowUpReason(String(selected.followUpReason || ""));
    setReworkContractorId(String(selected.reworkCycle?.assignedContractorId || selected.assignedContractorId || ""));
    setReworkNotes("");
    setReworkOutcome("resolved");
  }, [selected]);

  React.useEffect(() => {
    if (!canUseWorkOrders) {
      setLoading(false);
      setItems([]);
      return;
    }
    void load();
  }, [canUseWorkOrders, load]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener?.(update);
    return () => media.removeListener?.(update);
  }, []);

  React.useEffect(() => {
    if (!canUseWorkOrders) {
      setProperties([]);
      return;
    }
    const run = async () => {
      try {
        const data = await fetchProperties();
        const items = Array.isArray((data as any)?.items)
          ? (data as any).items
          : Array.isArray((data as any)?.properties)
          ? (data as any).properties
          : [];
        setProperties(
          items
            .map((p: any) => ({
              id: String(p?.id || ""),
              name: String(p?.name || p?.addressLine1 || "Property"),
            }))
            .filter((p: any) => p.id)
        );
      } catch {
        setProperties([]);
      }
    };
    void run();
  }, [canUseWorkOrders]);

  if (!canUseWorkOrders) {
    return (
      <LockedFeature
        featureKey="work_orders"
        title="Work orders start on Starter"
        description="Keep contractor assignments, in-house completion, and maintenance follow-through in one workflow once your plan includes work orders."
        hint="Starter adds day-to-day operations tools so maintenance work does not split across notes, texts, and spreadsheets."
        ctaLabel="Upgrade to Starter"
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.06rem" }}>Work Orders</div>
          <div style={{ color: "#64748b", marginTop: 4 }}>Create, assign, and track landlord maintenance jobs.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
          <Link to="/work-orders/new">
            <Button>Create Work Order</Button>
          </Link>
        </div>
      </Card>

      {error ? (
        <Card style={{ borderColor: "#ef4444", color: "#991b1b" }}>{error}</Card>
      ) : null}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr)", alignItems: "start" }}>
        <Card>
          {loading ? (
            <div>Loading work orders...</div>
          ) : items.length === 0 ? (
            <div style={{ color: "#64748b" }}>No work orders yet.</div>
          ) : isMobile ? (
            <div style={{ display: "grid", gap: 12 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 12,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {item.category || "Uncategorized"} · {item.priority} priority
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    <div>
                      <strong>Status:</strong> {item.status}
                    </div>
                    <div>
                      <strong>Assigned:</strong> {item.assignedContractorId || "-"}
                    </div>
                    <div>
                      <strong>Updated:</strong> {formatDate(item.updatedAtMs)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelected(item);
                        void loadUpdates(item.id);
                      }}
                    >
                      Timeline
                    </Button>
                    {!item.assignedContractorId && canCompleteWorkOrder(item) ? (
                      <Button
                        variant="ghost"
                        onClick={() => void markCompleted(item)}
                      >
                        Mark Completed In-house
                      </Button>
                    ) : null}
                    {item.status === "completed" && !item.linkedExpenseId ? (
                      <Button
                        onClick={async () => {
                          setConvertTarget(item);
                          const contractorId = String(item.assignedContractorId || "").trim();
                          if (!contractorId) {
                            setConvertVendor("");
                            return;
                          }
                          try {
                            const contractor = await getContractorProfileById(contractorId);
                            const vendor =
                              String(contractor?.businessName || "").trim() ||
                              String(contractor?.contactName || "").trim() ||
                              "";
                            setConvertVendor(vendor);
                          } catch {
                            setConvertVendor("");
                          }
                        }}
                      >
                        Convert to Expense
                      </Button>
                    ) : null}
                    {item.linkedExpenseId ? (
                      <span style={{ fontSize: 12, color: "#16a34a", padding: "6px 2px" }}>
                        Expense linked
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: 8 }}>Title</th>
                  <th style={{ padding: 8 }}>Category</th>
                  <th style={{ padding: 8 }}>Priority</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Assigned</th>
                  <th style={{ padding: 8 }}>Updated</th>
                  <th style={{ padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 8, fontWeight: 600 }}>{item.title}</td>
                    <td style={{ padding: 8 }}>{item.category || "-"}</td>
                    <td style={{ padding: 8 }}>{item.priority}</td>
                    <td style={{ padding: 8 }}>{item.status}</td>
                    <td style={{ padding: 8 }}>{item.assignedContractorId || "-"}</td>
                    <td style={{ padding: 8 }}>{formatDate(item.updatedAtMs)}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelected(item);
                            void loadUpdates(item.id);
                          }}
                        >
                          Timeline
                        </Button>
                        {!item.assignedContractorId && canCompleteWorkOrder(item) ? (
                          <Button
                            variant="ghost"
                            onClick={() => void markCompleted(item)}
                          >
                            Mark Completed In-house
                          </Button>
                        ) : null}
                        {item.status === "completed" && !item.linkedExpenseId ? (
                          <Button
                            onClick={async () => {
                              setConvertTarget(item);
                              const contractorId = String(item.assignedContractorId || "").trim();
                              if (!contractorId) {
                                setConvertVendor("");
                                return;
                              }
                              try {
                                const contractor = await getContractorProfileById(contractorId);
                                const vendor =
                                  String(contractor?.businessName || "").trim() ||
                                  String(contractor?.contactName || "").trim() ||
                                  "";
                                setConvertVendor(vendor);
                              } catch {
                                setConvertVendor("");
                              }
                            }}
                          >
                            Convert to Expense
                          </Button>
                        ) : null}
                        {item.linkedExpenseId ? (
                          <span style={{ fontSize: 12, color: "#16a34a", padding: "6px 2px" }}>
                            Expense linked
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {selected ? (
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Timeline: {selected.title}</div>
            <div
              style={{
                display: "grid",
                gap: 10,
                marginBottom: 12,
                padding: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 700 }}>Execution and completion</div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Scheduled time</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{formatDate(selected.scheduledFor)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Service started</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>
                    {formatDate(selected.serviceStartedAt || selected.startedAtMs)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Service completed</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>
                    {formatDate(selected.serviceCompletedAt || selected.completedAtMs)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Completion outcome</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{completionOutcomeLabel(selected.completionOutcome)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Completed by</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{selected.completedByActorRole || "-"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Landlord confirmation</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>
                    {selected.completionConfirmedByLandlordAt
                      ? `Confirmed ${formatDate(selected.completionConfirmedByLandlordAt)}`
                      : "Awaiting review"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Resolution state</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{resolutionStatusLabel(selected.resolutionStatus)}</div>
                </div>
              </div>
              {selected.executionBlockedReason ? (
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Blocked reason</div>
                  <div style={{ marginTop: 4 }}>{selected.executionBlockedReason}</div>
                </div>
              ) : null}
              {selected.completionSummary ? (
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Completion summary</div>
                  <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{selected.completionSummary}</div>
                </div>
              ) : null}
              {selected.reopenReason ? (
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Last reopen reason</div>
                  <div style={{ marginTop: 4 }}>{selected.reopenReason}</div>
                </div>
              ) : null}
              {selected.followUpReason ? (
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Follow-up reason</div>
                  <div style={{ marginTop: 4 }}>{selected.followUpReason}</div>
                </div>
              ) : null}
              {selected.reworkCycle ? (
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Active rework cycle</div>
                  <div style={{ marginTop: 4 }}>
                    Rework #{selected.reworkCycle.cycleNumber} • {selected.reworkCycle.status.replaceAll("_", " ")}
                  </div>
                  {selected.reworkCycle.completionSummary ? (
                    <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{selected.reworkCycle.completionSummary}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div
              style={{
                display: "grid",
                gap: 8,
                marginBottom: 12,
                padding: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 700 }}>Rework cycle</div>
              <div style={{ color: "#64748b" }}>
                {selected.reworkCycle
                  ? `Rework #${selected.reworkCycle.cycleNumber} is ${selected.reworkCycle.status.replaceAll("_", " ")}.`
                  : selected.resolutionStatus === "follow_up_required"
                  ? "This work order is ready to move into a structured rework cycle."
                  : "No active rework cycle."}
              </div>
              {selected.reworkCycle ? (
                <>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Created {formatDate(selected.reworkCycle.createdAt)} • Assigned {formatDate(selected.reworkCycle.assignedAt)} • Started{" "}
                    {formatDate(selected.reworkCycle.startedAt)} • Completed {formatDate(selected.reworkCycle.completedAt)}
                  </div>
                  <input
                    value={reworkContractorId}
                    onChange={(e) => setReworkContractorId(e.target.value)}
                    placeholder="Contractor ID for rework assignment"
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                  />
                  <textarea
                    value={reworkNotes}
                    onChange={(e) => setReworkNotes(e.target.value)}
                    placeholder="Add notes for how this rework cycle should close"
                    rows={3}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
                  />
                  <select
                    value={reworkOutcome}
                    onChange={(e) => setReworkOutcome(e.target.value as "resolved" | "partial")}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                  >
                    <option value="resolved">Resolved</option>
                    <option value="partial">Partial</option>
                  </select>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selected.reworkCycle.status !== "completed" ? (
                      <Button variant="secondary" disabled={savingAction} onClick={() => void handleAssignRework(selected)}>
                        {savingAction ? "Saving..." : "Assign rework"}
                      </Button>
                    ) : null}
                    {selected.reworkCycle.status === "completed" ? (
                      <Button disabled={savingAction} onClick={() => void handleCompleteRework(selected)}>
                        {savingAction ? "Saving..." : "Complete rework cycle"}
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : selected.resolutionStatus === "follow_up_required" ? (
                <Button disabled={savingAction} onClick={() => void handleStartRework(selected)}>
                  {savingAction ? "Saving..." : "Start rework"}
                </Button>
              ) : selected.reworkHistory?.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {selected.reworkHistory.map((entry) => (
                    <div key={entry.cycleNumber} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>Rework #{entry.cycleNumber}</div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        Started {formatDate(entry.startedAt)} • Completed {formatDate(entry.completedAt)} • Outcome {entry.outcome || "-"}
                      </div>
                      {entry.notes ? <div style={{ marginTop: 4 }}>{entry.notes}</div> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div
              style={{
                display: "grid",
                gap: 10,
                marginBottom: 12,
                padding: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 700 }}>Evidence photos</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Keep before, during, completion, and review photos with the work order so service proof stays attached to the job.
              </div>
              <input
                aria-label="Evidence file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              />
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <select
                  aria-label="Evidence type"
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value as WorkOrderEvidenceType)}
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                >
                  <option value="before">Before</option>
                  <option value="during">During</option>
                  <option value="after">After</option>
                  <option value="completion">Completion</option>
                  <option value="inspection">Inspection</option>
                  <option value="damage">Damage</option>
                  <option value="other">Other</option>
                </select>
                <select
                  aria-label="Evidence visibility"
                  value={evidenceVisibility}
                  onChange={(e) => setEvidenceVisibility(e.target.value as WorkOrderEvidenceVisibility)}
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                >
                  <option value="internal">Internal only</option>
                  <option value="landlord_contractor">Landlord + contractor</option>
                  <option value="tenant_safe">Tenant-safe</option>
                </select>
              </div>
              <textarea
                aria-label="Evidence caption"
                value={evidenceCaption}
                onChange={(e) => setEvidenceCaption(e.target.value)}
                placeholder="Add a short caption for this photo"
                rows={2}
                style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
              />
              <div>
                <Button disabled={savingEvidence} onClick={() => void handleEvidenceUpload()}>
                  {savingEvidence ? "Uploading..." : "Upload evidence"}
                </Button>
              </div>
              {selected.evidence?.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {selected.evidence.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 10,
                        background: "#fff",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      {item.url ? (
                        <img
                          src={item.url}
                          alt={item.caption || `${evidenceTypeLabel(item.evidenceType)} evidence`}
                          style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10, background: "#e2e8f0" }}
                        />
                      ) : null}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
                        <span>{evidenceTypeLabel(item.evidenceType)}</span>
                        <span>{evidenceVisibilityLabel(item.visibility)}</span>
                        <span>Uploaded by {item.uploadedByActorRole}</span>
                        <span>{formatDate(item.uploadedAt)}</span>
                      </div>
                      {item.caption ? <div style={{ whiteSpace: "pre-wrap" }}>{item.caption}</div> : null}
                      {item.visibility !== "tenant_safe" ? (
                        <div>
                          <Button variant="secondary" disabled={savingEvidence} onClick={() => void markEvidenceTenantSafe(item.id)}>
                            {savingEvidence ? "Saving..." : "Mark tenant-safe"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#64748b" }}>No evidence photos uploaded yet.</div>
              )}
            </div>
            <div style={{ display: "grid", gap: 8, maxHeight: 320, overflow: "auto", paddingRight: 4 }}>
              {updates.length === 0 ? (
                <div style={{ color: "#64748b" }}>No updates yet.</div>
              ) : (
                updates.map((u) => (
                  <div key={u.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {u.updateType} • {formatDate(u.createdAtMs)}
                    </div>
                    <div style={{ marginTop: 4 }}>{u.message || "-"}</div>
                  </div>
                ))
              )}
            </div>
            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 10,
                padding: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 700 }}>Completion review</div>
              {!selected.assignedContractorId && canCompleteWorkOrder(selected) ? (
                <>
                  <textarea
                    value={completionSummary}
                    onChange={(e) => setCompletionSummary(e.target.value)}
                    placeholder="Summarize what was completed for this in-house job"
                    rows={3}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
                  />
                  <select
                    value={completionOutcome}
                    onChange={(e) =>
                      setCompletionOutcome(e.target.value as "completed" | "partially_completed" | "follow_up_required")
                    }
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                  >
                    <option value="completed">Completed</option>
                    <option value="partially_completed">Partially completed</option>
                    <option value="follow_up_required">Follow-up required</option>
                  </select>
                  <Button disabled={savingAction} onClick={() => void markCompleted(selected)}>
                    {savingAction ? "Saving..." : "Complete In-house"}
                  </Button>
                </>
              ) : null}
              {canConfirmCompletion(selected) ? (
                <Button disabled={savingAction} onClick={() => void handleConfirmCompletion(selected)}>
                  {savingAction ? "Saving..." : "Confirm completion"}
                </Button>
              ) : null}
              {canApproveResolution(selected) ? (
                <Button disabled={savingAction} onClick={() => void handleApproveResolution(selected)}>
                  {savingAction ? "Saving..." : "Approve resolution"}
                </Button>
              ) : null}
              {selected.status === "completed" ? (
                <>
                  <textarea
                    value={followUpReason}
                    onChange={(e) => setFollowUpReason(e.target.value)}
                    placeholder="Explain why this work still needs follow-up"
                    rows={3}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
                  />
                  <Button variant="secondary" disabled={savingAction} onClick={() => void handleMarkFollowUpRequired(selected)}>
                    {savingAction ? "Saving..." : "Mark follow-up required"}
                  </Button>
                </>
              ) : null}
              {canReopenWorkOrder(selected) ? (
                <>
                  <textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Explain why this work order needs follow-up"
                    rows={3}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="secondary" disabled={savingAction} onClick={() => void handleReopen(selected, "in_progress")}>
                      {savingAction ? "Saving..." : "Reopen in progress"}
                    </Button>
                    <Button variant="ghost" disabled={savingAction} onClick={() => void handleReopen(selected, "blocked")}>
                      {savingAction ? "Saving..." : "Reopen blocked"}
                    </Button>
                  </div>
                </>
              ) : null}
              {!selected.assignedContractorId && canCompleteWorkOrder(selected) ? null : !canConfirmCompletion(selected) && !canReopenWorkOrder(selected) ? (
                <div style={{ color: "#64748b" }}>
                  Execution details are up to date. Review the timeline for the latest operational context.
                </div>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add landlord note"
                rows={3}
                style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  disabled={!newNote.trim() || savingNote}
                  onClick={async () => {
                    if (!selected || !newNote.trim()) return;
                    setSavingNote(true);
                    try {
                      await addWorkOrderUpdate(selected.id, { updateType: "note", message: newNote.trim() });
                      setNewNote("");
                      await loadUpdates(selected.id);
                    } finally {
                      setSavingNote(false);
                    }
                  }}
                >
                  Add Note
                </Button>
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </div>
          </Card>
        ) : null}
      </div>

      <AddExpenseModal
        open={Boolean(convertTarget)}
        properties={properties}
        defaultPropertyId={convertTarget?.propertyId || null}
        defaultUnitId={convertTarget?.unitId || null}
        defaultSource="work_order"
        defaultCategory={normalizeCategory(String(convertTarget?.category || ""))}
        defaultVendorName={convertVendor}
        defaultNotes={
          convertTarget
            ? `Work order: ${convertTarget.title}\n${convertTarget.description || ""}`.trim()
            : ""
        }
        defaultLinkedWorkOrderId={convertTarget?.id || null}
        onClose={() => {
          setConvertTarget(null);
          setConvertVendor("");
        }}
        onSaved={async (expense) => {
          if (!convertTarget?.id || !expense?.id) return;
          await patchWorkOrder(convertTarget.id, { linkedExpenseId: expense.id });
          await load();
          if (selected?.id === convertTarget.id) {
            setSelected((prev) => (prev ? { ...prev, linkedExpenseId: expense.id } : prev));
          }
        }}
      />
    </div>
  );
}
