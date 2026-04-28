import React from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { AddExpenseModal } from "../../components/expenses/AddExpenseModal";
import ContractorAssignmentPanel from "../../components/marketplace/ContractorAssignmentPanel";
import { useEntitlements } from "@/hooks/useEntitlements";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { FeatureTeaser } from "@/components/billing/FeatureTeaser";
import { resolveRequiredPlanLabel } from "@/lib/upgradePrompt";
import { fetchProperties } from "../../api/propertiesApi";
import { assignContractorToWorkOrder, fetchContractors, type ContractorProfileV1 } from "../../api/marketplaceContractorApi";
import {
  addWorkOrderUpdate,
  approveWorkOrderResolution,
  assignWorkOrderRework,
  closeWorkOrderReworkDirectly,
  confirmWorkOrderCompletion,
  exportWorkOrders,
  getWorkOrder,
  getContractorProfileById,
  linkWorkOrderCostToExpense,
  listWorkOrderUpdates,
  listWorkOrders,
  markWorkOrderFollowUpRequired,
  patchWorkOrder,
  reopenWorkOrder,
  requestWorkOrderCostRevision,
  reviewWorkOrderReworkResolution,
  reviewWorkOrderCost,
  rescheduleWorkOrderRework,
  scheduleWorkOrderRework,
  startWorkOrderRework,
  submitLandlordWorkOrderCost,
  updateWorkOrderEvidence,
  uploadWorkOrderCostAttachment,
  uploadWorkOrderEvidence,
  type WorkOrderEvidenceType,
  type WorkOrderEvidenceVisibility,
  type WorkOrderRecord,
  type WorkOrderUpdateRecord,
} from "../../api/workOrdersApi";
import { type ExpenseCategory } from "../../api/expensesApi";
import { printSummaryDocument } from "../../utils/printSummary";

function formatDate(ms?: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

function formatMoney(cents?: number | null, currency?: string | null) {
  if (!cents) return "-";
  return `${(cents / 100).toFixed(2)} ${currency || "CAD"}`;
}

function toLocalInputValue(ms?: number | null) {
  if (!ms) return "";
  const date = new Date(ms);
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

function reworkScheduleStatusLabel(value?: string | null) {
  switch (value) {
    case "tenant_pending":
      return "Awaiting tenant confirmation";
    case "confirmed":
      return "Confirmed";
    case "reschedule_requested":
      return "Reschedule requested";
    case "scheduled":
      return "Awaiting contractor confirmation";
    case "contractor_confirmed":
      return "Contractor confirmed";
    case "cancelled":
      return "Cancelled";
    case "not_scheduled":
      return "Not scheduled";
    default:
      return "Not scheduled";
  }
}

function canCompleteWorkOrder(item: WorkOrderRecord) {
  return item.status !== "completed" && item.status !== "cancelled";
}

function canConfirmCompletion(item: WorkOrderRecord) {
  return item.status === "completed" && !item.completionConfirmedByLandlordAt;
}

function canApproveResolution(item: WorkOrderRecord) {
  return (
    item.status === "completed" &&
    item.resolutionStatus !== "tenant_pending_signoff" &&
    item.resolutionStatus !== "resolved" &&
    item.reworkCycle?.status !== "completed"
  );
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

function reworkReviewStatusLabel(
  value?: "pending_review" | "landlord_approved" | "tenant_pending_signoff" | "closed" | "follow_up_required" | null
) {
  switch (value) {
    case "pending_review":
      return "Pending landlord review";
    case "landlord_approved":
      return "Landlord approved";
    case "tenant_pending_signoff":
      return "Awaiting tenant signoff";
    case "closed":
      return "Closed";
    case "follow_up_required":
      return "Follow-up required again";
    default:
      return "Not started";
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

function landlordNotificationMessages(item: WorkOrderRecord) {
  const messages: string[] = [];
  if (item.notifications?.landlord?.requiresReview) {
    messages.push("Review completed rework");
  }
  if (item.notifications?.landlord?.requiresReschedule) {
    messages.push("Reschedule required");
  }
  return messages;
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

function costReviewStatusLabel(value?: "pending_review" | "approved" | "rejected" | "revision_requested" | null) {
  switch (value) {
    case "pending_review":
      return "Pending review";
    case "approved":
      return "Approved";
    case "revision_requested":
      return "Revision requested";
    case "rejected":
      return "Rejected";
    default:
      return "Not submitted";
  }
}

function expenseLinkStatusLabel(item: WorkOrderRecord | null) {
  if (item?.expenseLink?.status === "linked" || item?.cost?.linkedExpenseStatus === "linked" || item?.linkedExpenseId) {
    return "Linked to expense";
  }
  return "Not linked";
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
  const [reworkScheduledForInput, setReworkScheduledForInput] = React.useState("");
  const [reworkWindowStartInput, setReworkWindowStartInput] = React.useState("");
  const [reworkWindowEndInput, setReworkWindowEndInput] = React.useState("");
  const [reworkRequiresAccess, setReworkRequiresAccess] = React.useState(false);
  const [reworkRescheduleReason, setReworkRescheduleReason] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);
  const [savingAction, setSavingAction] = React.useState(false);
  const [savingEvidence, setSavingEvidence] = React.useState(false);
  const [savingCost, setSavingCost] = React.useState(false);
  const [properties, setProperties] = React.useState<Array<{ id: string; name: string; city?: string | null; province?: string | null }>>([]);
  const [marketplaceContractors, setMarketplaceContractors] = React.useState<ContractorProfileV1[]>([]);
  const [loadingMarketplaceContractors, setLoadingMarketplaceContractors] = React.useState(false);
  const [assigningMarketplaceContractor, setAssigningMarketplaceContractor] = React.useState(false);
  const [convertTarget, setConvertTarget] = React.useState<WorkOrderRecord | null>(null);
  const [convertVendor, setConvertVendor] = React.useState("");
  const [isMobile, setIsMobile] = React.useState(false);
  const [exporting, setExporting] = React.useState<null | "csv" | "xlsx">(null);
  const [evidenceFile, setEvidenceFile] = React.useState<File | null>(null);
  const [evidenceType, setEvidenceType] = React.useState<WorkOrderEvidenceType>("inspection");
  const [evidenceCaption, setEvidenceCaption] = React.useState("");
  const [evidenceVisibility, setEvidenceVisibility] = React.useState<WorkOrderEvidenceVisibility>("internal");
  const [costActualInput, setCostActualInput] = React.useState("");
  const [costCurrency, setCostCurrency] = React.useState("CAD");
  const [costReviewNote, setCostReviewNote] = React.useState("");
  const [costLineItemsJson, setCostLineItemsJson] = React.useState("");
  const [costAttachmentFile, setCostAttachmentFile] = React.useState<File | null>(null);
  const canUseWorkOrders = entitlements.canUseWorkOrders;
  const canViewMarketplaceDirectory = entitlements.canViewMarketplaceDirectory;
  const canUseMarketplaceContractorAssignment = entitlements.canUseMarketplaceContractorAssignment;
  const marketplaceDirectoryPlanLabel = resolveRequiredPlanLabel("marketplace_directory") || "Pro";
  const marketplaceAssignmentPlanLabel =
    resolveRequiredPlanLabel("marketplace_contractor_assignment") || "Elite";

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

  const selectedProperty = React.useMemo(
    () => (selected ? properties.find((item) => item.id === selected.propertyId) || null : null),
    [properties, selected]
  );

  const selectedServiceArea = React.useMemo(() => {
    if (!selectedProperty) return "";
    const city = String(selectedProperty.city || "").trim();
    const province = String(selectedProperty.province || "").trim();
    return [city, province].filter(Boolean).join(", ") || city || province || "";
  }, [selectedProperty]);

  const getPropertyLabel = React.useCallback(
    (item: WorkOrderRecord) => properties.find((property) => property.id === item.propertyId)?.name || "Property",
    [properties]
  );

  const getAssignedContractorLabel = React.useCallback((item: WorkOrderRecord) => {
    return (
      String(item.contractorAssignment?.displayName || item.contractorAssignment?.businessName || "").trim() ||
      (String(item.assignedContractorId || "").trim() ? "Assigned" : "-")
    );
  }, []);

  const triggerExport = React.useCallback(async (format: "csv" | "xlsx") => {
    try {
      setExporting(format);
      const { blob, filename } = await exportWorkOrders(format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(String(err?.message || "Failed to export work orders"));
    } finally {
      setExporting(null);
    }
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

  const handleAssignMarketplaceContractor = React.useCallback(
    async (contractorId: string) => {
      if (!selected) return;
      setAssigningMarketplaceContractor(true);
      setError(null);
      try {
        const next = await assignContractorToWorkOrder(selected.id, { contractorId });
        await load();
        syncSelectedItem(next);
        await loadUpdates(selected.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to assign contractor"));
      } finally {
        setAssigningMarketplaceContractor(false);
      }
    },
    [load, loadUpdates, selected, syncSelectedItem]
  );

  const handleReviewReworkResolution = React.useCallback(
    async (item: WorkOrderRecord, decision: "approve" | "follow_up_required") => {
      if (!item.reworkCycle || item.reworkCycle.status !== "completed") return;
      if (decision === "follow_up_required" && !reworkNotes.trim()) {
        setError("Add a review note before marking the rework for more follow-up.");
        return;
      }
      setSavingAction(true);
      setError(null);
      try {
        await reviewWorkOrderReworkResolution(item.id, {
          decision,
          note: reworkNotes.trim() || undefined,
        });
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to review rework resolution"));
      } finally {
        setSavingAction(false);
      }
    },
    [load, refreshSelected, reworkNotes]
  );

  const handleCloseReworkDirectly = React.useCallback(
    async (item: WorkOrderRecord) => {
      if (!item.reworkCycle || item.reworkCycle.status !== "completed") return;
      setSavingAction(true);
      setError(null);
      try {
        await closeWorkOrderReworkDirectly(item.id, {
          note: reworkNotes.trim() || undefined,
        });
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to close rework"));
      } finally {
        setSavingAction(false);
      }
    },
    [load, refreshSelected, reworkNotes]
  );

  const handleScheduleRework = React.useCallback(
    async (item: WorkOrderRecord, mode: "schedule" | "reschedule") => {
      const scheduledFor = fromLocalInputValue(reworkScheduledForInput);
      const timeWindowStart = fromLocalInputValue(reworkWindowStartInput);
      const timeWindowEnd = fromLocalInputValue(reworkWindowEndInput);
      if (!scheduledFor && !(timeWindowStart && timeWindowEnd)) {
        setError("Add a return-visit time or a full time window before saving the rework schedule.");
        return;
      }
      if (mode === "reschedule" && !reworkRescheduleReason.trim()) {
        setError("Add a reason before rescheduling the rework visit.");
        return;
      }
      setSavingAction(true);
      setError(null);
      try {
        if (mode === "schedule") {
          await scheduleWorkOrderRework(item.id, {
            scheduledFor: scheduledFor ?? undefined,
            timeWindowStart: timeWindowStart ?? undefined,
            timeWindowEnd: timeWindowEnd ?? undefined,
            requiresTenantAccess: reworkRequiresAccess,
          });
        } else {
          await rescheduleWorkOrderRework(item.id, {
            scheduledFor: scheduledFor ?? undefined,
            timeWindowStart: timeWindowStart ?? undefined,
            timeWindowEnd: timeWindowEnd ?? undefined,
            requiresTenantAccess: reworkRequiresAccess,
            reason: reworkRescheduleReason.trim(),
          });
        }
        await load();
        await refreshSelected(item.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to save the rework schedule"));
      } finally {
        setSavingAction(false);
      }
    },
    [load, refreshSelected, reworkRequiresAccess, reworkRescheduleReason, reworkScheduledForInput, reworkWindowEndInput, reworkWindowStartInput]
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

  const handleSubmitCost = React.useCallback(async () => {
    if (!selected) return;
    const normalizedAmount = Number(costActualInput);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setError("Add a valid actual cost before saving.");
      return;
    }

    let lineItems: Array<{ id?: string; label: string; amountCents: number; category?: "labor" | "materials" | "inspection" | "other" }> =
      [];
    if (costLineItemsJson.trim()) {
      try {
        const parsed = JSON.parse(costLineItemsJson);
        lineItems = Array.isArray(parsed) ? parsed : [];
      } catch {
        setError("Line items must be valid JSON.");
        return;
      }
    }

    setSavingCost(true);
    setError(null);
    try {
      const refreshed = await submitLandlordWorkOrderCost(selected.id, {
        actualCostCents: Math.round(normalizedAmount * 100),
        currency: costCurrency.trim() || "CAD",
        lineItems,
        reviewNote: costReviewNote.trim() || undefined,
      });
      syncSelectedItem(refreshed);
      await loadUpdates(selected.id);
    } catch (err: any) {
      setError(String(err?.message || "Failed to save work order cost"));
    } finally {
      setSavingCost(false);
    }
  }, [costActualInput, costCurrency, costLineItemsJson, costReviewNote, loadUpdates, selected, syncSelectedItem]);

  const handleReviewCost = React.useCallback(
    async (decision: "approve" | "reject" | "revision_requested") => {
      if (!selected) return;
      setSavingCost(true);
      setError(null);
      try {
        const refreshed = await reviewWorkOrderCost(selected.id, {
          decision,
          note: costReviewNote.trim() || undefined,
        });
        syncSelectedItem(refreshed);
        await loadUpdates(selected.id);
      } catch (err: any) {
        setError(String(err?.message || "Failed to review work order cost"));
      } finally {
        setSavingCost(false);
      }
    },
    [costReviewNote, loadUpdates, selected, syncSelectedItem]
  );

  const handleRequestCostRevision = React.useCallback(async () => {
    if (!selected) return;
    if (!costReviewNote.trim()) {
      setError("Add a review note before requesting a cost revision.");
      return;
    }
    setSavingCost(true);
    setError(null);
    try {
      const refreshed = await requestWorkOrderCostRevision(selected.id, {
        note: costReviewNote.trim(),
      });
      syncSelectedItem(refreshed);
      await loadUpdates(selected.id);
    } catch (err: any) {
      setError(String(err?.message || "Failed to request a cost revision"));
    } finally {
      setSavingCost(false);
    }
  }, [costReviewNote, loadUpdates, selected, syncSelectedItem]);

  const handleLinkExpense = React.useCallback(async () => {
    if (!selected) return;
    setSavingCost(true);
    setError(null);
    try {
      const refreshed = await linkWorkOrderCostToExpense(selected.id);
      syncSelectedItem(refreshed);
      await loadUpdates(selected.id);
    } catch (err: any) {
      setError(String(err?.message || "Failed to link cost to expense"));
    } finally {
      setSavingCost(false);
    }
  }, [loadUpdates, selected, syncSelectedItem]);

  const handleCostAttachmentUpload = React.useCallback(async () => {
    if (!selected) return;
    if (!costAttachmentFile) {
      setError("Choose an invoice or receipt before uploading.");
      return;
    }
    setSavingCost(true);
    setError(null);
    try {
      const refreshed = await uploadWorkOrderCostAttachment(selected.id, { file: costAttachmentFile });
      syncSelectedItem(refreshed);
      setCostAttachmentFile(null);
      await loadUpdates(selected.id);
    } catch (err: any) {
      setError(String(err?.message || "Failed to upload cost attachment"));
    } finally {
      setSavingCost(false);
    }
  }, [costAttachmentFile, loadUpdates, selected, syncSelectedItem]);

  React.useEffect(() => {
    if (!selected) {
      setCompletionSummary("");
      setCompletionOutcome("completed");
      setReopenReason("");
      setFollowUpReason("");
      setReworkContractorId("");
      setReworkNotes("");
      setReworkScheduledForInput("");
      setReworkWindowStartInput("");
      setReworkWindowEndInput("");
      setReworkRequiresAccess(false);
      setReworkRescheduleReason("");
      setEvidenceFile(null);
      setEvidenceCaption("");
      setEvidenceType("inspection");
      setEvidenceVisibility("internal");
      setCostActualInput("");
      setCostCurrency("CAD");
      setCostReviewNote("");
      setCostLineItemsJson("");
      setCostAttachmentFile(null);
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
    setReworkNotes(String(selected.reworkReview?.landlordReviewNote || ""));
    setReworkScheduledForInput(toLocalInputValue(selected.reworkCycle?.schedule?.scheduledFor));
    setReworkWindowStartInput(toLocalInputValue(selected.reworkCycle?.schedule?.timeWindowStart));
    setReworkWindowEndInput(toLocalInputValue(selected.reworkCycle?.schedule?.timeWindowEnd));
    setReworkRequiresAccess(Boolean(selected.reworkCycle?.schedule?.requiresTenantAccess));
    setReworkRescheduleReason(String(selected.reworkCycle?.schedule?.rescheduleReason || ""));
    setCostActualInput(
      typeof selected.cost?.actualCostCents === "number" ? String((selected.cost.actualCostCents / 100).toFixed(2)) : ""
    );
    setCostCurrency(String(selected.cost?.currency || "CAD"));
    setCostReviewNote(String(selected.cost?.reviewNote || ""));
    setCostLineItemsJson(
      selected.costLineItems?.length ? JSON.stringify(selected.costLineItems, null, 2) : ""
    );
    setCostAttachmentFile(null);
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
              city: String(p?.city || "").trim() || null,
              province: String(p?.province || "").trim() || null,
            }))
            .filter((p: any) => p.id)
        );
      } catch {
        setProperties([]);
      }
    };
    void run();
  }, [canUseWorkOrders]);

  React.useEffect(() => {
    if (!canUseWorkOrders || !canUseMarketplaceContractorAssignment || !selected) {
      setMarketplaceContractors([]);
      return;
    }
    const run = async () => {
      setLoadingMarketplaceContractors(true);
      try {
        const result = await fetchContractors({
          serviceCategory: selected.category || undefined,
          serviceArea: selectedServiceArea || undefined,
          limit: 12,
        });
        setMarketplaceContractors(result.items);
      } catch {
        setMarketplaceContractors([]);
      } finally {
        setLoadingMarketplaceContractors(false);
      }
    };
    void run();
  }, [canUseMarketplaceContractorAssignment, canUseWorkOrders, selected, selectedServiceArea]);

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
          <Button variant="secondary" onClick={() => void triggerExport("csv")} disabled={exporting !== null}>
            {exporting === "csv" ? "Exporting..." : "Export CSV"}
          </Button>
          <Button variant="secondary" onClick={() => void triggerExport("xlsx")} disabled={exporting !== null}>
            {exporting === "xlsx" ? "Exporting..." : "Export Spreadsheet"}
          </Button>
          <Button variant="secondary" onClick={() => void printSummaryDocument("summary")}>
            Export PDF
          </Button>
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

      <div className="print-only print-only-summary">
        <div className="printHeader">
          <div className="printTitle">Work orders summary</div>
          <div className="printMeta">
            <div>Generated: {new Date().toLocaleString()}</div>
            <div>Rows: {items.length}</div>
          </div>
        </div>
        <div className="printH3">Work orders</div>
        <table className="printTable">
          <thead>
            <tr>
              <th>Title</th>
              <th>Property</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned contractor</th>
              <th>Scheduled</th>
              <th>Started</th>
              <th>Completed</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{getPropertyLabel(item)}</td>
                <td>{item.category || "-"}</td>
                <td>{item.priority || "-"}</td>
                <td>{item.status || "-"}</td>
                <td>{getAssignedContractorLabel(item)}</td>
                <td>{formatDate(item.scheduledFor)}</td>
                <td>{formatDate(item.serviceStartedAt)}</td>
                <td>{formatDate(item.serviceCompletedAt)}</td>
                <td>{String(item.completionSummary || "").trim() || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {selected ? (
          <>
            <div className="printH3">Selected work order</div>
            <table className="printTable">
              <tbody>
                <tr><th>Title</th><td>{selected.title}</td></tr>
                <tr><th>Property</th><td>{getPropertyLabel(selected)}</td></tr>
                <tr><th>Category</th><td>{selected.category || "-"}</td></tr>
                <tr><th>Priority</th><td>{selected.priority || "-"}</td></tr>
                <tr><th>Status</th><td>{selected.status || "-"}</td></tr>
                <tr><th>Assigned contractor</th><td>{getAssignedContractorLabel(selected)}</td></tr>
                <tr><th>Scheduled for</th><td>{formatDate(selected.scheduledFor)}</td></tr>
                <tr><th>Service started</th><td>{formatDate(selected.serviceStartedAt)}</td></tr>
                <tr><th>Service completed</th><td>{formatDate(selected.serviceCompletedAt)}</td></tr>
                <tr><th>Completion outcome</th><td>{completionOutcomeLabel(selected.completionOutcome)}</td></tr>
                <tr><th>Resolution status</th><td>{resolutionStatusLabel(selected.resolutionStatus)}</td></tr>
                <tr><th>Completion summary</th><td>{String(selected.completionSummary || "").trim() || "-"}</td></tr>
                <tr><th>Blocked reason</th><td>{String(selected.executionBlockedReason || "").trim() || "-"}</td></tr>
              </tbody>
            </table>
            {updates.length ? (
              <>
                <div className="printH3">Latest comments</div>
                <table className="printTable">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {updates.map((update) => (
                      <tr key={update.id}>
                        <td>{formatDate(update.createdAtMs)}</td>
                        <td>{update.updateType}</td>
                        <td>{String(update.message || "").trim() || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </>
        ) : null}
      </div>

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
                      <strong>Assigned:</strong> {item.contractorAssignment?.displayName || item.assignedContractorId || "-"}
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
                    <td style={{ padding: 8 }}>{item.contractorAssignment?.displayName || item.assignedContractorId || "-"}</td>
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
              {landlordNotificationMessages(selected).length ? (
                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: 12,
                    border: "1px solid #f59e0b",
                    borderRadius: 12,
                    background: "#fffbeb",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#92400e" }}>Action required</div>
                  {landlordNotificationMessages(selected).map((message) => (
                    <div key={message} style={{ color: "#9a3412" }}>
                      {message}
                    </div>
                  ))}
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
            {canUseMarketplaceContractorAssignment ? (
              <ContractorAssignmentPanel
                currentAssignment={selected.contractorAssignment || null}
                contractors={marketplaceContractors}
                loading={loadingMarketplaceContractors}
                assigning={assigningMarketplaceContractor}
                onAssign={(contractorId) => void handleAssignMarketplaceContractor(contractorId)}
              />
            ) : canViewMarketplaceDirectory ? (
              <FeatureTeaser
                featureKey="marketplace_contractor_assignment"
                eyebrow={`${marketplaceAssignmentPlanLabel} marketplace`}
                title={`Unlock contractor assignment on ${marketplaceAssignmentPlanLabel}`}
                description="Keep baseline work orders in place, then upgrade to discover contractor candidates and assign them directly from the job workflow."
                ctaLabel={`Upgrade to ${marketplaceAssignmentPlanLabel}`}
              />
            ) : (
              <FeatureTeaser
                featureKey="marketplace_directory"
                eyebrow={`${marketplaceDirectoryPlanLabel} marketplace`}
                title={`Unlock the contractor directory on ${marketplaceDirectoryPlanLabel}`}
                description="Upgrade to build a private contractor network first, then unlock embedded contractor assignment inside work orders on higher tiers."
                ctaLabel={`Upgrade to ${marketplaceDirectoryPlanLabel}`}
              />
            )}
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
              <div style={{ fontWeight: 700 }}>Cost & Invoice</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Keep contractor and in-house cost capture attached to the same work order so completion review has a clean cost trail.
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Actual cost</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>
                    {formatMoney(selected.cost?.actualCostCents, selected.cost?.currency)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Review status</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{costReviewStatusLabel(selected.cost?.reviewStatus)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Submitted by</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{selected.cost?.submittedByRole || "-"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Reviewed</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{formatDate(selected.cost?.reviewedAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Revision #</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{selected.cost?.latestRevisionNumber || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Expense linkage</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{expenseLinkStatusLabel(selected)}</div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Actual cost</span>
                  <input
                    aria-label="Actual cost"
                    value={costActualInput}
                    onChange={(e) => setCostActualInput(e.target.value)}
                    placeholder="245.00"
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Currency</span>
                  <input
                    aria-label="Cost currency"
                    value={costCurrency}
                    onChange={(e) => setCostCurrency(e.target.value.toUpperCase())}
                    placeholder="CAD"
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                  />
                </label>
              </div>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Line items JSON</span>
                <textarea
                  aria-label="Cost line items"
                  rows={4}
                  value={costLineItemsJson}
                  onChange={(e) => setCostLineItemsJson(e.target.value)}
                  placeholder='[{"label":"Labor","amountCents":15000,"category":"labor"}]'
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Review note</span>
                <textarea
                  aria-label="Cost review note"
                  rows={2}
                  value={costReviewNote}
                  onChange={(e) => setCostReviewNote(e.target.value)}
                  placeholder="Optional note for the cost record or review"
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
                />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button disabled={savingCost} onClick={() => void handleSubmitCost()}>
                  {savingCost ? "Saving..." : "Save cost"}
                </Button>
                {selected.cost?.reviewStatus === "pending_review" ? (
                  <>
                    <Button variant="secondary" disabled={savingCost} onClick={() => void handleReviewCost("approve")}>
                      {savingCost ? "Saving..." : "Approve cost"}
                    </Button>
                    <Button variant="ghost" disabled={savingCost} onClick={() => void handleReviewCost("reject")}>
                      {savingCost ? "Saving..." : "Reject cost"}
                    </Button>
                    <Button variant="ghost" disabled={savingCost} onClick={() => void handleRequestCostRevision()}>
                      {savingCost ? "Saving..." : "Request revision"}
                    </Button>
                  </>
                ) : null}
                {selected.cost?.reviewStatus === "rejected" ? (
                  <Button variant="ghost" disabled={savingCost} onClick={() => void handleRequestCostRevision()}>
                    {savingCost ? "Saving..." : "Request revision"}
                  </Button>
                ) : null}
                {selected.cost?.reviewStatus === "approved" && !selected.linkedExpenseId && selected.cost?.linkedExpenseStatus !== "linked" ? (
                  <Button variant="secondary" disabled={savingCost} onClick={() => void handleLinkExpense()}>
                    {savingCost ? "Saving..." : "Link to expense"}
                  </Button>
                ) : null}
              </div>
              {selected.cost?.reviewNote ? (
                <div style={{ padding: 10, borderRadius: 10, background: "#fff7ed", color: "#9a3412" }}>
                  <div style={{ fontWeight: 600 }}>Latest review note</div>
                  <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{selected.cost.reviewNote}</div>
                </div>
              ) : null}
              <input
                aria-label="Cost attachment file"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setCostAttachmentFile(e.target.files?.[0] || null)}
              />
              <div>
                <Button variant="secondary" disabled={savingCost} onClick={() => void handleCostAttachmentUpload()}>
                  {savingCost ? "Uploading..." : "Upload cost attachment"}
                </Button>
              </div>
              {selected.costLineItems?.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {selected.costLineItems.map((line) => (
                    <div key={line.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#fff" }}>
                      <div style={{ fontWeight: 600 }}>{line.label}</div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        {formatMoney(line.amountCents, selected.cost?.currency)} • {line.category || "other"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#64748b" }}>No cost line items recorded yet.</div>
              )}
              {selected.costReviewHistory?.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 600 }}>Cost review history</div>
                  {selected.costReviewHistory.map((entry) => (
                    <div key={entry.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#fff" }}>
                      <div style={{ fontWeight: 600 }}>
                        Revision #{entry.revisionNumber} • {formatMoney(entry.actualCostCents, entry.currency)}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        {costReviewStatusLabel(entry.reviewStatus)} • Submitted {formatDate(entry.submittedAt)}
                      </div>
                      {entry.reviewNote ? (
                        <div style={{ marginTop: 4, color: "#334155", whiteSpace: "pre-wrap" }}>{entry.reviewNote}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {selected.costAttachments?.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {selected.costAttachments.map((attachment) => (
                    <div key={attachment.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#fff" }}>
                      <div style={{ fontWeight: 600 }}>{attachment.fileName || "Cost attachment"}</div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        {attachment.visibility === "internal" ? "Internal only" : "Landlord only"} • {formatDate(attachment.uploadedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#64748b" }}>No cost attachments uploaded yet.</div>
              )}
              {selected.expenseLink?.expenseId || selected.linkedExpenseId ? (
                <div style={{ color: "#166534", fontWeight: 600 }}>
                  Linked expense: {selected.expenseLink?.expenseId || selected.linkedExpenseId}
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
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 10,
                      display: "grid",
                      gap: 8,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Return visit coordination</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {selected.reworkCycle.schedule
                        ? `${reworkScheduleStatusLabel(selected.reworkCycle.schedule.status)} • Access ${
                            selected.reworkCycle.schedule.requiresTenantAccess ? "required" : "not required"
                          }`
                        : "No return visit has been scheduled for this rework cycle yet."}
                    </div>
                    {selected.reworkCycle.schedule ? (
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        Return visit: {formatDate(selected.reworkCycle.schedule.scheduledFor || selected.reworkCycle.schedule.timeWindowStart)}
                        {selected.reworkCycle.schedule.timeWindowEnd
                          ? ` to ${formatDate(selected.reworkCycle.schedule.timeWindowEnd)}`
                          : ""}
                        {" • "}Tenant access {selected.reworkCycle.schedule.tenantAccessStatus || "pending"}
                        {" • "}Contractor {selected.reworkCycle.schedule.contractorScheduleStatus || "pending"}
                      </div>
                    ) : null}
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Scheduled visit time</span>
                      <input
                        type="datetime-local"
                        value={reworkScheduledForInput}
                        onChange={(e) => setReworkScheduledForInput(e.target.value)}
                        style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                      />
                    </label>
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                      <label style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>Window start</span>
                        <input
                          type="datetime-local"
                          value={reworkWindowStartInput}
                          onChange={(e) => setReworkWindowStartInput(e.target.value)}
                          style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>Window end</span>
                        <input
                          type="datetime-local"
                          value={reworkWindowEndInput}
                          onChange={(e) => setReworkWindowEndInput(e.target.value)}
                          style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                        />
                      </label>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={reworkRequiresAccess}
                        onChange={(e) => setReworkRequiresAccess(e.target.checked)}
                      />
                      Require tenant access confirmation
                    </label>
                    <textarea
                      value={reworkRescheduleReason}
                      onChange={(e) => setReworkRescheduleReason(e.target.value)}
                      placeholder="Reason for rescheduling this return visit"
                      rows={2}
                      style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button variant="secondary" disabled={savingAction} onClick={() => void handleScheduleRework(selected, "schedule")}>
                        {savingAction ? "Saving..." : "Schedule return visit"}
                      </Button>
                      {selected.reworkCycle.schedule ? (
                        <Button variant="ghost" disabled={savingAction} onClick={() => void handleScheduleRework(selected, "reschedule")}>
                          {savingAction ? "Saving..." : "Reschedule return visit"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <input
                    value={reworkContractorId}
                    onChange={(e) => setReworkContractorId(e.target.value)}
                    placeholder="Contractor ID for rework assignment"
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                  />
                  {selected.reworkReview ? (
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                        background: "#fff",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>Second-pass review</div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        {reworkReviewStatusLabel(selected.reworkReview.status)}
                        {selected.reworkReview.reviewedAt ? ` • Reviewed ${formatDate(selected.reworkReview.reviewedAt)}` : ""}
                        {selected.reworkReview.closedAt ? ` • Closed ${formatDate(selected.reworkReview.closedAt)}` : ""}
                      </div>
                      {selected.reworkReview.closureOutcome ? (
                        <div style={{ color: "#64748b", fontSize: 13 }}>
                          Closure outcome: {selected.reworkReview.closureOutcome.replaceAll("_", " ")}
                        </div>
                      ) : null}
                      {selected.reworkReview.tenantDeclineReason ? (
                        <div style={{ color: "#64748b", fontSize: 13 }}>
                          Tenant follow-up note: {selected.reworkReview.tenantDeclineReason}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <textarea
                    value={reworkNotes}
                    onChange={(e) => setReworkNotes(e.target.value)}
                    placeholder="Add a landlord review note for this second-pass visit"
                    rows={3}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selected.reworkCycle.status !== "completed" ? (
                      <Button variant="secondary" disabled={savingAction} onClick={() => void handleAssignRework(selected)}>
                        {savingAction ? "Saving..." : "Assign rework"}
                      </Button>
                    ) : null}
                    {selected.reworkCycle.status === "completed" ? (
                      <>
                        <Button disabled={savingAction} onClick={() => void handleReviewReworkResolution(selected, "approve")}>
                          {savingAction ? "Saving..." : "Approve rework resolution"}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={savingAction}
                          onClick={() => void handleReviewReworkResolution(selected, "follow_up_required")}
                        >
                          {savingAction ? "Saving..." : "Mark follow-up required again"}
                        </Button>
                        {!selected.tenantId ? (
                          <Button variant="ghost" disabled={savingAction} onClick={() => void handleCloseReworkDirectly(selected)}>
                            {savingAction ? "Saving..." : "Close rework directly"}
                          </Button>
                        ) : null}
                      </>
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
