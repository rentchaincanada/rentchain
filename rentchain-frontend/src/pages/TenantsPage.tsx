import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../components/ui/ToastProvider";
import { useAuth } from "../context/useAuth";
import { TenantDetailPanel } from "../components/tenants/TenantDetailPanel";
import { TenantLeasePanel } from "../components/tenants/TenantLeasePanel";
import { TenantPaymentsPanel } from "../components/tenants/TenantPaymentsPanel";
import {
  fetchTenantTenancies,
  fetchTenants,
  type TenancyApiModel,
  type TenantApiModel,
  updateTenantRecord,
  updateTenancy,
} from "@/api/tenantsApi";
import { createTenantEvent } from "@/api/tenantEventsWriteApi";
import { spacing, radius, colors, text } from "../styles/tokens";
import { Card, Section, Input, Button, EmptyState, InlineError, SkeletonBlock } from "../components/ui/Ui";
import { ResponsiveMasterDetail } from "../components/layout/ResponsiveMasterDetail";
import { InviteTenantModal } from "../components/tenants/InviteTenantModal";
import { TenantScorePill } from "../components/tenant/TenantScorePill";
import { hydrateTenantSummariesBatch, getCachedTenantSummary } from "../lib/tenantSummaryCache";
import { track } from "../lib/analytics";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useTenantDetail } from "@/hooks/useTenantDetail";
import { openUpgradeFlow } from "@/billing/openUpgradeFlow";
import { isTargetedHiddenTenantId } from "@/lib/testDataVisibilityTargets";
import type { TenantLeaseSummary } from "@/api/tenantDetail";
import "./TenantsPage.css";

type TenantWithTenancies = TenantApiModel & { tenancies?: TenancyApiModel[] };
type MoveOutReason = "LEASE_TERM_END" | "EARLY_LEASE_END" | "EVICTED" | "OTHER";

type OccupancyEditorState = {
  open: boolean;
  tenantId: string | null;
  tenancy: TenancyApiModel | null;
  moveInAt: string;
  moveOutAt: string;
  moveOutReason: MoveOutReason | "";
  moveOutReasonNote: string;
};

type TenantEditState = {
  open: boolean;
  tenantId: string | null;
  fullName: string;
  email: string;
  phone: string;
};

type TenantNoteState = {
  open: boolean;
  tenantId: string | null;
  tenantName: string;
  note: string;
};

const EMPTY_EDITOR: OccupancyEditorState = {
  open: false,
  tenantId: null,
  tenancy: null,
  moveInAt: "",
  moveOutAt: "",
  moveOutReason: "",
  moveOutReasonNote: "",
};

const EMPTY_TENANT_EDIT: TenantEditState = {
  open: false,
  tenantId: null,
  fullName: "",
  email: "",
  phone: "",
};

const EMPTY_TENANT_NOTE: TenantNoteState = {
  open: false,
  tenantId: null,
  tenantName: "",
  note: "",
};

const MOVE_OUT_REASON_LABEL: Record<MoveOutReason, string> = {
  LEASE_TERM_END: "Lease term end",
  EARLY_LEASE_END: "Early lease end",
  EVICTED: "Evicted",
  OTHER: "Other",
};

function dateInputValue(raw?: string | null): string {
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatDate(raw?: string | null): string {
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function summarizeTenancy(tenancy: TenancyApiModel): string {
  const moveIn = formatDate(tenancy.moveInAt);
  const moveOut = formatDate(tenancy.moveOutAt);
  if (moveOut) {
    const reason = tenancy.moveOutReason
      ? MOVE_OUT_REASON_LABEL[tenancy.moveOutReason as MoveOutReason] || tenancy.moveOutReason
      : "Reason not set";
    return `Moved out ${moveOut} (${reason})`;
  }
  if (moveIn) return `Active since ${moveIn}`;
  return tenancy.status === "inactive" ? "Inactive" : "Active";
}

function tenancyStatusLabel(status?: string | null): "Active" | "Inactive" {
  return String(status || "").toLowerCase() === "inactive" ? "Inactive" : "Active";
}

function tenantLifecycleLabel(tenant?: TenantApiModel | null): string {
  return tenant?.lifecycle?.lifecycleLabel || tenant?.status || "Unknown";
}

function buildPropertyLink(tenancy: TenancyApiModel): string | null {
  if (!tenancy.propertyId) return null;
  const propertyId = encodeURIComponent(String(tenancy.propertyId));
  const unitRef = tenancy.unitId || tenancy.unitLabel || null;
  if (unitRef) {
    return `/properties?propertyId=${propertyId}&unitId=${encodeURIComponent(String(unitRef))}`;
  }
  return `/properties?propertyId=${propertyId}`;
}

function normalizePhoneInput(value: string): string {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 15);
  return digits;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function describeTenantLinkage(
  tenant: TenantApiModel & { tenancies?: TenancyApiModel[] },
  currentLease?: TenantLeaseSummary | null
) {
  const tenancies = Array.isArray(tenant.tenancies) ? tenant.tenancies : [];
  const activeTenancies = tenancies.filter((tenancy) => tenancy.status !== "inactive");
  const primaryProperty = tenant.propertyName || tenant.propertyId || "No property linked";
  const primaryUnit = tenant.unit || tenant.unitLabel || tenant.unitId || "No unit linked";
  const currentLeaseId = String(currentLease?.id || tenant.currentLeaseId || "").trim();
  const leaseLabel = currentLeaseId
    ? [primaryProperty !== "No property linked" ? primaryProperty : null, primaryUnit !== "No unit linked" ? primaryUnit : null, "Lease"]
        .filter(Boolean)
        .join(" · ")
    : "No current lease linked";

  return {
    propertyLabel: primaryProperty,
    unitLabel: primaryUnit,
    leaseLabel,
    leaseId: currentLeaseId || null,
    activeTenancyCount: activeTenancies.length,
    linkageNote:
      !tenant.propertyId && !tenant.unitId && !currentLeaseId
        ? "This tenant record has no canonical property, unit, or current lease linkage yet."
        : activeTenancies.length === 0
        ? "No active tenancy registrations are linked to this tenant."
        : "Tenant profile links remain separate from tenancy and lease lifecycle state.",
  };
}

function getTenantCurrentLeaseId(
  tenant?: TenantApiModel | null,
  currentLease?: TenantLeaseSummary | null
): string {
  return String(currentLease?.id || tenant?.currentLeaseId || "").trim();
}

type TenantsErrorBoundaryState = {
  hasError: boolean;
  debugId: string;
};

class TenantsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  TenantsErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, debugId: "" };
  }

  static getDerivedStateFromError(): TenantsErrorBoundaryState {
    return {
      hasError: true,
      debugId: `tenants_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[TenantsPage] render crash", {
      debugId: this.state.debugId,
      message: error?.message || "unknown",
      stack: error?.stack || null,
      componentStack: info?.componentStack || null,
    });
  }

  private copyDebugId = async () => {
    const id = this.state.debugId || "unknown";
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      }
    } catch {
      // no-op fallback
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card elevated>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: text.primary }}>
              Something went wrong. Reload.
            </div>
            <div style={{ fontSize: 12, color: text.muted }}>
              Debug ID: {this.state.debugId || "unknown"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: "8px 10px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
                  color: text.primary,
                  cursor: "pointer",
                }}
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => void this.copyDebugId()}
                style={{
                  padding: "8px 10px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  color: text.primary,
                  cursor: "pointer",
                }}
              >
                Copy debug id
              </button>
            </div>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}

export const TenantsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, ready, isLoading: authLoading, authStatus } = useAuth();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [tenants, setTenants] = useState<TenantWithTenancies[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [tenantEdit, setTenantEdit] = useState<TenantEditState>(EMPTY_TENANT_EDIT);
  const [tenantNote, setTenantNote] = useState<TenantNoteState>(EMPTY_TENANT_NOTE);
  const [savingTenantProfile, setSavingTenantProfile] = useState(false);
  const [savingTenantNote, setSavingTenantNote] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [savingTenancyId, setSavingTenancyId] = useState<string | null>(null);
  const [occupancySaveError, setOccupancySaveError] = useState<string | null>(null);
  const [occupancyEditor, setOccupancyEditor] = useState<OccupancyEditorState>(EMPTY_EDITOR);

  const selectedTenantIdFromUrl = searchParams.get("tenantId");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(selectedTenantIdFromUrl);
  const { features } = useCapabilities();
  const inviteEnabled = Boolean(features?.tenant_invites || features?.tenantInvites);
  const upgradeConfirmed = searchParams.get("upgradeConfirmed") === "1";
  const upgradeHighlight = searchParams.get("highlight");

  const role = String(user?.actorRole || user?.role || "").trim().toLowerCase();
  const canViewTenants = role === "landlord" || role === "admin";

  const handleInviteAction = useCallback(() => {
    if (!inviteEnabled) {
      void openUpgradeFlow({ navigate, fallbackPath: "/pricing" });
      return;
    }
    setInviteOpen(true);
  }, [inviteEnabled, navigate]);

  const refreshTenantTenancies = useCallback(async (tenantId: string) => {
    const nextTenancies = await fetchTenantTenancies(tenantId);
    setTenants((prev) =>
      prev.map((tenant) =>
        String(tenant.id) === String(tenantId)
          ? { ...tenant, tenancies: nextTenancies }
          : tenant
      )
    );
  }, []);

const loadTenants = useCallback(async () => {
    if (!ready || authLoading || authStatus === "restoring") return;
    if (!canViewTenants) {
      setTenants([]);
      setError("This page is only available to landlords.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchTenants();
      const visibleRows = rows.filter(
        (tenant) =>
          tenant?.hiddenFromActiveLists !== true &&
          !isTargetedHiddenTenantId(tenant?.id)
      );
      const enriched = await Promise.all(
        visibleRows.map(async (tenant) => {
          if (!tenant?.id) return { ...tenant, tenancies: [] };
          try {
            const tenancies = Array.isArray(tenant.tenancies)
              ? tenant.tenancies
              : await fetchTenantTenancies(String(tenant.id));
            return { ...tenant, tenancies };
          } catch {
            return { ...tenant, tenancies: [] };
          }
        })
      );
      setTenants(enriched as TenantWithTenancies[]);
    } catch (err) {
      console.error("[TenantsPage] Failed to load tenants", err);
      setError("Failed to load tenants");
      showToast({
        message: "Failed to load tenants",
        description: "An error occurred while fetching the tenant list.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [authLoading, authStatus, canViewTenants, ready, showToast]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    if (!selectedTenantIdFromUrl) {
      setSelectedTenantId(null);
      return;
    }
    const exists = tenants.some((t) => t.id === selectedTenantIdFromUrl);
    if (exists) {
      setSelectedTenantId(selectedTenantIdFromUrl);
    }
  }, [selectedTenantIdFromUrl, tenants]);

  useEffect(() => {
    if (searchParams.get("invite") === "1") {
      handleInviteAction();
    }
  }, [searchParams, handleInviteAction]);

  const handleSelectTenant = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    navigate(`/tenants?tenantId=${tenantId}`);
  };

  const openOccupancyEditor = (tenantId: string, tenancy: TenancyApiModel) => {
    setOccupancySaveError(null);
    setOccupancyEditor({
      open: true,
      tenantId,
      tenancy,
      moveInAt: dateInputValue(tenancy.moveInAt),
      moveOutAt: dateInputValue(tenancy.moveOutAt),
      moveOutReason: (tenancy.moveOutReason || "") as MoveOutReason | "",
      moveOutReasonNote: tenancy.moveOutReasonNote || "",
    });
  };

  const closeOccupancyEditor = () => {
    setOccupancySaveError(null);
    setOccupancyEditor(EMPTY_EDITOR);
  };

  const handleSaveOccupancy = async () => {
    const tenancy = occupancyEditor.tenancy;
    if (!tenancy?.id || !occupancyEditor.tenantId) {
      setOccupancySaveError("Missing tenancy details. Close and try again.");
      return;
    }
    setOccupancySaveError(null);

    if (occupancyEditor.moveOutAt && !occupancyEditor.moveOutReason) {
      showToast({ message: "Select a move-out reason", variant: "warning" });
      return;
    }
    if (
      occupancyEditor.moveOutAt &&
      occupancyEditor.moveOutReason === "OTHER" &&
      !occupancyEditor.moveOutReasonNote.trim()
    ) {
      showToast({ message: "Add a note for Other reason", variant: "warning" });
      return;
    }

    try {
      setSavingTenancyId(tenancy.id);
      const updated = await updateTenancy(tenancy.id, {
        moveInAt: occupancyEditor.moveInAt
          ? new Date(occupancyEditor.moveInAt).toISOString()
          : null,
        moveOutAt: occupancyEditor.moveOutAt
          ? new Date(occupancyEditor.moveOutAt).toISOString()
          : null,
        moveOutReason: occupancyEditor.moveOutReason || null,
        moveOutReasonNote: occupancyEditor.moveOutReasonNote.trim() || null,
        status: occupancyEditor.moveOutAt ? "inactive" : "active",
      });
      if (!updated || typeof updated !== "object" || !updated.id) {
        throw new Error("Invalid tenancy update response");
      }

      await refreshTenantTenancies(String(occupancyEditor.tenantId));

      showToast({ message: "Occupancy updated", variant: "success" });
      closeOccupancyEditor();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to update occupancy.");
      setOccupancySaveError(message);
      showToast({
        message: "Failed to update occupancy",
        description: message,
        variant: "error",
      });
    } finally {
      setSavingTenancyId(null);
    }
  };

  const selectedTenant = selectedTenantId
    ? tenants.find((t) => t.id === selectedTenantId) || null
    : null;
  const tenantExists = Boolean(selectedTenant);
  const { bundle: selectedTenantDetailBundle } = useTenantDetail(tenantExists ? selectedTenantId : null);
  const selectedCurrentLease =
    selectedTenantDetailBundle?.currentLease || selectedTenantDetailBundle?.lease || null;
  const selectedCurrentLeaseId = getTenantCurrentLeaseId(selectedTenant, selectedCurrentLease);
  const selectedTenantLinkage = selectedTenant
    ? describeTenantLinkage(selectedTenant, selectedCurrentLease)
    : null;
  const selectedLeaseLedgerPath = selectedCurrentLeaseId
    ? `/leases/${encodeURIComponent(selectedCurrentLeaseId)}/ledger`
    : null;
  const selectedLeaseSummaryPath = selectedCurrentLeaseId
    ? `/leases/${encodeURIComponent(selectedCurrentLeaseId)}/summary`
    : null;

  const filteredTenants = useMemo(() => {
    const base = tenants || [];
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((t) => {
      const name = (t.name || t.fullName || "").toLowerCase();
      const property = (t.propertyName || t.propertyId || "").toLowerCase();
      const unit = (t.unitLabel || t.unit || "").toLowerCase();
      return name.includes(q) || property.includes(q) || unit.includes(q);
    });
  }, [tenants, searchQuery]);

  const visibleTenantIds = useMemo(
    () => (filteredTenants || []).slice(0, 50).map((t) => t.id).filter(Boolean),
    [filteredTenants]
  );

  useEffect(() => {
    void hydrateTenantSummariesBatch(visibleTenantIds);
  }, [visibleTenantIds]);

  const openTenantEdit = () => {
    if (!selectedTenant) return;
    setTenantEdit({
      open: true,
      tenantId: String(selectedTenant.id),
      fullName: String(selectedTenant.fullName || selectedTenant.name || ""),
      email: String(selectedTenant.email || ""),
      phone: String(selectedTenant.phone || ""),
    });
  };

  const closeTenantEdit = () => setTenantEdit(EMPTY_TENANT_EDIT);

  const openTenantNote = () => {
    if (!selectedTenant) return;
    setTenantNote({
      open: true,
      tenantId: String(selectedTenant.id),
      tenantName: String(selectedTenant.fullName || selectedTenant.name || "Tenant"),
      note: "",
    });
  };

  const closeTenantNote = () => setTenantNote(EMPTY_TENANT_NOTE);

  const handleSaveTenantProfile = async () => {
    if (!tenantEdit.tenantId) return;
    const fullName = tenantEdit.fullName.trim();
    if (!fullName) {
      showToast({ message: "Tenant name is required", variant: "warning" });
      return;
    }

    try {
      setSavingTenantProfile(true);
      const updated = await updateTenantRecord(tenantEdit.tenantId, {
        fullName,
        email: tenantEdit.email.trim() || null,
        phone: tenantEdit.phone.trim() || null,
      });
      setTenants((prev) =>
        prev.map((tenant) =>
          String(tenant.id) === String(tenantEdit.tenantId)
            ? { ...tenant, ...updated }
            : tenant
        )
      );
      showToast({ message: "Tenant updated", variant: "success" });
      closeTenantEdit();
    } catch (err: unknown) {
      showToast({
        message: "Failed to update tenant",
        description: getErrorMessage(err, "Please try again."),
        variant: "error",
      });
    } finally {
      setSavingTenantProfile(false);
    }
  };

  const handleCreateTenantNote = async () => {
    if (!tenantNote.tenantId) return;
    const note = tenantNote.note.trim();
    if (!note) {
      showToast({ message: "Add a note before saving", variant: "warning" });
      return;
    }

    try {
      setSavingTenantNote(true);
      await createTenantEvent({
        tenantId: tenantNote.tenantId,
        type: "NOTE_ADDED",
        description: note,
      });
      showToast({
        message: "Tenant note added",
        description: `Saved to ${tenantNote.tenantName}'s timeline.`,
        variant: "success",
      });
      setActivityRefreshKey((prev) => prev + 1);
      closeTenantNote();
    } catch (err: unknown) {
      showToast({
        message: "Failed to add tenant note",
        description: getErrorMessage(err, "Please try again."),
        variant: "error",
      });
    } finally {
      setSavingTenantNote(false);
    }
  };

  if (ready && !authLoading && authStatus !== "restoring" && !canViewTenants) {
    return (
      <Card elevated>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700, color: text.primary }}>Access restricted</div>
          <div style={{ color: text.muted, fontSize: 14 }}>
            The tenants workspace is only available to landlord and admin accounts.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <TenantsErrorBoundary>
      <div className="page-content" style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <Card elevated className="rc-tenants-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Tenants</h1>
            <div style={{ marginTop: 4, color: text.muted, fontSize: "0.95rem", lineHeight: 1.45 }}>
              Manage tenant records, ledgers, and unit occupancy.
            </div>
          </div>
          <button
            onClick={handleInviteAction}
            style={{
              padding: "10px 12px",
              borderRadius: radius.sm,
              border: `1px solid ${inviteEnabled ? colors.border : "#f5d0fe"}`,
              background: inviteEnabled ? colors.panel : "#faf5ff",
              cursor: "pointer",
              minHeight: 44,
              boxShadow:
                upgradeConfirmed && upgradeHighlight === "tenants" && inviteEnabled
                  ? "0 0 0 3px rgba(16,185,129,0.14)"
                  : undefined,
            }}
          >
            {inviteEnabled ? "Invite tenant" : "Unlock Tenant Invites"}
          </button>
        </div>
        {upgradeConfirmed && inviteEnabled ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(16,185,129,0.28)",
              background: "rgba(16,185,129,0.08)",
              color: text.primary,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Upgrade confirmed. Tenant invites are now unlocked for this workspace.
          </div>
        ) : null}
      </Card>

      <Card elevated className="rc-tenants-grid">
        <ResponsiveMasterDetail
          title={undefined}
          searchSlot={
            <div className="rc-tenants-search">
              <Input
                type="text"
                placeholder="Search by name, property, unit"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ borderRadius: radius.pill }}
              />
            </div>
          }
          masterTitle="Tenants"
          master={
            loading ? (
              <SkeletonBlock lines={5} label="Loading tenants" />
            ) : error ? (
              <InlineError title="Tenants unavailable" message={error} retry={() => void loadTenants()} />
            ) : filteredTenants.length === 0 ? (
              <EmptyState
                title="No tenants yet"
                body="Tenant records help you track occupancy, communication, and payment history in one place."
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      track("empty_state_cta_clicked", { pageKey: "tenants", ctaKey: "invite_tenant" });
                      handleInviteAction();
                    }}
                  >
                    Invite your first tenant
                  </Button>
                }
              />
            ) : (
              <div className="rc-tenants-list-scroll">
                {filteredTenants.map((tenant: TenantWithTenancies) => {
                  const isSelected = tenant.id === selectedTenantId;
                  const summary = getCachedTenantSummary(tenant.id);
                  const tenancies = Array.isArray(tenant.tenancies) ? tenant.tenancies : [];
                  return (
                    <div
                      key={tenant.id}
                      className="rc-tenants-list-item"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "1px solid",
                        borderColor: isSelected ? colors.accent : colors.border,
                        background: isSelected ? "rgba(96,165,250,0.08)" : colors.card,
                        borderRadius: radius.md,
                        padding: "12px 12px",
                        color: text.primary,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectTenant(tenant.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          padding: 0,
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 600 }}>
                          {tenant.name || tenant.fullName || "Unnamed tenant"}
                        </span>
                        <span style={{ fontSize: 12, color: text.muted }}>
                          {(tenant.propertyName || tenant.propertyId || "Property") + " - " + (tenant.unitLabel || tenant.unit || "")}
                        </span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <TenantScorePill compact score={summary?.scoreV1 ?? null} tier={summary?.tierV1 ?? null} />
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              borderRadius: radius.pill,
                              border: `1px solid ${tenant.lifecycle?.flags?.hasStateConflict ? "rgba(245,158,11,0.45)" : colors.border}`,
                              padding: "2px 7px",
                              background: tenant.lifecycle?.flags?.hasStateConflict
                                ? "rgba(245,158,11,0.10)"
                                : colors.panel,
                              color: text.primary,
                            }}
                          >
                            {tenantLifecycleLabel(tenant)}
                          </span>
                        </div>
                      </button>

                      <div style={{ display: "grid", gap: 6, borderTop: `1px solid ${colors.border}`, paddingTop: 8 }}>
                        <div style={{ fontSize: 12, color: text.muted, fontWeight: 600 }}>Registered units</div>
                        {tenancies.length === 0 ? (
                          <div style={{ fontSize: 12, color: text.muted }}>No registered units</div>
                        ) : (
                          tenancies.map((tenancy) => {
                            const link = buildPropertyLink(tenancy);
                            const unitText = tenancy.unitLabel || tenancy.unitId || "Unit";
                            return (
                              <div key={tenancy.id} style={{ display: "grid", gap: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                    {link ? (
                                      <button
                                        type="button"
                                        onClick={() => navigate(link)}
                                        style={{
                                          border: "none",
                                          background: "transparent",
                                          color: colors.accent,
                                          cursor: "pointer",
                                          fontSize: 12,
                                          padding: 0,
                                          textDecoration: "underline",
                                        }}
                                      >
                                        {unitText}
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: 12, color: text.primary }}>{unitText}</span>
                                    )}
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        borderRadius: radius.pill,
                                        border: `1px solid ${colors.border}`,
                                        padding: "2px 7px",
                                        background:
                                          tenancyStatusLabel(tenancy.status) === "Inactive"
                                            ? "rgba(239,68,68,0.08)"
                                            : "rgba(34,197,94,0.08)",
                                        color:
                                          tenancyStatusLabel(tenancy.status) === "Inactive"
                                            ? colors.danger
                                            : "#166534",
                                      }}
                                    >
                                      {tenancyStatusLabel(tenancy.status)}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openOccupancyEditor(String(tenant.id), tenancy)}
                                    style={{
                                      fontSize: 11,
                                      borderRadius: radius.md,
                                      border: `1px solid ${colors.border}`,
                                      background: colors.panel,
                                      color: text.primary,
                                      padding: "4px 8px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Update occupancy
                                  </button>
                                </div>
                                <div style={{ fontSize: 11, color: text.muted }}>{summarizeTenancy(tenancy)}</div>
                                {tenancy.moveOutAt ? (
                                  <div style={{ fontSize: 11, color: text.muted }}>
                                    Move-out date: {formatDate(tenancy.moveOutAt)}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
          masterDropdown={
            filteredTenants.length ? (
              <select
                value={selectedTenantId || ""}
                onChange={(e) => handleSelectTenant(e.target.value)}
                className="rc-full-width-mobile"
              >
                <option value="">Select tenant</option>
                {filteredTenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name || tenant.fullName || "Tenant"}
                  </option>
                ))}
              </select>
            ) : null
          }
          hasSelection={Boolean(selectedTenantId)}
          selectedLabel={selectedTenant?.name || selectedTenant?.fullName || "Tenant"}
          onClearSelection={() => {
            setSelectedTenantId(null);
            navigate("/tenants");
          }}
          detail={
            <div className="rc-tenants-detail">
              {selectedTenant && selectedTenantLinkage ? (
                <Section>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: text.primary }}>
                          Tenant actions
                        </div>
                        <div style={{ fontSize: 12, color: text.muted }}>
                          Manage the tenant person record separately from tenancy and lease state.
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={openTenantEdit}
                          style={{
                            padding: "8px 10px",
                            borderRadius: radius.md,
                            border: `1px solid ${colors.border}`,
                            background: colors.card,
                            color: text.primary,
                            cursor: "pointer",
                          }}
                        >
                          Edit tenant
                        </button>
                        <button
                          type="button"
                          onClick={openTenantNote}
                          style={{
                            padding: "8px 10px",
                            borderRadius: radius.md,
                            border: `1px solid ${colors.border}`,
                            background: colors.card,
                            color: text.primary,
                            cursor: "pointer",
                          }}
                        >
                          Add note
                        </button>
                        <button
                          type="button"
                          onClick={handleInviteAction}
                          style={{
                            padding: "8px 10px",
                            borderRadius: radius.md,
                            border: `1px solid ${inviteEnabled ? colors.border : "#f5d0fe"}`,
                            background: inviteEnabled ? colors.card : "#faf5ff",
                            color: text.primary,
                            cursor: "pointer",
                          }}
                        >
                          {inviteEnabled ? "Send tenant invite" : "Unlock Tenant Invites"}
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: text.muted }}>Lifecycle</div>
                        <div style={{ marginTop: 4, fontSize: 14, color: text.primary }}>
                          {tenantLifecycleLabel(selectedTenant)}
                        </div>
                      </Card>
                      <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: text.muted }}>Property</div>
                        <div style={{ marginTop: 4, fontSize: 14, color: text.primary }}>
                          {selectedTenantLinkage.propertyLabel}
                        </div>
                      </Card>
                      <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: text.muted }}>Unit</div>
                        <div style={{ marginTop: 4, fontSize: 14, color: text.primary }}>
                          {selectedTenantLinkage.unitLabel}
                        </div>
                      </Card>
                      <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: text.muted }}>Current lease link</div>
                        <div style={{ marginTop: 4, fontSize: 14, color: text.primary }}>
                          {selectedLeaseSummaryPath ? (
                            <Link to={selectedLeaseSummaryPath} style={{ fontWeight: 700, color: "#2563eb" }}>
                              {selectedTenantLinkage.leaseLabel}
                            </Link>
                          ) : (
                            selectedTenantLinkage.leaseLabel
                          )}
                        </div>
                      </Card>
                      <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: text.muted }}>Active registered units</div>
                        <div style={{ marginTop: 4, fontSize: 14, color: text.primary }}>
                          {selectedTenantLinkage.activeTenancyCount}
                        </div>
                      </Card>
                    </div>
                    <div style={{ fontSize: 12, color: text.muted }}>{selectedTenantLinkage.linkageNote}</div>
                  </div>
                </Section>
              ) : null}
              {selectedTenant && selectedTenantLinkage ? (
                <Section>
                  <Card>
                    <div style={{ display: "grid", gap: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4, minWidth: 220 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: text.primary }}>
                            Lease ledger
                          </div>
                          <div style={{ fontSize: 13, color: text.muted, lineHeight: 1.45 }}>
                            Current lease charges, payments, balances, and exports.
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {[
                            "View ledger",
                            "Record payment",
                            "Export ledger",
                          ].map((label) => (
                            <button
                              key={label}
                              type="button"
                              disabled={!selectedLeaseLedgerPath}
                              onClick={() => {
                                if (selectedLeaseLedgerPath) navigate(selectedLeaseLedgerPath);
                              }}
                              style={{
                                padding: "8px 10px",
                                borderRadius: radius.md,
                                border: `1px solid ${colors.border}`,
                                background: selectedLeaseLedgerPath ? colors.card : colors.panel,
                                color: selectedLeaseLedgerPath ? text.primary : text.muted,
                                cursor: selectedLeaseLedgerPath ? "pointer" : "not-allowed",
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: text.muted }}>Property</div>
                          <div style={{ marginTop: 4, fontSize: 14, color: text.primary }}>
                            {selectedTenantLinkage.propertyLabel}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: text.muted }}>Unit</div>
                          <div style={{ marginTop: 4, fontSize: 14, color: text.primary }}>
                            {selectedTenantLinkage.unitLabel}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: text.muted }}>Current lease</div>
                          <div style={{ marginTop: 4, fontSize: 14, color: text.primary }}>
                            {selectedLeaseSummaryPath ? (
                              <Link to={selectedLeaseSummaryPath} style={{ fontWeight: 700, color: "#2563eb" }}>
                                {selectedTenantLinkage.leaseLabel}
                              </Link>
                            ) : (
                              selectedTenantLinkage.leaseLabel
                            )}
                          </div>
                        </div>
                      </div>
                      {!selectedLeaseLedgerPath ? (
                        <div style={{ fontSize: 12, color: text.muted }}>
                          Link a current lease before using lease ledger actions.
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </Section>
              ) : null}
              <Section style={{ minHeight: 0 }}>
                {!selectedTenantId && <div style={{ fontSize: 13, color: text.muted }}>Select a tenant from the list to see details.</div>}
                {selectedTenantId && !tenantExists && !loading && (
                  <div
                    style={{
                      fontSize: 13,
                      color: text.primary,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Tenant not found.</div>
                    <div style={{ color: text.muted }}>The tenant you're looking for could not be loaded.</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTenantId(null);
                          navigate("/tenants");
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: radius.md,
                          border: `1px solid ${colors.border}`,
                          background: colors.card,
                          color: text.primary,
                        }}
                      >
                        Back to tenants list
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(0)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: radius.md,
                          border: `1px solid ${colors.border}`,
                          background: colors.card,
                          color: text.primary,
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}
                {selectedTenantId && tenantExists && (
                  <TenantDetailPanel tenantId={selectedTenantId} activityRefreshKey={activityRefreshKey} />
                )}
              </Section>

              <Section>
                <TenantLeasePanel tenantId={tenantExists ? selectedTenantId : null} />
              </Section>

              <Section>
                <TenantPaymentsPanel tenantId={tenantExists ? selectedTenantId : null} />
              </Section>
            </div>
          }
        />
      </Card>

      <InviteTenantModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        defaultPropertyId={selectedTenant?.propertyId || undefined}
        defaultUnitId={selectedTenant?.unitId || undefined}
        defaultTenantEmail={selectedTenant?.email || undefined}
        defaultTenantName={selectedTenant?.fullName || selectedTenant?.name || undefined}
        onInviteCreated={() => {
          void loadTenants();
        }}
      />

      {tenantEdit.open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200,
            padding: 16,
          }}
        >
          <Card style={{ width: "min(480px, 96vw)", borderRadius: radius.lg }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Edit tenant</div>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: text.muted }}>
                Full name
                <input
                  value={tenantEdit.fullName}
                  onChange={(e) => setTenantEdit((prev) => ({ ...prev, fullName: e.target.value }))}
                  style={{ padding: 8, borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: text.muted }}>
                Email
                <input
                  value={tenantEdit.email}
                  onChange={(e) => setTenantEdit((prev) => ({ ...prev, email: e.target.value }))}
                  style={{ padding: 8, borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: text.muted }}>
                Phone
                <input
                  value={tenantEdit.phone}
                  onChange={(e) =>
                    setTenantEdit((prev) => ({
                      ...prev,
                      phone: normalizePhoneInput(e.target.value),
                    }))
                  }
                  style={{ padding: 8, borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={closeTenantEdit}
                  style={{
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                    color: text.primary,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveTenantProfile()}
                  disabled={savingTenantProfile}
                  style={{
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.accent}`,
                    background: "rgba(37, 99, 235, 0.12)",
                    color: colors.accent,
                    cursor: "pointer",
                    opacity: savingTenantProfile ? 0.7 : 1,
                  }}
                >
                  {savingTenantProfile ? "Saving..." : "Save tenant"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {tenantNote.open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200,
            padding: 16,
          }}
        >
          <Card style={{ width: "min(480px, 96vw)", borderRadius: radius.lg }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Add tenant note</div>
              <div style={{ fontSize: 12, color: text.muted }}>
                Notes are saved as audited tenant timeline events.
              </div>
              <textarea
                value={tenantNote.note}
                onChange={(e) => setTenantNote((prev) => ({ ...prev, note: e.target.value }))}
                rows={5}
                placeholder="Add a note about contact details, follow-up, or context."
                style={{ padding: 8, borderRadius: radius.md, border: `1px solid ${colors.border}`, resize: "vertical" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={closeTenantNote}
                  style={{
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                    color: text.primary,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateTenantNote()}
                  disabled={savingTenantNote}
                  style={{
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.accent}`,
                    background: "rgba(37, 99, 235, 0.12)",
                    color: colors.accent,
                    cursor: "pointer",
                    opacity: savingTenantNote ? 0.7 : 1,
                  }}
                >
                  {savingTenantNote ? "Saving..." : "Save note"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {occupancyEditor.open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200,
            padding: 16,
          }}
        >
          <Card
            style={{
              width: "min(520px, 96vw)",
              borderRadius: radius.lg,
              border: `1px solid ${colors.border}`,
              boxShadow: "0 24px 48px rgba(15, 23, 42, 0.24)",
            }}
          >
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Update occupancy</div>
              {occupancySaveError ? (
                <div
                  role="alert"
                  style={{
                    borderRadius: radius.md,
                    border: `1px solid ${colors.danger}`,
                    background: "rgba(239,68,68,0.08)",
                    color: colors.danger,
                    fontSize: 12,
                    padding: "8px 10px",
                  }}
                >
                  {occupancySaveError}
                </div>
              ) : null}
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: text.muted }}>
                Move-in date
                <input
                  type="date"
                  value={occupancyEditor.moveInAt}
                  onChange={(e) => setOccupancyEditor((prev) => ({ ...prev, moveInAt: e.target.value }))}
                  style={{ padding: 8, borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: text.muted }}>
                Move-out date
                <input
                  type="date"
                  value={occupancyEditor.moveOutAt}
                  onChange={(e) => setOccupancyEditor((prev) => ({ ...prev, moveOutAt: e.target.value }))}
                  style={{ padding: 8, borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: text.muted }}>
                Move-out reason
                <select
                  value={occupancyEditor.moveOutReason}
                  onChange={(e) =>
                    setOccupancyEditor((prev) => ({
                      ...prev,
                      moveOutReason: e.target.value as MoveOutReason | "",
                    }))
                  }
                  style={{ padding: 8, borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                >
                  <option value="">Select reason</option>
                  <option value="LEASE_TERM_END">Lease term end</option>
                  <option value="EARLY_LEASE_END">Early lease end</option>
                  <option value="EVICTED">Evicted</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: text.muted }}>
                Note
                <textarea
                  value={occupancyEditor.moveOutReasonNote}
                  onChange={(e) =>
                    setOccupancyEditor((prev) => ({ ...prev, moveOutReasonNote: e.target.value }))
                  }
                  rows={3}
                  placeholder="Optional details"
                  style={{ padding: 8, borderRadius: radius.md, border: `1px solid ${colors.border}`, resize: "vertical" }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={closeOccupancyEditor}
                  style={{
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                    color: text.primary,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveOccupancy()}
                  disabled={savingTenancyId === occupancyEditor.tenancy?.id}
                  style={{
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.accent}`,
                    background: "rgba(37, 99, 235, 0.12)",
                    color: colors.accent,
                    cursor: "pointer",
                    opacity: savingTenancyId === occupancyEditor.tenancy?.id ? 0.7 : 1,
                  }}
                >
                  {savingTenancyId === occupancyEditor.tenancy?.id ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
      </div>
    </TenantsErrorBoundary>
  );
};

export default TenantsPage;
