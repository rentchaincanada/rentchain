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
import {
  getContractorProfileById,
  linkWorkOrderCostToExpense,
  listContractorInvites,
  submitLandlordWorkOrderCost,
} from "../api/workOrdersApi";
import { colors, radius, spacing, text } from "../styles/tokens";
import { buildMaintenanceLifecycleView, buildMaintenanceWorkspaceState } from "./maintenanceWorkspaceState";
import { buildMaintenanceAssignmentRoutingView } from "./maintenanceAssignmentRoutingState";
import { buildMaintenanceConfirmationAccessView } from "./maintenanceConfirmationAccessState";
import { buildMaintenanceCostView } from "./maintenanceCostState";
import { buildMaintenanceReopenEscalationView } from "./maintenanceReopenEscalationState";
import { buildMaintenanceServiceExecutionView } from "./maintenanceServiceExecutionState";
import { buildMaintenanceResolutionVerificationView } from "./maintenanceResolutionVerificationState";
import {
  buildMaintenanceSchedulingAccessView,
  buildMaintenanceSchedulingCalendarEvents,
} from "./maintenanceSchedulingAccessState";

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

function fmtMoney(cents?: number | null, currency = "CAD") {
  if (typeof cents !== "number") return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "CAD",
  }).format(cents / 100);
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

function startOfCalendarMonth(value: Date) {
  const monthStart = new Date(value.getFullYear(), value.getMonth(), 1);
  const offset = monthStart.getDay();
  return new Date(value.getFullYear(), value.getMonth(), 1 - offset);
}

function buildCalendarDays(value: Date) {
  const firstCell = startOfCalendarMonth(value);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return date;
  });
}

function dayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function calendarPriorityTone(priority: MaintenanceWorkflowItem["priority"]) {
  switch (priority) {
    case "urgent":
      return { bg: "rgba(220,38,38,0.14)", color: "#b91c1c" };
    case "normal":
      return { bg: "rgba(37,99,235,0.12)", color: "#1d4ed8" };
    case "low":
      return { bg: "rgba(22,163,74,0.14)", color: "#15803d" };
    default:
      return { bg: "rgba(249,115,22,0.16)", color: "#c2410c" };
  }
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
  const [completionSummary, setCompletionSummary] = React.useState("");
  const [priority, setPriority] = React.useState<"low" | "normal" | "urgent">("normal");
  const [contractorId, setContractorId] = React.useState("");
  const [serviceWindowStart, setServiceWindowStart] = React.useState("");
  const [serviceWindowEnd, setServiceWindowEnd] = React.useState("");
  const [accessRequired, setAccessRequired] = React.useState<"unknown" | "yes" | "no">("unknown");
  const [costTotalInput, setCostTotalInput] = React.useState("");
  const [laborCostInput, setLaborCostInput] = React.useState("");
  const [materialCostInput, setMaterialCostInput] = React.useState("");
  const [vendorCostInput, setVendorCostInput] = React.useState("");
  const [costNote, setCostNote] = React.useState("");
  const [calendarMonth, setCalendarMonth] = React.useState(() => new Date());

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
      setCompletionSummary(String(selected.completionSummary || ""));
      setPriority(selected.priority || "normal");
      setContractorId(String(selected.assignedContractorId || ""));
      setServiceWindowStart(toLocalInputValue(selected.serviceWindowStartAt));
      setServiceWindowEnd(toLocalInputValue(selected.serviceWindowEndAt));
      setAccessRequired(
        selected.accessRequired === true ? "yes" : selected.accessRequired === false ? "no" : "unknown"
      );
      setCostTotalInput(
        typeof selected.cost?.actualCostCents === "number" ? (selected.cost.actualCostCents / 100).toFixed(2) : ""
      );
      const laborLine = selected.costLineItems?.find((entry) => entry.category === "labor")?.amountCents ?? null;
      const materialLine = selected.costLineItems?.find((entry) => entry.category === "materials")?.amountCents ?? null;
      const vendorLine =
        selected.costLineItems
          ?.filter((entry) => entry.category !== "labor" && entry.category !== "materials")
          .reduce((sum, entry) => sum + (typeof entry.amountCents === "number" ? entry.amountCents : 0), 0) ?? null;
      setLaborCostInput(typeof laborLine === "number" ? (laborLine / 100).toFixed(2) : "");
      setMaterialCostInput(typeof materialLine === "number" ? (materialLine / 100).toFixed(2) : "");
      setVendorCostInput(typeof vendorLine === "number" && vendorLine > 0 ? (vendorLine / 100).toFixed(2) : "");
      setCostNote(String(selected.cost?.reviewNote || ""));
      return;
    }
    if (filtered.length > 0 && !routeId) {
      const first = filtered[0];
      setSelectedId(first.id);
      setLandlordNote(String(first.landlordNote || ""));
      setCompletionSummary(String(first.completionSummary || ""));
      setPriority(first.priority || "normal");
      setContractorId(String(first.assignedContractorId || ""));
      setServiceWindowStart(toLocalInputValue(first.serviceWindowStartAt));
      setServiceWindowEnd(toLocalInputValue(first.serviceWindowEndAt));
      setAccessRequired(first.accessRequired === true ? "yes" : first.accessRequired === false ? "no" : "unknown");
      setCostTotalInput(typeof first.cost?.actualCostCents === "number" ? (first.cost.actualCostCents / 100).toFixed(2) : "");
      const laborLine = first.costLineItems?.find((entry) => entry.category === "labor")?.amountCents ?? null;
      const materialLine = first.costLineItems?.find((entry) => entry.category === "materials")?.amountCents ?? null;
      const vendorLine =
        first.costLineItems
          ?.filter((entry) => entry.category !== "labor" && entry.category !== "materials")
          .reduce((sum, entry) => sum + (typeof entry.amountCents === "number" ? entry.amountCents : 0), 0) ?? null;
      setLaborCostInput(typeof laborLine === "number" ? (laborLine / 100).toFixed(2) : "");
      setMaterialCostInput(typeof materialLine === "number" ? (materialLine / 100).toFixed(2) : "");
      setVendorCostInput(typeof vendorLine === "number" && vendorLine > 0 ? (vendorLine / 100).toFixed(2) : "");
      setCostNote(String(first.cost?.reviewNote || ""));
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

  const saveScheduleAccess = async () => {
    if (!selected) return;
    const serviceWindowStartAt = fromLocalInputValue(serviceWindowStart);
    const serviceWindowEndAt = fromLocalInputValue(serviceWindowEnd);
    if (serviceWindowStart && !serviceWindowStartAt) {
      setError("Enter a valid service window start time.");
      return;
    }
    if (serviceWindowEnd && !serviceWindowEndAt) {
      setError("Enter a valid service window end time.");
      return;
    }
    if (serviceWindowStartAt && serviceWindowEndAt && serviceWindowEndAt < serviceWindowStartAt) {
      setError("Service window end must be after the start time.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await patchLandlordMaintenance(selected.id, {
        serviceWindowStartAt,
        serviceWindowEndAt,
        accessRequired: accessRequired === "yes" ? true : accessRequired === "no" ? false : null,
      });
      showToast({ message: "Scheduling details saved.", variant: "success" });
      await load();
    } catch (err: any) {
      setError(String(err?.message || "Failed to save scheduling details"));
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
    if (selected.status === "scheduled") {
      actions.push({
        label: "Mark in progress",
        onClick: () => updateStatus("in_progress", "Landlord marked service as started."),
      });
    }
    if (!["completed", "cancelled"].includes(selected.status)) {
      actions.push({
        label: "Cancel request",
        onClick: () => updateStatus("cancelled", "Landlord cancelled the request."),
      });
    }
    return actions;
  }, [assignContractor, contractorId, selected, updateStatus]);
  const workspaceView = React.useMemo(() => buildMaintenanceWorkspaceState(items, "landlord"), [items]);
  const selectedLifecycle = React.useMemo(
    () => (selected ? buildMaintenanceLifecycleView(selected, "landlord") : null),
    [selected]
  );
  const selectedAssignment = React.useMemo(
    () => (selected ? buildMaintenanceAssignmentRoutingView(selected, "landlord") : null),
    [selected]
  );
  const selectedScheduling = React.useMemo(
    () => (selected ? buildMaintenanceSchedulingAccessView(selected, "landlord") : null),
    [selected]
  );
  const selectedConfirmation = React.useMemo(
    () => (selected ? buildMaintenanceConfirmationAccessView(selected, "landlord") : null),
    [selected]
  );
  const selectedExecution = React.useMemo(
    () => (selected ? buildMaintenanceServiceExecutionView(selected, "landlord") : null),
    [selected]
  );
  const selectedResolution = React.useMemo(
    () => (selected ? buildMaintenanceResolutionVerificationView(selected, "landlord") : null),
    [selected]
  );
  const selectedReopen = React.useMemo(
    () => (selected ? buildMaintenanceReopenEscalationView(selected, "landlord") : null),
    [selected]
  );
  const selectedCost = React.useMemo(() => (selected ? buildMaintenanceCostView(selected, "landlord") : null), [selected]);
  const calendarEvents = React.useMemo(() => buildMaintenanceSchedulingCalendarEvents(items), [items]);
  const calendarDays = React.useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const calendarEventMap = React.useMemo(() => {
    const next = new Map<string, typeof calendarEvents>();
    calendarDays.forEach((date) => next.set(dayKey(date), []));
    calendarEvents.forEach((event) => {
      const key = dayKey(new Date(event.startAt));
      const list = next.get(key) || [];
      list.push(event);
      next.set(key, list);
    });
    return next;
  }, [calendarDays, calendarEvents]);

  const saveCost = React.useCallback(async () => {
    if (!selected || !selected.workOrderId || !selectedCost?.canRecordCost) return;

    const normalizedTotal = Number(costTotalInput);
    if (!Number.isFinite(normalizedTotal) || normalizedTotal <= 0) {
      setError("Enter a valid total cost before saving.");
      return;
    }

    const parseOptionalMoney = (value: string, label: string) => {
      if (!value.trim()) return null;
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`Enter a valid ${label}.`);
      }
      return Math.round(amount * 100);
    };

    let laborCostCents: number | null = null;
    let materialCostCents: number | null = null;
    let vendorCostCents: number | null = null;
    try {
      laborCostCents = parseOptionalMoney(laborCostInput, "labor cost");
      materialCostCents = parseOptionalMoney(materialCostInput, "material cost");
      vendorCostCents = parseOptionalMoney(vendorCostInput, "vendor cost");
    } catch (err: any) {
      setError(String(err?.message || "Enter valid cost amounts."));
      return;
    }

    const lineItems = [
      laborCostCents !== null ? { label: "Labor cost", amountCents: laborCostCents, category: "labor" as const } : null,
      materialCostCents !== null
        ? { label: "Material cost", amountCents: materialCostCents, category: "materials" as const }
        : null,
      vendorCostCents !== null ? { label: "Vendor cost", amountCents: vendorCostCents, category: "other" as const } : null,
    ].filter((entry): entry is { label: string; amountCents: number; category: "labor" | "materials" | "other" } => Boolean(entry));

    const totalCostCents = Math.round(normalizedTotal * 100);
    const lineItemTotalCents = lineItems.reduce((sum, entry) => sum + entry.amountCents, 0);
    if (lineItems.length > 0 && lineItemTotalCents !== totalCostCents) {
      setError("The labor, material, and vendor costs need to add up to the total cost.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await submitLandlordWorkOrderCost(selected.workOrderId, {
        actualCostCents: totalCostCents,
        currency: selected.cost?.currency || "CAD",
        lineItems,
        reviewNote: costNote.trim() || undefined,
      });
      showToast({
        message: selected.cost?.actualCostCents ? "Maintenance cost updated." : "Maintenance cost recorded.",
        variant: "success",
      });
      await load();
    } catch (err: any) {
      setError(String(err?.message || "Failed to save maintenance cost"));
    } finally {
      setSaving(false);
    }
  }, [
    costNote,
    costTotalInput,
    laborCostInput,
    load,
    materialCostInput,
    selected,
    selectedCost?.canRecordCost,
    showToast,
    vendorCostInput,
  ]);

  const linkExpense = React.useCallback(async () => {
    if (!selected?.workOrderId || !selectedCost?.canLinkExpense) return;
    setSaving(true);
    setError(null);
    try {
      await linkWorkOrderCostToExpense(selected.workOrderId);
      showToast({ message: "Expense link recorded.", variant: "success" });
      await load();
    } catch (err: any) {
      setError(String(err?.message || "Failed to link maintenance cost to an expense"));
    } finally {
      setSaving(false);
    }
  }, [load, selected?.workOrderId, selectedCost?.canLinkExpense, showToast]);

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
            { label: "Needs attention", value: workspaceView.counts.needs_attention },
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
        <div style={{ marginTop: spacing.md, color: text.secondary }}>
          <strong>{workspaceView.summaryTitle}</strong> — {workspaceView.summaryDescription}
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
        <div style={{ display: "grid", gap: spacing.md }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, color: text.primary }}>Scheduled maintenance calendar</div>
              <div style={{ color: text.muted, marginTop: 4 }}>
                Read-only month view of scheduled maintenance windows. Select an item to open the related request.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Button
                variant="secondary"
                onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                Previous
              </Button>
              <div style={{ fontWeight: 700, color: text.primary, minWidth: 160, textAlign: "center" }}>
                {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </div>
              <Button
                variant="secondary"
                onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                Next
              </Button>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div key={label} style={{ color: text.muted, fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                {label}
              </div>
            ))}
            {calendarDays.map((date) => {
              const key = dayKey(date);
              const dayEvents = calendarEventMap.get(key) || [];
              const inMonth = date.getMonth() === calendarMonth.getMonth();
              return (
                <div
                  key={key}
                  style={{
                    minHeight: 120,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: 8,
                    background: inMonth ? colors.panel : colors.card,
                    display: "grid",
                    alignContent: "start",
                    gap: 6,
                    opacity: inMonth ? 1 : 0.72,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: text.primary }}>{date.getDate()}</div>
                  {dayEvents.length ? (
                    dayEvents.map((event) => {
                      const tone = calendarPriorityTone(event.priority);
                      return (
                        <button
                          key={event.requestId}
                          type="button"
                          onClick={() => selectRequest(items.find((item) => item.id === event.requestId) || null)}
                          style={{
                            textAlign: "left",
                            border: "none",
                            borderRadius: radius.sm,
                            padding: "6px 8px",
                            background: tone.bg,
                            color: tone.color,
                            cursor: "pointer",
                            display: "grid",
                            gap: 2,
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{event.title}</span>
                          <span style={{ fontSize: 11 }}>
                            {new Date(event.startAt).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: 12, color: text.muted }}>No scheduled service</div>
                  )}
                </div>
              );
            })}
          </div>
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
                    const lifecycle = buildMaintenanceLifecycleView(item, "landlord");
                    const assignment = buildMaintenanceAssignmentRoutingView(item, "landlord");
                    const execution = buildMaintenanceServiceExecutionView(item, "landlord");
                    const resolution = buildMaintenanceResolutionVerificationView(item, "landlord");
                    const reopen = buildMaintenanceReopenEscalationView(item, "landlord");
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
                          <span
                            style={{
                              color: assignment.needsAttention || lifecycle.needsAttention ? "#b91c1c" : text.muted,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {assignment.assignmentLabel}
                          </span>
                          <span style={{ color: text.muted, fontSize: 12 }}>{item.priority}</span>
                          <span style={{ color: text.muted, fontSize: 12 }}>{fmtDate(item.createdAt)}</span>
                        </div>
                        <div style={{ color: text.secondary, fontSize: 12 }}>{assignment.ownerSummary}</div>
                        <div style={{ color: text.secondary, fontSize: 12 }}>{execution.executionLabel}</div>
                        <div style={{ color: text.secondary, fontSize: 12 }}>{resolution.verificationLabel}</div>
                        {reopen.reopenState !== "not_applicable" || reopen.escalationState !== "not_escalated" ? (
                          <div style={{ color: text.secondary, fontSize: 12 }}>
                            {reopen.escalationState === "escalated" ? reopen.escalationLabel : reopen.reopenLabel}
                          </div>
                        ) : null}
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
                      <div style={{ color: text.muted, fontSize: 12 }}>Lifecycle</div>
                      <div style={{ color: text.primary, fontWeight: 700, marginTop: 8 }}>
                        {selectedLifecycle?.lifecycleLabel || "Unknown"}
                      </div>
                    </div>
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

                  {selectedLifecycle ? (
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
                      <div style={{ fontWeight: 700, color: text.primary }}>Lifecycle summary</div>
                      <div style={{ color: text.secondary }}>{selectedLifecycle.summary}</div>
                      <div style={{ fontWeight: 700, color: text.primary }}>Next steps</div>
                      {selectedLifecycle.nextSteps.map((step) => (
                        <div key={step} style={{ color: text.secondary }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedExecution ? (
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
                      <div style={{ fontWeight: 700, color: text.primary }}>Execution / completion</div>
                      <div style={{ color: text.secondary }}>{selectedExecution.summary}</div>
                      <div style={{ fontWeight: 700, color: text.primary }}>Current service state</div>
                      <div style={{ color: text.secondary }}>{selectedExecution.executionLabel}</div>
                      <div style={{ fontWeight: 700, color: text.primary }}>Completion state</div>
                      <div style={{ color: text.secondary }}>{selectedExecution.completionLabel}</div>
                      {selectedExecution.timelineEvents.length ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Recent service updates</div>
                          {selectedExecution.timelineEvents.map((event) => (
                            <div key={event.key} style={{ color: text.secondary }}>
                              {event.label} • {fmtDate(event.timestamp)}
                            </div>
                          ))}
                        </>
                      ) : null}
                      {selected.completionSummary ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Completion note</div>
                          <div style={{ color: text.secondary }}>{selected.completionSummary}</div>
                        </>
                      ) : null}
                      {selectedExecution.blockers.length ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Needs attention</div>
                          {selectedExecution.blockers.map((item) => (
                            <div key={item} style={{ color: text.secondary }}>
                              {item}
                            </div>
                          ))}
                        </>
                      ) : null}
                      <div style={{ fontWeight: 700, color: text.primary }}>Next step</div>
                      {selectedExecution.nextActions.map((step) => (
                        <div key={step} style={{ color: text.secondary }}>
                          {step}
                        </div>
                      ))}
                      {selectedExecution.executionState === "in_progress" ? (
                        <textarea
                          value={completionSummary}
                          onChange={(e) => setCompletionSummary(e.target.value)}
                          placeholder="Add a completion note before closing the request"
                          rows={3}
                          style={{
                            width: "100%",
                            borderRadius: radius.md,
                            border: `1px solid ${colors.border}`,
                            padding: 10,
                            resize: "vertical",
                            background: colors.card,
                            color: text.primary,
                          }}
                        />
                      ) : null}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {selectedExecution.executionState === "ready_for_service" ? (
                          <Button
                            variant="secondary"
                            disabled={saving}
                            onClick={() => void updateStatus("in_progress", "Landlord marked service as started.")}
                          >
                            {saving ? "Saving..." : "Mark service started"}
                          </Button>
                        ) : null}
                        {selectedExecution.executionState === "in_progress" ? (
                          <Button
                            variant="secondary"
                            disabled={saving}
                            onClick={async () => {
                              if (!selected) return;
                              if (!completionSummary.trim()) {
                                setError("Add a completion note before marking service completed.");
                                return;
                              }
                              setSaving(true);
                              setError(null);
                              try {
                                await patchLandlordMaintenance(selected.id, {
                                  status: "completed",
                                  completionSummary: completionSummary.trim(),
                                  completionOutcome: "completed",
                                  message: "Landlord recorded service completion.",
                                });
                                showToast({ message: "Service completion recorded.", variant: "success" });
                                await load();
                              } catch (err: any) {
                                setError(String(err?.message || "Failed to record service completion"));
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            {saving ? "Saving..." : "Mark service completed"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {selectedResolution ? (
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
                      <div style={{ fontWeight: 700, color: text.primary }}>Resolution / closure</div>
                      <div style={{ color: text.secondary }}>{selectedResolution.summary}</div>
                      <div style={{ fontWeight: 700, color: text.primary }}>Verification status</div>
                      <div style={{ color: text.secondary }}>{selectedResolution.verificationLabel}</div>
                      <div style={{ fontWeight: 700, color: text.primary }}>Closure state</div>
                      <div style={{ color: text.secondary }}>{selectedResolution.closureLabel}</div>
                      {selected.followUpReason ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Follow-up note</div>
                          <div style={{ color: text.secondary }}>{selected.followUpReason}</div>
                        </>
                      ) : null}
                      {selected.tenantDeclineReason ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Tenant note</div>
                          <div style={{ color: text.secondary }}>{selected.tenantDeclineReason}</div>
                        </>
                      ) : null}
                      {selectedResolution.timelineEvents.length ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Recent closure updates</div>
                          {selectedResolution.timelineEvents.map((event) => (
                            <div key={event.key} style={{ color: text.secondary }}>
                              {event.label} • {fmtDate(event.timestamp)}
                            </div>
                          ))}
                        </>
                      ) : null}
                      {selectedResolution.blockers.length ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Needs attention</div>
                          {selectedResolution.blockers.map((item) => (
                            <div key={item} style={{ color: text.secondary }}>
                              {item}
                            </div>
                          ))}
                        </>
                      ) : null}
                      <div style={{ fontWeight: 700, color: text.primary }}>Next step</div>
                      {selectedResolution.nextActions.map((step) => (
                        <div key={step} style={{ color: text.secondary }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedReopen ? (
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
                      <div style={{ fontWeight: 700, color: text.primary }}>Reopen / escalation</div>
                      <div style={{ color: text.secondary }}>{selectedReopen.summary}</div>
                      <div style={{ fontWeight: 700, color: text.primary }}>Reopen state</div>
                      <div style={{ color: text.secondary }}>{selectedReopen.reopenLabel}</div>
                      <div style={{ fontWeight: 700, color: text.primary }}>Escalation state</div>
                      <div style={{ color: text.secondary }}>{selectedReopen.escalationLabel}</div>
                      {selected.reopenReason ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Reopen note</div>
                          <div style={{ color: text.secondary }}>{selected.reopenReason}</div>
                        </>
                      ) : null}
                      {selectedReopen.timelineEvents.length ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Recent recovery updates</div>
                          {selectedReopen.timelineEvents.map((event) => (
                            <div key={event.key} style={{ color: text.secondary }}>
                              {event.label} • {fmtDate(event.timestamp)}
                            </div>
                          ))}
                        </>
                      ) : null}
                      {selectedReopen.blockers.length ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Needs attention</div>
                          {selectedReopen.blockers.map((item) => (
                            <div key={item} style={{ color: text.secondary }}>
                              {item}
                            </div>
                          ))}
                        </>
                      ) : null}
                      <div style={{ fontWeight: 700, color: text.primary }}>Next step</div>
                      {selectedReopen.nextActions.map((step) => (
                        <div key={step} style={{ color: text.secondary }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedCost ? (
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
                      <div style={{ fontWeight: 700, color: text.primary }}>Cost</div>
                      <div style={{ color: text.secondary }}>{selectedCost.summary}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                        <div>
                          <div style={{ color: text.muted, fontSize: 12 }}>Cost state</div>
                          <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>{selectedCost.costLabel}</div>
                        </div>
                        <div>
                          <div style={{ color: text.muted, fontSize: 12 }}>Readiness</div>
                          <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                            {selectedCost.readinessLabel}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: text.muted, fontSize: 12 }}>Total cost</div>
                          <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                            {fmtMoney(selectedCost.totalCostCents, selectedCost.currency)}
                          </div>
                        </div>
                      </div>
                      {(selectedCost.breakdown.laborCostCents !== null ||
                        selectedCost.breakdown.materialCostCents !== null ||
                        selectedCost.breakdown.vendorCostCents !== null) ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                          <div>
                            <div style={{ color: text.muted, fontSize: 12 }}>Labor cost</div>
                            <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                              {fmtMoney(selectedCost.breakdown.laborCostCents, selectedCost.currency)}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: text.muted, fontSize: 12 }}>Material cost</div>
                            <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                              {fmtMoney(selectedCost.breakdown.materialCostCents, selectedCost.currency)}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: text.muted, fontSize: 12 }}>Vendor cost</div>
                            <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                              {fmtMoney(selectedCost.breakdown.vendorCostCents, selectedCost.currency)}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {selectedCost.note ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Cost note</div>
                          <div style={{ color: text.secondary }}>{selectedCost.note}</div>
                        </>
                      ) : null}
                      <div style={{ fontWeight: 700, color: text.primary }}>Expense linkage</div>
                      <div style={{ color: text.secondary }}>
                        {selectedCost.hasExpenseLink && selectedCost.linkedExpenseId
                          ? `Linked to expense ${selectedCost.linkedExpenseId}.`
                          : "No linked expense record yet."}
                      </div>
                      {selectedCost.blockers.length ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Needs attention</div>
                          {selectedCost.blockers.map((item) => (
                            <div key={item} style={{ color: text.secondary }}>
                              {item}
                            </div>
                          ))}
                        </>
                      ) : null}
                      <div style={{ fontWeight: 700, color: text.primary }}>Next step</div>
                      {selectedCost.nextSteps.map((step) => (
                        <div key={step} style={{ color: text.secondary }}>
                          {step}
                        </div>
                      ))}
                      {selectedCost.canRecordCost ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span style={{ color: text.muted, fontSize: 12 }}>Total cost</span>
                            <Input
                              aria-label="Total cost"
                              inputMode="decimal"
                              value={costTotalInput}
                              onChange={(e) => setCostTotalInput(e.target.value)}
                              placeholder="0.00"
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span style={{ color: text.muted, fontSize: 12 }}>Labor cost</span>
                            <Input
                              aria-label="Labor cost"
                              inputMode="decimal"
                              value={laborCostInput}
                              onChange={(e) => setLaborCostInput(e.target.value)}
                              placeholder="0.00"
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span style={{ color: text.muted, fontSize: 12 }}>Material cost</span>
                            <Input
                              aria-label="Material cost"
                              inputMode="decimal"
                              value={materialCostInput}
                              onChange={(e) => setMaterialCostInput(e.target.value)}
                              placeholder="0.00"
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span style={{ color: text.muted, fontSize: 12 }}>Vendor cost</span>
                            <Input
                              aria-label="Vendor cost"
                              inputMode="decimal"
                              value={vendorCostInput}
                              onChange={(e) => setVendorCostInput(e.target.value)}
                              placeholder="0.00"
                            />
                          </label>
                        </div>
                      ) : null}
                      {selectedCost.canRecordCost ? (
                        <label style={{ display: "grid", gap: 4 }}>
                          <span style={{ color: text.muted, fontSize: 12 }}>Cost note</span>
                          <textarea
                            aria-label="Cost note"
                            value={costNote}
                            onChange={(e) => setCostNote(e.target.value)}
                            rows={3}
                            style={{
                              padding: "10px",
                              borderRadius: radius.md,
                              border: `1px solid ${colors.border}`,
                              background: colors.card,
                              color: text.primary,
                              resize: "vertical",
                            }}
                          />
                        </label>
                      ) : null}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {selectedCost.canRecordCost ? (
                          <Button variant="secondary" onClick={() => void saveCost()} disabled={saving}>
                            {saving ? "Saving..." : selectedCost.totalCostCents ? "Update cost" : "Record cost"}
                          </Button>
                        ) : null}
                        {selectedCost.canLinkExpense ? (
                          <Button variant="secondary" onClick={() => void linkExpense()} disabled={saving}>
                            {saving ? "Saving..." : "Link to expense"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {selectedAssignment ? (
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
                      <div style={{ fontWeight: 700, color: text.primary }}>Assignment / handling</div>
                      <div style={{ color: text.secondary }}>{selectedAssignment.summary}</div>
                      <div style={{ fontWeight: 700, color: text.primary }}>Routing status</div>
                      <div style={{ color: text.secondary }}>{selectedAssignment.routingSummary}</div>
                      {selectedAssignment.blockers.length ? (
                        <>
                          <div style={{ fontWeight: 700, color: text.primary }}>Needs attention</div>
                          {selectedAssignment.blockers.map((item) => (
                            <div key={item} style={{ color: text.secondary }}>
                              {item}
                            </div>
                          ))}
                        </>
                      ) : null}
                      <div style={{ fontWeight: 700, color: text.primary }}>Next steps</div>
                      {selectedAssignment.nextActions.map((step) => (
                        <div key={step} style={{ color: text.secondary }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedScheduling ? (
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: radius.md,
                        padding: "12px 14px",
                        background: colors.panel,
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.primary }}>Scheduling / access</div>
                      <div style={{ color: text.secondary }}>{selectedScheduling.summary}</div>
                      <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <div>
                          <div style={{ color: text.muted, fontSize: 12 }}>Scheduling status</div>
                          <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                            {selectedScheduling.schedulingLabel}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: text.muted, fontSize: 12 }}>Service window</div>
                          <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                            {selectedScheduling.serviceWindowSummary}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: text.muted, fontSize: 12 }}>Access</div>
                          <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                            {selectedScheduling.accessLabel}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span style={{ color: text.muted, fontSize: 12 }}>Service window start</span>
                          <input
                            type="datetime-local"
                            value={serviceWindowStart}
                            onChange={(e) => setServiceWindowStart(e.target.value)}
                            style={{
                              padding: "9px 10px",
                              borderRadius: radius.md,
                              border: `1px solid ${colors.border}`,
                              background: colors.panel,
                              color: text.primary,
                            }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span style={{ color: text.muted, fontSize: 12 }}>Service window end</span>
                          <input
                            type="datetime-local"
                            value={serviceWindowEnd}
                            onChange={(e) => setServiceWindowEnd(e.target.value)}
                            style={{
                              padding: "9px 10px",
                              borderRadius: radius.md,
                              border: `1px solid ${colors.border}`,
                              background: colors.panel,
                              color: text.primary,
                            }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span style={{ color: text.muted, fontSize: 12 }}>Access requirement</span>
                          <select
                            value={accessRequired}
                            onChange={(e) => setAccessRequired(e.target.value as "unknown" | "yes" | "no")}
                            style={{
                              padding: "9px 10px",
                              borderRadius: radius.md,
                              border: `1px solid ${colors.border}`,
                              background: colors.panel,
                              color: text.primary,
                            }}
                          >
                            <option value="unknown">Not set</option>
                            <option value="yes">Access needed</option>
                            <option value="no">Access not needed</option>
                          </select>
                        </label>
                      </div>
                      {selectedScheduling.blockers.length ? (
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 700, color: text.primary }}>Needs attention</div>
                          {selectedScheduling.blockers.map((item) => (
                            <div key={item} style={{ color: text.secondary }}>
                              {item}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 700, color: text.primary }}>Next steps</div>
                        {selectedScheduling.nextActions.map((item) => (
                          <div key={item} style={{ color: text.secondary }}>
                            {item}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Button variant="secondary" onClick={() => void saveScheduleAccess()} disabled={saving}>
                          {saving ? "Saving..." : "Save scheduling"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {selectedConfirmation ? (
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: radius.md,
                        padding: "12px 14px",
                        background: colors.panel,
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.primary }}>Confirmation / access</div>
                      <div style={{ color: text.secondary }}>{selectedConfirmation.summary}</div>
                      <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <div>
                          <div style={{ color: text.muted, fontSize: 12 }}>Confirmation status</div>
                          <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                            {selectedConfirmation.confirmationLabel}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: text.muted, fontSize: 12 }}>Access</div>
                          <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                            {selectedConfirmation.accessLabel}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: text.muted, fontSize: 12 }}>Service readiness</div>
                          <div style={{ color: text.primary, fontWeight: 700, marginTop: 6 }}>
                            {selectedConfirmation.readinessLabel}
                          </div>
                        </div>
                      </div>
                      {selectedConfirmation.blockers.length ? (
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 700, color: text.primary }}>Needs attention</div>
                          {selectedConfirmation.blockers.map((item) => (
                            <div key={item} style={{ color: text.secondary }}>
                              {item}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 700, color: text.primary }}>Next steps</div>
                        {selectedConfirmation.nextActions.map((item) => (
                          <div key={item} style={{ color: text.secondary }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

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
