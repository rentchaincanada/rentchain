import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../components/ui/ToastProvider";
import { TenantDetailPanel } from "../components/tenants/TenantDetailPanel";
import { TenantLeasePanel } from "../components/tenants/TenantLeasePanel";
import { TenantPaymentsPanel } from "../components/tenants/TenantPaymentsPanel";
import {
  fetchTenantTenancies,
  fetchTenants,
  type TenancyApiModel,
  updateTenancy,
} from "@/api/tenantsApi";
import { spacing, radius, colors, text } from "../styles/tokens";
import { Card, Section, Input } from "../components/ui/Ui";
import { ResponsiveMasterDetail } from "../components/layout/ResponsiveMasterDetail";
import { InviteTenantModal } from "../components/tenants/InviteTenantModal";
import { TenantScorePill } from "../components/tenant/TenantScorePill";
import { hydrateTenantSummariesBatch, getCachedTenantSummary } from "../lib/tenantSummaryCache";
import { track } from "../lib/analytics";
import { useCapabilities } from "@/hooks/useCapabilities";
import { dispatchUpgradePrompt } from "@/lib/upgradePrompt";
import "./TenantsPage.css";

type TenantWithTenancies = any & { tenancies?: TenancyApiModel[] };
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

const EMPTY_EDITOR: OccupancyEditorState = {
  open: false,
  tenantId: null,
  tenancy: null,
  moveInAt: "",
  moveOutAt: "",
  moveOutReason: "",
  moveOutReasonNote: "",
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

function buildPropertyLink(tenancy: TenancyApiModel): string | null {
  if (!tenancy.propertyId) return null;
  const propertyId = encodeURIComponent(String(tenancy.propertyId));
  const unitRef = tenancy.unitId || tenancy.unitLabel || null;
  if (unitRef) {
    return `/properties?propertyId=${propertyId}&unitId=${encodeURIComponent(String(unitRef))}`;
  }
  return `/properties?propertyId=${propertyId}`;
}

export const TenantsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [tenants, setTenants] = useState<TenantWithTenancies[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [savingTenancyId, setSavingTenancyId] = useState<string | null>(null);
  const [occupancyEditor, setOccupancyEditor] = useState<OccupancyEditorState>(EMPTY_EDITOR);

  const selectedTenantIdFromUrl = searchParams.get("tenantId");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(selectedTenantIdFromUrl);
  const { features } = useCapabilities();
  const inviteEnabled = features?.tenant_invites !== false;

  const handleInviteAction = useCallback(() => {
    if (!inviteEnabled) {
      dispatchUpgradePrompt({ featureKey: "tenant_invites", source: "tenants_page" });
      return;
    }
    setInviteOpen(true);
  }, [inviteEnabled]);

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchTenants();
      const enriched = await Promise.all(
        rows.map(async (tenant) => {
          if (!tenant?.id) return { ...tenant, tenancies: [] };
          try {
            const tenancies = Array.isArray((tenant as any).tenancies)
              ? ((tenant as any).tenancies as TenancyApiModel[])
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
  }, [showToast]);

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
    setOccupancyEditor(EMPTY_EDITOR);
  };

  const handleSaveOccupancy = async () => {
    const tenancy = occupancyEditor.tenancy;
    if (!tenancy?.id || !occupancyEditor.tenantId) return;

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
      });

      setTenants((prev) =>
        prev.map((tenant) => {
          if (String(tenant.id) !== String(occupancyEditor.tenantId)) return tenant;
          const nextTenancies = (tenant.tenancies || []).map((row) =>
            row.id === updated.id ? { ...row, ...updated } : row
          );
          return { ...tenant, tenancies: nextTenancies };
        })
      );

      showToast({ message: "Occupancy updated", variant: "success" });
      closeOccupancyEditor();
    } catch (err: any) {
      showToast({
        message: "Failed to update occupancy",
        description: err?.message || "Please try again.",
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

  return (
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
            }}
          >
            {inviteEnabled ? "Invite tenant" : "Unlock Tenant Invites"}
          </button>
        </div>
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
              <div style={{ fontSize: 13, color: text.muted }}>Loading tenants.</div>
            ) : error ? (
              <div style={{ fontSize: 13, color: colors.danger }}>{error}</div>
            ) : filteredTenants.length === 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 13, color: text.muted }}>No tenants found.</div>
                <button
                  type="button"
                  onClick={() => {
                    track("empty_state_cta_clicked", { pageKey: "tenants", ctaKey: "invite_tenant" });
                    handleInviteAction();
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                    color: text.primary,
                    cursor: "pointer",
                    width: "fit-content",
                  }}
                >
                  Invite your first tenant
                </button>
              </div>
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
                {filteredTenants.map((tenant: any) => (
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
                {selectedTenantId && tenantExists && <TenantDetailPanel tenantId={selectedTenantId} />}
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
        onInviteCreated={() => {
          void loadTenants();
        }}
      />

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
  );
};

export default TenantsPage;
