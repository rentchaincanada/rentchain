// @ts-nocheck
// src/pages/PropertiesPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MacShell } from "../components/layout/MacShell";
import { AddPropertyForm } from "../components/properties/AddPropertyForm";
import { fetchProperties, Property } from "../api/propertiesApi";
import { PropertyActivityPanel } from "../components/property/PropertyActivityPanel";
import { PropertyDetailPanel } from "../components/properties/PropertyDetailPanel";
import { spacing, radius, shadows, colors, text } from "../styles/tokens";
import { safeLocaleDate } from "../utils/format";
import { Card, Section, Button } from "../components/ui/Ui";
import { useLocation, useNavigate } from "react-router-dom";
import {
  listActionRequests,
  acknowledgeActionRequest,
  resolveActionRequest,
} from "../api/actionRequestsApi";
import type { PropertyActionRequest, ActionRequestStatus } from "../types/models";
import { ActionRequestsPanel } from "../components/ActionRequestsPanel";
import { fetchActionRequestCounts } from "../api/actionRequestCountsApi";
import { ActionCenterDrawer } from "../components/action-center/ActionCenterDrawer";
import { fetchMonthlyOpsSnapshot } from "../api/actionSnapshotApi";
import { asArray } from "../lib/asArray";
import { fetchMe } from "../api/meApi";
import { fetchAccountLimits, type AccountLimits } from "../api/accountApi";
import { arr, num, str } from "@/utils/safe";
import { useUpgrade } from "../context/UpgradeContext";
import { setOnboardingStep } from "../api/onboardingApi";
import { addUnitsManual, type UnitInput } from "../api/unitsApi";
import { useToast } from "../components/ui/ToastProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PLANS } from "../config/plans";
import { resolvePlanFrom, normalizePlan } from "../lib/plan";
import { unitsForProperty } from "../lib/propertyCounts";

const PropertiesPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null
  );
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [actionReqCount, setActionReqCount] = useState(0);
  const [actionRequests, setActionRequests] = useState<PropertyActionRequest[]>([]);
  const [actionRequestsLoading, setActionRequestsLoading] = useState(false);
  const [actionRequestsError, setActionRequestsError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<ActionRequestStatus | "all">("all");
  const [activeRequest, setActiveRequest] = useState<PropertyActionRequest | null>(null);
  const [note, setNote] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [draftUnits, setDraftUnits] = useState<UnitInput[]>([
    { unitNumber: "", beds: 1, baths: 1, sqft: 500, marketRent: 1500, status: "vacant" },
  ]);
  const [savingUnits, setSavingUnits] = useState(false);
  const [actionRequestUpdating, setActionRequestUpdating] = useState(false);
  const [actionRequestUpdateError, setActionRequestUpdateError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [actionCounts, setActionCounts] = useState<Record<string, number>>({});
  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [limits, setLimits] = useState<AccountLimits | null>(null);
  const { openUpgrade } = useUpgrade();
  const { showToast } = useToast();
  const isMobile = useIsMobile();
  const plan = resolvePlanFrom({ me, limits });
  const planKey = normalizePlan(plan);
  const planLimits = (PLANS as any)[planKey] ?? PLANS.starter;
  const maxProperties = planLimits.maxProperties;
  const maxUnits = planLimits.maxUnits;
  const currentProperties = properties?.length ?? 0;
  const limitsReady = Boolean(limits && planLimits && typeof planLimits.maxProperties === "number");
  const atCap = limitsReady ? currentProperties >= maxProperties : false;
  const canAddProperty = limitsReady && !atCap;
  const unitsUsed = useMemo(
    () => (properties || []).reduce((sum, p) => sum + unitsForProperty(p), 0),
    [properties]
  );
  const totalOpenAcrossPortfolio = useMemo(() => Object.values(actionCounts || {}).reduce((a, b) => a + (b || 0), 0), [
    actionCounts,
  ]);

  const propertyLabelById = useMemo(() => {
    const out: Record<string, { name: string; subtitle?: string }> = {};
    for (const p of arr<any>(properties)) {
      if (!p || !p.id) continue;
      const name = str(p.name) || str(p.addressLine1) || "Property";
      const subtitleParts = [p.addressLine1, p.city].filter(Boolean);
      out[String(p.id)] = { name, subtitle: subtitleParts.join(", ") };
    }
    return out;
  }, [properties]);

  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const propertyIdFromUrl = params.get("propertyId") || "";
  const openAddLease = params.get("openAddLease") === "1";
  const openAddUnit = params.get("openAddUnit") === "1";
  const openEditUnits = params.get("openEditUnits") === "1";
  const openEditProperty = params.get("openEditProperty") === "1";
  const deepLinkId = params.get("actionRequestId") || undefined;
  const panel = params.get("panel") || "";

  useEffect(() => {
    if (!(openAddLease || openAddUnit || openEditUnits || openEditProperty)) return;

    const next = new URLSearchParams(location.search);
    next.delete("openAddLease");
    next.delete("openAddUnit");
    next.delete("openEditUnits");
    next.delete("openEditProperty");

    navigate(
      { pathname: location.pathname, search: next.toString() },
      { replace: true }
    );
  }, [
    openAddLease,
    openAddUnit,
    openEditUnits,
    openEditProperty,
    location.pathname,
    location.search,
    navigate,
  ]);

  useEffect(() => {
    if (panel !== "actionRequests") return;
    const el = document.getElementById("action-requests-panel");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [panel]);

  const loadProperties = useCallback(async () => {
    try {
      setIsLoadingProperties(true);
      const res = await fetchProperties();
      const raw = res ?? null;
      const normalized = arr(raw?.items ?? raw?.properties ?? (raw as any)).filter(
        (p) => p && p.id
      );
      setProperties(normalized);
    } catch (err) {
      console.error("[PropertiesPage] Failed to fetch properties", err);
      setProperties([]);
    } finally {
      setIsLoadingProperties(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((m) => {
        if (cancelled) return;
        setMe(m);
      })
      .catch(() => {
        if (cancelled) return;
        setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAccountLimits()
      .then((lim) => {
        if (cancelled) return;
        setLimits(lim);
      })
      .catch(() => {
        if (cancelled) return;
        setLimits(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoadingProperties) return;
    if (!properties || properties.length === 0) {
      setActionCounts({});
      return;
    }

    const ids = properties.map((p) => p.id).filter(Boolean);
    let alive = true;
    const t = window.setTimeout(() => {
      fetchActionRequestCounts(ids)
        .then((res) => {
          if (!alive) return;
          setActionCounts(res.counts || {});
        })
        .catch(() => {
          if (!alive) return;
          setActionCounts({});
        });
    }, 150);

    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [isLoadingProperties, properties]);

  const safeProperties = useMemo(
    () => arr<any>(properties).filter((p) => p && p.id),
    [properties]
  );

  useEffect(() => {
    if (safeProperties.length === 0) return;

    if (
      propertyIdFromUrl &&
      safeProperties.some((p) => String(p.id) === String(propertyIdFromUrl))
    ) {
      setSelectedPropertyId(propertyIdFromUrl);
      return;
    }

    if (!selectedPropertyId) {
      setSelectedPropertyId(safeProperties[0].id);
      return;
    }

    if (!safeProperties.some((p) => String(p.id) === String(selectedPropertyId))) {
      setSelectedPropertyId(safeProperties[0].id);
    }
  }, [safeProperties, selectedPropertyId, propertyIdFromUrl]);

  const selectedProperty = useMemo(
    () =>
      safeProperties.find((p) => String(p.id) === String(selectedPropertyId)) ??
      null,
    [safeProperties, selectedPropertyId]
  );

  const fetchActionRequests = useCallback(
    async (propertyId: string, opts?: { openId?: string }) => {
      try {
        setActionRequestsLoading(true);
        setActionRequestsError(null);
        const items = await listActionRequests({
          propertyId,
          status: actionFilter === "all" ? undefined : actionFilter,
        });
        setActionRequests(asArray(items));
        const openId = opts?.openId;
        if (openId) {
          const match = items.find((r) => r.id === openId);
          if (match) {
            setActiveRequest(match);
            setNote(match.resolutionNote || "");
            setModalOpen(true);
            setActionRequestUpdateError(null);
          }
        }
      } catch (err: any) {
        setActionRequestsError(err?.message || "Failed to load action requests");
      } finally {
        setActionRequestsLoading(false);
      }
    },
    [actionFilter]
  );

  useEffect(() => {
    const propertyId = selectedProperty?.id;
    if (!propertyId) {
      setActionRequests([]);
      setActiveRequest(null);
      return;
    }
    void fetchActionRequests(propertyId, { openId: deepLinkId });
  }, [selectedProperty?.id, actionFilter, deepLinkId, fetchActionRequests]);

  const handlePropertyCreated = (property: Property) => {
    if (property?.id) {
      setProperties((prev) => [...prev, property]);
      setSelectedPropertyId(property.id);
      const next = new URLSearchParams(location.search);
      next.set("propertyId", property.id);
      // Onboarding: immediately guide to add units after creating a property
      next.set("openAddUnit", "1");
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
      return;
    }
    // fallback: do not mutate state if invalid property
  };

  const handleSelectProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const next = new URLSearchParams(location.search);
    next.set("propertyId", propertyId);
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
  };

  const handleManualUnitsComplete = async () => {
    try {
      await setOnboardingStep("addUnits", true);
    } catch {
      // ignore
    }
    showToast({
      title: "Portfolio ready  dashboard is live.",
      variant: "success",
    });
    navigate("/dashboard?onboarding=ready", { replace: true });
  };

  const handleSaveUnits = async () => {
    if (!activePropertyId) return;
    const clean = draftUnits
      .map((u) => ({
        ...u,
        unitNumber: u.unitNumber.trim(),
        beds: Number(u.beds),
        baths: Number(u.baths),
        sqft: Number(u.sqft),
        marketRent: Number(u.marketRent),
      }))
      .filter((u) => u.unitNumber.length > 0);

    if (clean.length === 0) {
      showToast({ title: "Add at least one unit", variant: "warning" });
      return;
    }

    setSavingUnits(true);
    try {
      await addUnitsManual(activePropertyId, clean);
      // Update local state so the units panel renders immediately
      setProperties((prev) =>
        prev.map((p) =>
          String(p.id) === String(activePropertyId)
            ? {
                ...p,
                units: clean as any,
                unitCount: clean.length,
              }
            : p
        )
      );
      await setOnboardingStep("addUnits", true).catch(() => {});
      showToast({
        title: "Portfolio ready  dashboard is live.",
        variant: "success",
      });
      setIsUnitsModalOpen(false);
      navigate("/dashboard?onboarding=ready", { replace: true });
    } catch (e: any) {
      showToast({
        title: "Failed to save units",
        description: e?.message ?? "Could not save units",
        variant: "error",
      });
    } finally {
      setSavingUnits(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setActiveRequest(null);
    setActionRequestUpdateError(null);
  };

  const handleAcknowledgeRequest = async () => {
    if (!activeRequest || !selectedProperty?.id) return;
    try {
      setActionRequestUpdating(true);
      setActionRequestUpdateError(null);
      const updated = await acknowledgeActionRequest(activeRequest.id, note || undefined);
      setActionRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      setActiveRequest(updated);
      await fetchActionRequests(selectedProperty.id, { openId: updated.id });
    } catch (err: any) {
      setActionRequestUpdateError(err?.message || "Failed to acknowledge request");
    } finally {
      setActionRequestUpdating(false);
    }
  };

  const handleResolveRequest = async () => {
    if (!activeRequest || !selectedProperty?.id) return;
    try {
      setActionRequestUpdating(true);
      setActionRequestUpdateError(null);
      const updated = await resolveActionRequest(activeRequest.id, note || undefined);
      setActionRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      setActiveRequest(updated);
      setModalOpen(false);
      setNote(updated.resolutionNote || "");
      await fetchActionRequests(selectedProperty.id);
    } catch (err: any) {
      setActionRequestUpdateError(err?.message || "Failed to resolve request");
    } finally {
      setActionRequestUpdating(false);
    }
  };

  const refreshActionCounts = async () => {
    if (!properties || properties.length === 0) return;
    const ids = properties.map((p) => p.id).filter(Boolean);
    try {
      const res = await fetchActionRequestCounts(ids);
      setActionCounts(res.counts || {});
    } catch {
      // ignore
    }
  };

  return (
    <MacShell title="RentChain Properties">
      <div
        className="page-content"
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>Properties</div>
          {limits ? (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.35)",
                fontSize: 12,
                fontWeight: 700,
                color: text.muted,
                display: "inline-flex",
                gap: 8,
                alignItems: "center",
              }}
              title={`Plan ${plan} - Properties ${currentProperties}/${maxProperties} - Units ${unitsUsed}/${maxUnits}`}
            >
              <span style={{ fontWeight: 800, color: text.primary }}>
                {plan}
              </span>
              <span>
                Props: {currentProperties}/{planLimits.maxProperties}
              </span>
              <span>
                Units: {unitsUsed}/{planLimits.maxUnits}
              </span>
            </div>
          ) : null}

          {selectedPropertyId ? (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(location.search);
                next.set("panel", "actionRequests");
                navigate(
                  { pathname: location.pathname, search: next.toString() },
                  { replace: true }
                );

                const el = document.getElementById("action-requests-panel");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border:
                  actionReqCount > 0
                    ? "1px solid rgba(239,68,68,0.45)"
                    : "1px solid rgba(148,163,184,0.35)",
                fontSize: 12,
                fontWeight: 600,
                background:
                  actionReqCount > 0
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(148,163,184,0.1)",
                color: actionReqCount > 0 ? "#dc2626" : text.muted,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              title={
                actionReqCount > 0
                  ? "Open action requests"
                  : "No open action requests"
              }
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: actionReqCount > 0 ? "#dc2626" : "rgba(148,163,184,0.7)",
                  display: "inline-block",
                }}
              />
              Action Required ({actionReqCount})
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setActionCenterOpen(true)}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 850,
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            title="Open Action Center"
          >
            Action Center
            {totalOpenAcrossPortfolio > 0 ? (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(239,68,68,0.45)",
                  background: "rgba(239,68,68,0.12)",
                  color: "#dc2626",
                  fontWeight: 800,
                  fontSize: 11,
                }}
              >
                {totalOpenAcrossPortfolio}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={async () => {
              const snap = await fetchMonthlyOpsSnapshot();

              const rows = Object.entries(snap.properties).map(([propertyId, data]) => {
                const label = propertyLabelById?.[propertyId];
                return {
                  propertyName: label?.name || propertyId,
                  propertyAddress: label?.subtitle || "",
                  openRequests: data.openCount,
                  highSeverity: data.highSeverity,
                  oldestOpenDays: data.oldestDays ?? "",
                };
              });

              const header = [
                "propertyName",
                "propertyAddress",
                "openRequests",
                "highSeverity",
                "oldestOpenDays",
              ];

              const csv = [
                header.join(","),
                ...rows.map((r) => header.map((h) => `"${String((r as any)[h] ?? "")}"`).join(",")),
              ].join("\n");

              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);

              const a = document.createElement("a");
              a.href = url;
              a.download = `rentchain-monthly-ops-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();

              URL.revokeObjectURL(url);
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 12,
            }}
            title="Download board-ready monthly operations snapshot"
          >
            Monthly Ops Snapshot
          </button>
        </div>

        <Card elevated>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
            Add a new property
          </h1>
          <p
            style={{
              marginTop: 6,
              marginBottom: 14,
              color: text.muted,
              fontSize: "0.95rem",
            }}
          >
            Capture units, rents, and amenities. Newly added properties will show
            up in your list and rent roll below.
          </p>
          {!limitsReady ? (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                background: "rgba(2,6,23,0.03)",
                border: `1px solid ${colors.border}`,
                color: text.muted,
              }}
            >
              Loading plan limits...
            </div>
          ) : canAddProperty ? (
            <AddPropertyForm onCreated={handlePropertyCreated} maxUnits={maxUnits} plan={plan} />
          ) : (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                background: "rgba(2,6,23,0.03)",
                border: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                Upgrade to add more properties
              </div>
              <div style={{ color: text.muted, marginBottom: 12 }}>
                Your current plan allows up to {maxProperties} property
                {maxProperties === 1 ? "" : "ies"}. Upgrade to continue.
              </div>
              <Button
                onClick={() =>
                  (openUpgrade as any)({
                    reason: "propertiesMax",
                    plan,
                    cap: maxProperties,
                    resource: "properties",
                  })
                }
              >
                Upgrade plan
              </Button>
            </div>
          )}
        </Card>

        <Card
          elevated
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 2fr)",
            gap: spacing.lg,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontWeight: 600, color: "#ffffffff" }}>
                Your Properties
              </div>
              <div style={{ color: text.muted, fontSize: 12 }}>
                {properties.length} total
              </div>
            </div>

            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radius.lg,
                background: colors.panel,
                padding: spacing.sm,
                maxHeight: 520,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: spacing.xs,
              }}
            >
              {isLoadingProperties && (
                <Card style={{ padding: spacing.sm, margin: 0 }}>
                  <div style={{ color: text.muted, fontSize: 13 }}>
                    Loading properties
                  </div>
                </Card>
              )}
              {!isLoadingProperties && properties.length === 0 && (
                <Card style={{ padding: spacing.sm, margin: 0 }}>
                  <div style={{ color: text.muted, fontSize: 13 }}>
                    No properties yet. Add your first property above.
                  </div>
                </Card>
              )}
              {!isLoadingProperties && properties.length > 0 && (
                (properties ?? [])
                  .filter(Boolean)
                  .map((p: any) => {
                    const id = String(p?.id ?? "");
                    if (!id) return null;
                    const unitCount = num(
                      p?.unitCount ??
                        p?.totalUnits ??
                        (Array.isArray(p?.units) ? p.units.length : 0),
                      0
                    );
                  const occupiedCount =
                    p?.occupiedCount ??
                    (p?.units
                      ? p.units.filter((u: any) => u?.status === "occupied").length
                      : 0);
                  const occupancyPct =
                    unitCount > 0
                      ? Math.round((occupiedCount / unitCount) * 100)
                      : 0;
                    const isActive = id === String(selectedPropertyId);
                    const openCount = actionCounts[id] || 0;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectProperty(id)}
                      style={{
                        textAlign: "left",
                        borderRadius: radius.md,
                        padding: "10px 12px",
                        border: isActive
                          ? `1px solid ${colors.accent}`
                          : `1px solid ${colors.border}`,
                        background: isActive
                          ? "rgba(96,165,250,0.12)"
                          : colors.card,
                        color: text.primary,
                        cursor: "pointer",
                        transition: "border-color 0.15s ease, background 0.15s ease",
                        boxShadow: isActive ? shadows.sm : "none",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{p.name || p.addressLine1}</div>
                      <div style={{ color: text.muted, fontSize: 12 }}>
                        {p.addressLine1}
                        {p.city ? `, ${p.city}` : ""}
                      </div>
                      <div
                        style={{ color: text.muted, fontSize: 12, marginTop: 4 }}
                      >
                        Units: {unitCount}  Occupancy: {occupancyPct}%
                        <span
                          style={{
                            marginLeft: 8,
                            padding: "2px 8px",
                            borderRadius: radius.pill,
                            border: `1px solid ${colors.border}`,
                            color: p.status === "draft" ? "#f59e0b" : "#22c55e",
                            background:
                              p.status === "draft"
                                ? "rgba(245,158,11,0.1)"
                                : "rgba(34,197,94,0.12)",
                            fontSize: 11,
                          }}
                        >
                          {p.status === "draft" ? "Draft" : "Active"}
                        </span>
                        {openCount > 0 ? (
                          <span
                            style={{
                              marginLeft: 8,
                              padding: "2px 8px",
                              borderRadius: radius.pill,
                              border: "1px solid rgba(239,68,68,0.45)",
                              color: "#dc2626",
                              background: "rgba(239,68,68,0.12)",
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                            title="Open action requests"
                          >
                            Action Required ({openCount})
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              className="mac-card-soft"
              style={{
                background: colors.panel,
                borderRadius: radius.lg,
                border: `1px solid ${colors.border}`,
                boxShadow: shadows.sm,
              }}
            >
              {openAddLease ? (
                <div
                  style={{
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    border: `1px dashed ${colors.border}`,
                    marginBottom: spacing.sm,
                  }}
                >
                  <strong>Add Lease (stub)</strong>  wire this to your Add Lease flow.
                </div>
              ) : null}
              {openAddUnit ? (
                <div
                  style={{
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    border: `1px dashed ${colors.border}`,
                    marginBottom: spacing.sm,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <strong>Add Unit</strong>  create units manually.
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!selectedPropertyId) return;
                        setActivePropertyId(selectedPropertyId);
                        setDraftUnits([
                          { unitNumber: "", beds: 1, baths: 1, sqft: 500, marketRent: 1500, status: "vacant" },
                        ]);
                        setIsUnitsModalOpen(true);
                      }}
                    >
                      Add units
                    </Button>
                  </div>
                </div>
              ) : null}
              {openEditUnits ? (
                <div
                  style={{
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    border: `1px dashed ${colors.border}`,
                    marginBottom: spacing.sm,
                  }}
                >
                  <strong>Edit Units (stub)</strong>  wire this to your Units edit flow.
                </div>
              ) : null}
              {openEditProperty ? (
                <div
                  style={{
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    border: `1px dashed ${colors.border}`,
                    marginBottom: spacing.sm,
                  }}
                >
                  <strong>Edit Property (stub)</strong>  wire this to your Edit Property flow.
                </div>
              ) : null}

              <PropertyDetailPanel property={selectedProperty} onRefresh={loadProperties} />
            </div>
            <div
              className="mac-card-soft"
              style={{
                background: colors.panel,
                borderRadius: radius.lg,
                border: `1px solid ${colors.border}`,
                boxShadow: shadows.sm,
              }}
            >
              {selectedProperty ? (
                <PropertyActivityPanel
                  key={selectedProperty.id}
                  propertyId={selectedProperty.id}
                />
              ) : (
                <Card style={{ padding: spacing.md, margin: 0 }}>
                  <div style={{ color: text.muted, fontSize: "0.95rem" }}>
                    Select a property to view recent activity.
                  </div>
                </Card>
              )}
            </div>
            {selectedProperty ? (
              <div
                className="mac-card-soft"
                id="action-requests-panel"
                style={{
                  background: colors.panel,
                  borderRadius: radius.lg,
                  border: `1px solid ${colors.border}`,
                  boxShadow: shadows.sm,
                }}
              >
                <ActionRequestsPanel
                  propertyId={selectedProperty.id}
                  onCountChange={setActionReqCount}
                  onAfterRecompute={refreshActionCounts}
                />
              </div>
            ) : null}
            <Section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>Action Requests</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["all", "new", "acknowledged", "resolved"].map((status) => (
                    <Button
                      key={status}
                      variant={actionFilter === status ? "primary" : "ghost"}
                      onClick={() =>
                        setActionFilter(
                          status as ActionRequestStatus | "all"
                        )
                      }
                      style={{ padding: "4px 10px", fontSize: 12 }}
                    >
                      {status === "all"
                        ? "All"
                        : status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
              {actionRequestsLoading ? (
                <div style={{ color: text.muted, fontSize: 13 }}>
                  Loading requests
                </div>
              ) : actionRequestsError ? (
                <div style={{ color: colors.danger, fontSize: 13 }}>
                  {actionRequestsError}
                </div>
              ) : actionRequests.length === 0 ? (
                <div style={{ color: text.muted, fontSize: 13 }}>
                  No action requests for this property.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {actionRequests.map((req) => (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => {
                        setActiveRequest(req);
                        setModalOpen(true);
                        setNote(req.resolutionNote || "");
                        setActionRequestUpdateError(null);
                      }}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: radius.md,
                        padding: "8px 10px",
                        background: colors.card,
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {req.issueType}  {req.location}
                        </div>
                        <div style={{ fontSize: 12, color: text.muted }}>
                          {safeLocaleDate(req.reportedAt)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: radius.pill,
                            border: `1px solid ${colors.border}`,
                            color:
                              req.severity === "urgent"
                                ? colors.danger
                                : req.severity === "medium"
                                ? "#f59e0b"
                                : "#22c55e",
                            fontSize: 11,
                          }}
                        >
                          {req.severity}
                        </span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: radius.pill,
                            border: `1px solid ${colors.border}`,
                            fontSize: 11,
                            color:
                              req.status === "resolved"
                                ? "#22c55e"
                                : req.status === "acknowledged"
                                ? "#f59e0b"
                                : text.primary,
                          }}
                        >
                          {req.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </Card>
      </div>
      <ActionRequestModal
        request={activeRequest}
        open={modalOpen}
        onClose={handleCloseModal}
        onAcknowledge={handleAcknowledgeRequest}
        onResolve={handleResolveRequest}
        note={note}
        setNote={setNote}
        updating={actionRequestUpdating}
        error={actionRequestUpdateError}
      />
      <ActionCenterDrawer
        open={actionCenterOpen}
        onClose={() => setActionCenterOpen(false)}
        propertyLabelById={propertyLabelById}
      />
      <UnitsModal
        open={isUnitsModalOpen}
        onClose={() => setIsUnitsModalOpen(false)}
        units={draftUnits}
        setUnits={setDraftUnits}
        onSave={handleSaveUnits}
        saving={savingUnits}
      />
    </MacShell>
  );
};

interface ActionRequestModalProps {
  request: PropertyActionRequest | null;
  open: boolean;
  onClose: () => void;
  onAcknowledge: () => Promise<void>;
  onResolve: () => Promise<void>;
  note: string;
  setNote: (v: string) => void;
  updating: boolean;
  error: string | null;
}

const ActionRequestModal: React.FC<ActionRequestModalProps> = ({
  request,
  open,
  onClose,
  onAcknowledge,
  onResolve,
  note,
  setNote,
  updating,
  error,
}) => {
  if (!open || !request) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <Card
        style={{
          width: "min(520px, 95vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: spacing.md,
          borderRadius: radius.lg,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.sm,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
            Action Request
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 600 }}>
            {request.issueType}  {request.location}
          </div>
          <div style={{ color: text.muted, fontSize: 13 }}>
            Severity: {request.severity}  Status: {request.status}
          </div>
          <div style={{ whiteSpace: "pre-wrap", color: text.primary }}>
            {request.description}
          </div>
          <div style={{ color: text.muted, fontSize: 12 }}>
            Reported: {safeLocaleDate(request.reportedAt)}
          </div>
          {request.acknowledgedAt && (
            <div style={{ color: text.muted, fontSize: 12 }}>
              Acknowledged: {safeLocaleDate(request.acknowledgedAt)}
            </div>
          )}
          {request.resolvedAt && (
            <div style={{ color: text.muted, fontSize: 12 }}>
              Resolved: {safeLocaleDate(request.resolvedAt)}
            </div>
          )}
          <div>
            <div style={{ fontSize: 12, color: text.subtle, marginBottom: 4 }}>
              Note (optional)
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: text.primary,
                padding: 8,
              }}
            />
          </div>
          {error && (
            <div style={{ color: colors.danger, fontSize: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="secondary"
              onClick={onAcknowledge}
              disabled={updating}
            >
              Acknowledge
            </Button>
            <Button
              variant="primary"
              onClick={onResolve}
              disabled={updating}
            >
              Resolve
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const UnitsModal = ({
  open,
  onClose,
  units,
  setUnits,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  units: UnitInput[];
  setUnits: (u: UnitInput[]) => void;
  onSave: () => void;
  saving: boolean;
}) => {
  if (!open) return null;

  const updateUnit = (idx: number, field: keyof UnitInput, value: any) => {
    setUnits(
      units.map((u, i) =>
        i === idx
          ? {
              ...u,
              [field]: field === "unitNumber" ? String(value) : Number(value),
            }
          : u
      )
    );
  };

  const addRow = () =>
    setUnits([
      ...units,
      { unitNumber: "", beds: 1, baths: 1, sqft: 500, marketRent: 1500, status: "vacant" },
    ]);
  const removeRow = (idx: number) =>
    setUnits(units.length <= 1 ? units : units.filter((_, i) => i !== idx));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(900px, 96vw)",
          background: "white",
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(148,163,184,0.35)",
          boxShadow: "0 25px 60px rgba(15,23,42,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>Add Units</div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid rgba(148,163,184,0.35)",
              background: "transparent",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Unit #", "Beds", "Baths", "Sqft", "Market Rent", "Status", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px",
                      borderBottom: "1px solid rgba(148,163,184,0.35)",
                      fontSize: 12,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u, idx) => (
                <tr key={idx}>
                  <td style={{ padding: "6px" }}>
                    <input
                      value={u.unitNumber}
                      onChange={(e) => updateUnit(idx, "unitNumber", e.target.value)}
                      style={{ width: "100%", padding: 6 }}
                    />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <input
                      type="number"
                      value={u.beds}
                      onChange={(e) => updateUnit(idx, "beds", e.target.value)}
                      style={{ width: "100%", padding: 6 }}
                    />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <input
                      type="number"
                      value={u.baths}
                      onChange={(e) => updateUnit(idx, "baths", e.target.value)}
                      style={{ width: "100%", padding: 6 }}
                    />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <input
                      type="number"
                      value={u.sqft}
                      onChange={(e) => updateUnit(idx, "sqft", e.target.value)}
                      style={{ width: "100%", padding: 6 }}
                    />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <input
                      type="number"
                      value={u.marketRent}
                      onChange={(e) => updateUnit(idx, "marketRent", e.target.value)}
                      style={{ width: "100%", padding: 6 }}
                    />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <select
                      value={u.status ?? "vacant"}
                      onChange={(e) => updateUnit(idx, "status", e.target.value)}
                      style={{ width: "100%", padding: 6 }}
                    >
                      <option value="vacant">Vacant</option>
                      <option value="occupied">Occupied</option>
                    </select>
                  </td>
                  <td style={{ padding: "6px" }}>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(148,163,184,0.35)",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button
            type="button"
            onClick={addRow}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            + Add row
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.35)",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(59,130,246,0.45)",
                background: "rgba(59,130,246,0.12)",
                color: "#2563eb",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving" : "Save units"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPage;










