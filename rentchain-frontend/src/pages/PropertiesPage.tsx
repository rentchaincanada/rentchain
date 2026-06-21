// @ts-nocheck
// src/pages/PropertiesPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MacShell } from "../components/layout/MacShell";
import { AddPropertyForm } from "../components/properties/AddPropertyForm";
import { fetchProperties, Property } from "../api/propertiesApi";
import { PropertyActivityPanel } from "../components/property/PropertyActivityPanel";
import { PropertyDetailPanel } from "../components/properties/PropertyDetailPanel";
import { spacing, radius, shadows, colors, text } from "../styles/tokens";
import { safeLocaleDate } from "../utils/format";
import { Card, Section, Button, EmptyState, InlineError, SkeletonBlock } from "../components/ui/Ui";
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
import { arr, str } from "@/utils/safe";
import { setOnboardingStep } from "../api/onboardingApi";
import {
  addUnitsManual,
  patchCreatedUnitOccupancyMetadata,
  type AddUnitsManualResponse,
  type UnitInput,
  type UnitRecord,
} from "../api/unitsApi";
import { useToast } from "../components/ui/ToastProvider";
import { unitsForProperty } from "../lib/propertyCounts";
import { PropertySelector } from "../components/properties/PropertySelector";
import { LeasePackGeneratorModal } from "../components/leases/LeasePackGeneratorModal";
import "../styles/propertiesMobile.css";
import "./PropertiesPage.css";
import { track } from "../lib/analytics";
import { resolveReturnToParam } from "../lib/propertyGate";
import { useCapabilities } from "../hooks/useCapabilities";
import { deriveUnitOccupancyFromLeases } from "../lib/leases/leaseLifecycle";
import { printSummaryDocument } from "../utils/printSummary";
import { UpgradeCTA } from "../components/billing/UpgradeCTA";
import { FREE_TIER_UPGRADE_GUIDANCE } from "../constants/tiers";

function isPersistedUnitIdValue(value: any) {
  const id = String(value || "").trim();
  return Boolean(id) && !/^placeholder-/i.test(id);
}

function resolveCreatedUnits(response: AddUnitsManualResponse | undefined, requestedUnits: UnitInput[]): UnitRecord[] {
  const returnedUnits = Array.isArray(response?.units)
    ? response?.units
    : Array.isArray(response?.items)
      ? response?.items
      : [];
  if (!returnedUnits || returnedUnits.length < requestedUnits.length) {
    const err = new Error("Saved units were not returned with stable IDs. Please try again.");
    (err as any).code = "UNIT_ID_UNRESOLVED";
    throw err;
  }

  return requestedUnits.map((requestedUnit, index) => {
    const returnedUnit = returnedUnits[index] as UnitRecord | undefined;
    const id = String(returnedUnit?.id || returnedUnit?.unitId || returnedUnit?.uid || "").trim();
    if (!isPersistedUnitIdValue(id)) {
      const err = new Error("Saved units were not returned with stable IDs. Please try again.");
      (err as any).code = "UNIT_ID_UNRESOLVED";
      throw err;
    }
    const requestedOccupantName = String(requestedUnit.occupantName || requestedUnit.tenantName || "").trim();
    const returnedOccupantName = String(returnedUnit?.occupantName || returnedUnit?.tenantName || "").trim();
    const requestedLeaseEndDate = String(requestedUnit.leaseEndDate || "").trim();
    const returnedLeaseEndDate = String(returnedUnit?.leaseEndDate || "").trim();
    const mergedUnit = {
      ...requestedUnit,
      ...returnedUnit,
      id,
      unitNumber: String(returnedUnit?.unitNumber || requestedUnit.unitNumber || "").trim(),
    };
    if (!returnedOccupantName && requestedOccupantName) {
      mergedUnit.occupantName = requestedOccupantName;
      mergedUnit.tenantName = requestedOccupantName;
    }
    if (!returnedLeaseEndDate && requestedLeaseEndDate) {
      mergedUnit.leaseEndDate = requestedLeaseEndDate;
    }
    return mergedUnit;
  });
}

function mergePersistedUnits(existingUnits: any[] | undefined, persistedUnits: UnitRecord[]) {
  const byId = new Map<string, any>();
  const ordered: any[] = [];
  for (const unit of Array.isArray(existingUnits) ? existingUnits : []) {
    const key = String(unit?.id || unit?.unitId || unit?.uid || unit?.unitNumber || "").trim();
    if (!key || /^placeholder-/i.test(key)) continue;
    byId.set(key, unit);
    ordered.push(unit);
  }
  for (const unit of persistedUnits) {
    const key = String(unit?.id || unit?.unitId || unit?.uid || unit?.unitNumber || "").trim();
    if (!key) continue;
    if (byId.has(key)) {
      const index = ordered.findIndex((item) => String(item?.id || item?.unitId || item?.uid || item?.unitNumber || "").trim() === key);
      const merged = { ...byId.get(key), ...unit };
      byId.set(key, merged);
      if (index >= 0) ordered[index] = merged;
      continue;
    }
    byId.set(key, unit);
    ordered.push(unit);
  }
  return ordered;
}

function unitSaveErrorMessage(error: any) {
  const code = String(error?.code || error?.error || error?.message || "");
  if (code === "UNIT_ID_UNRESOLVED" || code === "UNIT_PERSISTENCE_FAILED") {
    return "Units could not be saved with stable IDs. Keep this form open and try again.";
  }
  return error?.message ?? "Could not save units";
}

function normalizeUnitDraftsForSubmit(units: UnitInput[]) {
  const invalidPlaceholder = units.some((u: any) =>
    [u?.id, u?.unitId, u?.uid].some((value) => String(value || "").trim().toLowerCase().startsWith("placeholder-"))
  );
  if (invalidPlaceholder) {
    return {
      units: [],
      error: "This unit form still has temporary IDs. Close and reopen the form before saving.",
    };
  }

  const normalized = units
    .map((u) => {
      const status = u.status === "occupied" ? "occupied" : "vacant";
      const occupantName = status === "occupied" ? String(u.occupantName || u.tenantName || "").trim() || null : null;
      const leaseEndDate = status === "occupied" ? String(u.leaseEndDate || "").trim() || null : null;
      const unit: UnitInput = {
        unitNumber: String(u.unitNumber || "").trim(),
        beds: Number(u.beds),
        baths: Number(u.baths),
        sqft: Number(u.sqft),
        marketRent: Number(u.marketRent),
        status,
        occupantName,
        tenantName: occupantName,
        leaseEndDate,
      };
      return unit;
    })
    .filter((u) => u.unitNumber.length > 0);

  if (normalized.length === 0) {
    return { units: [], error: "Add at least one unit number before saving." };
  }

  const invalidNumbers = normalized.some(
    (u) =>
      !Number.isFinite(u.beds) ||
      !Number.isFinite(u.baths) ||
      !Number.isFinite(u.sqft) ||
      !Number.isFinite(u.marketRent)
  );
  if (invalidNumbers) {
    return { units: [], error: "Enter valid beds, baths, square footage, and rent before saving." };
  }

  return { units: normalized, error: null };
}

const PropertiesPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyView, setPropertyView] = useState<"active" | "archived">("active");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null
  );
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [actionReqCount, setActionReqCount] = useState(0);
  const [actionRequests, setActionRequests] = useState<PropertyActionRequest[]>([]);
  const [actionRequestsLoading, setActionRequestsLoading] = useState(false);
  const addPropertyRef = useRef<HTMLDivElement | null>(null);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [actionRequestsError, setActionRequestsError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<ActionRequestStatus | "all">("all");
  const [activeRequest, setActiveRequest] = useState<PropertyActionRequest | null>(null);
  const [note, setNote] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [recentlyCreatedPropertyId, setRecentlyCreatedPropertyId] = useState<string | null>(null);
  const [recentlyCreatedPropertyName, setRecentlyCreatedPropertyName] = useState<string | null>(null);
  const [draftUnits, setDraftUnits] = useState<UnitInput[]>([
    { unitNumber: "", beds: 1, baths: 1, sqft: 500, marketRent: 1500, status: "vacant" },
  ]);
  const [savingUnits, setSavingUnits] = useState(false);
  const [unitModalError, setUnitModalError] = useState<string | null>(null);
  const [unitModalSource, setUnitModalSource] = useState<"guided" | "propertyTable">("guided");
  const [actionRequestUpdating, setActionRequestUpdating] = useState(false);
  const [actionRequestUpdateError, setActionRequestUpdateError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [actionCounts, setActionCounts] = useState<Record<string, number>>({});
  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  const [leasePackOpen, setLeasePackOpen] = useState(false);
  const [leasePackInitialPropertyId, setLeasePackInitialPropertyId] = useState<string | null>(null);
  const { showToast } = useToast();
  const { caps, features } = useCapabilities();
  const currentProperties = properties?.length ?? 0;
  const currentPlan = String(caps?.plan || "free").toLowerCase();
  const canInviteTenant = Boolean(features?.tenant_invites || features?.tenantInvites);
  const archiveHelpCopy =
    propertyView === "archived"
      ? "Archived properties are hidden from active portfolio views but preserved for records and history."
      : "Archive sold or paused properties to keep your active portfolio clean without deleting history.";
  const unitsUsed = useMemo(
    () => (properties || []).reduce((sum, p) => sum + unitsForProperty(p), 0),
    [properties]
  );
  const totalOpenAcrossPortfolio = useMemo(() => Object.values(actionCounts || {}).reduce((a, b) => a + (b || 0), 0), [
    actionCounts,
  ]);

  const openAddPropertyForm = useCallback(() => {
    setIsAddPropertyOpen(true);
    window.requestAnimationFrame(() => {
      const scrollIntoView = addPropertyRef.current?.scrollIntoView;
      if (typeof scrollIntoView === "function") {
        scrollIntoView.call(addPropertyRef.current, { behavior: "smooth", block: "start" });
      }
    });
  }, []);

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
  const unitIdFromUrl = params.get("unitId") || "";
  const openAddLease = params.get("openAddLease") === "1";
  const openAddUnit = params.get("openAddUnit") === "1";
  const openEditUnits = params.get("openEditUnits") === "1";
  const openEditProperty = params.get("openEditProperty") === "1";
  const openSendApplication = params.get("openSendApplication") === "1";
  const openLeasePack = params.get("openLeasePack") === "1";
  const deepLinkId = params.get("actionRequestId") || undefined;
  const panel = params.get("panel") || "";
  const upgradeConfirmed = params.get("upgradeConfirmed") === "1";

  useEffect(() => {
    if (!(openAddLease || openAddUnit || openEditUnits || openEditProperty || openSendApplication || openLeasePack)) return;

    const next = new URLSearchParams(location.search);
    next.delete("openAddLease");
    next.delete("openAddUnit");
    next.delete("openEditUnits");
    next.delete("openEditProperty");
    next.delete("openSendApplication");
    next.delete("openLeasePack");

    navigate(
      { pathname: location.pathname, search: next.toString() },
      { replace: true }
    );
  }, [
    openAddLease,
    openAddUnit,
    openEditUnits,
    openEditProperty,
    openSendApplication,
    openLeasePack,
    location.pathname,
    location.search,
    navigate,
  ]);

  useEffect(() => {
    if (!openLeasePack) return;
    setLeasePackInitialPropertyId(selectedPropertyId || null);
    setLeasePackOpen(true);
  }, [openLeasePack, selectedPropertyId]);

  useEffect(() => {
    if (panel !== "actionRequests") return;
    const el = document.getElementById("action-requests-panel");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [panel]);

  useEffect(() => {
    if (params.get("focus") !== "addProperty") return;
    addPropertyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [params]);

  const loadProperties = useCallback(async () => {
    try {
      setIsLoadingProperties(true);
      const res = await fetchProperties({ status: propertyView });
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
  }, [propertyView]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  // no plan limits fetch; starter supports unlimited properties/units

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
      setIsAddPropertyOpen(false);
      setProperties((prev) => [...prev, property]);
      setSelectedPropertyId(property.id);
      setRecentlyCreatedPropertyId(property.id);
      setRecentlyCreatedPropertyName(
        String(property.name || property.addressLine1 || "your first property")
      );
      const next = new URLSearchParams(location.search);
      const returnTo = resolveReturnToParam(next.get("returnTo"));
      if (returnTo) {
        navigate(returnTo, { replace: true });
        return;
      }
      next.set("propertyId", property.id);
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

  const handleSaveUnits = async (unitsOverride?: UnitInput[]) => {
    if (!activePropertyId) return;
    const { units: clean, error } = normalizeUnitDraftsForSubmit(unitsOverride || draftUnits);
    const source = unitModalSource;

    if (error) {
      setUnitModalError(error);
      return;
    }

    setSavingUnits(true);
    setUnitModalError(null);
    try {
      const response = await addUnitsManual(activePropertyId, clean);
      const persistedUnits = await patchCreatedUnitOccupancyMetadata(resolveCreatedUnits(response, clean), clean);
      track("activation_unit_created", {
        surface: "properties_page",
        source: "manual_units_modal",
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      await loadProperties();
      setProperties((prev) =>
        prev.map((p) => {
          if (String(p.id) !== String(activePropertyId)) return p;
          const mergedUnits = mergePersistedUnits((p as any).units, persistedUnits);
          return {
            ...p,
            units: mergedUnits as any,
            unitCount: mergedUnits.length,
            unitsCount: mergedUnits.length,
          };
        })
      );
      await Promise.resolve(setOnboardingStep("unitAdded", true)).catch(() => {});
      showToast({
        message: persistedUnits.length === 1 ? "Unit saved" : "Units saved successfully",
        variant: "success",
      });
      setUnitModalError(null);
      setIsUnitsModalOpen(false);
    } catch (e: any) {
      setUnitModalError(unitSaveErrorMessage(e));
      showToast({
        title: "Failed to save units",
        description: unitSaveErrorMessage(e),
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
    <MacShell title="RentChain Properties" showTopNav={false}>
      <div
        className="page-content"
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        <div className="rc-properties-header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="rc-properties-title-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>Properties</div>
            <Button
              type="button"
              onClick={openAddPropertyForm}
              style={{
                padding: "7px 12px",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              Add Property
            </Button>
            <div
              className="rc-properties-counts"
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
              title={`Properties ${currentProperties} - Units ${unitsUsed}`}
            >
            <span>
              Props: {currentProperties}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Units: {unitsUsed}
            </span>
            </div>
          </div>
          <div style={{ color: text.muted, fontSize: 13 }}>{archiveHelpCopy}</div>

          <div className="rc-properties-header-actions" style={{ display: "flex", gap: 8 }}>
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
        </div>

        <div ref={addPropertyRef}>
          {isAddPropertyOpen ? (
            <Card elevated>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
                    {properties.length === 0 ? "Start here: add your first property" : "Add a new property"}
                  </h1>
                  <p
                    style={{
                      marginTop: 6,
                      marginBottom: 14,
                      color: text.muted,
                      fontSize: "0.95rem",
                    }}
                  >
                    {properties.length === 0
                      ? "Start your rental workflow by adding one property. You only need the address, city, and total units to get moving."
                      : "Capture units, rents, and amenities. Newly added properties will show up in your list and rent roll below."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddPropertyOpen(false)}
                  style={{ whiteSpace: "nowrap" }}
                >
                  Hide form
                </Button>
              </div>
              <AddPropertyForm
                onCreated={handlePropertyCreated}
                onExistingPropertyId={(existingId) => {
                  setIsAddPropertyOpen(false);
                  setSelectedPropertyId(existingId);
                  const next = new URLSearchParams(location.search);
                  next.set("propertyId", existingId);
                  navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
                }}
              />
            </Card>
          ) : null}
        </div>

        <Card
          elevated
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing.lg,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant={propertyView === "active" ? "primary" : "ghost"}
              onClick={() => setPropertyView("active")}
            >
              Active properties
            </Button>
            <Button
              variant={propertyView === "archived" ? "primary" : "ghost"}
              onClick={() => setPropertyView("archived")}
            >
              Archived properties
            </Button>
          </div>

          <PropertySelector
            properties={safeProperties}
            selectedId={selectedPropertyId}
            onSelect={handleSelectProperty}
          />

          {currentPlan === "free" && safeProperties.length > 0 ? (
            <div
              style={{
                display: "grid",
                gap: 10,
                padding: 14,
                borderRadius: radius.lg,
                border: "1px solid rgba(14,165,233,0.26)",
                background: "rgba(240,249,255,0.94)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <div style={{ color: text.primary, fontSize: 16, fontWeight: 800 }}>
                    {FREE_TIER_UPGRADE_GUIDANCE.propertyOverview.title}
                  </div>
                  <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
                    {FREE_TIER_UPGRADE_GUIDANCE.propertyOverview.body}
                  </div>
                </div>
                <UpgradeCTA
                  featureKey="applications"
                  label={FREE_TIER_UPGRADE_GUIDANCE.propertyOverview.ctaLabel}
                  source="properties_free_tier_overview"
                  presentation="inline"
                  variant="secondary"
                  size="sm"
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {safeProperties.map((property) => (
                  <div
                    key={property.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                      padding: "8px 10px",
                      borderRadius: radius.md,
                      border: `1px solid ${colors.border}`,
                      background: colors.card,
                    }}
                  >
                    <div style={{ color: text.primary, fontSize: 13, fontWeight: 700, overflowWrap: "anywhere" }}>
                      {property.name || property.addressLine1 || "Property"}
                    </div>
                    <span
                      style={{
                        borderRadius: radius.pill,
                        border: "1px solid rgba(14,165,233,0.28)",
                        background: "rgba(14,165,233,0.1)",
                        color: "#0369a1",
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "3px 8px",
                      }}
                    >
                      {FREE_TIER_UPGRADE_GUIDANCE.freeLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isLoadingProperties ? (
            <SkeletonBlock lines={4} label="Loading properties" />
          ) : null}
          {!isLoadingProperties && properties.length === 0 ? (
            <div
              style={{
                display: "grid",
                gap: 10,
                padding: 16,
                borderRadius: radius.lg,
                border: "1px solid rgba(37,99,235,0.18)",
                background: "linear-gradient(180deg, rgba(239,246,255,0.9) 0%, rgba(255,255,255,0.98) 100%)",
              }}
            >
              <div style={{ color: text.primary, fontSize: 20, fontWeight: 800 }}>
                {propertyView === "archived" ? "No archived properties yet" : "Start your rental workflow"}
              </div>
              <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.6 }}>
                {propertyView === "archived"
                  ? "Archive a property from the active view to keep historical records without cluttering your portfolio."
                  : "Add your first property to begin managing tenants, leases, and maintenance in one place."}
              </div>
              {propertyView === "active" ? (
                <>
                  <div style={{ color: text.secondary, fontSize: 13, fontWeight: 600 }}>
                    Start here. Once your first property is set up, you can add a unit or invite a tenant next.
                  </div>
                  <Button
                    onClick={() => {
                      track("empty_state_cta_clicked", { pageKey: "properties", ctaKey: "add_property" });
                      openAddPropertyForm();
                    }}
                    style={{ width: "fit-content" }}
                  >
                    Add your first property
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {recentlyCreatedPropertyId && selectedPropertyId === recentlyCreatedPropertyId ? (
            <div
              style={{
                display: "grid",
                gap: 12,
                padding: 16,
                borderRadius: radius.lg,
                border: "1px solid rgba(16,185,129,0.28)",
                background: "rgba(236,253,245,0.95)",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ color: "#047857", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Step 1 complete
                </div>
                <div style={{ color: text.primary, fontSize: 18, fontWeight: 800 }}>
                  Your first property is set up
                </div>
                <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.6 }}>
                  {`${recentlyCreatedPropertyName || "Your property"} is ready. Add the first unit next so you can keep building the rent roll and tenant workflow in the right order.`}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 12,
                  borderRadius: radius.md,
                  border: "1px solid rgba(16,185,129,0.22)",
                  background: "rgba(255,255,255,0.72)",
                }}
              >
                <div style={{ color: text.secondary, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Step 2 next
                </div>
                <div style={{ color: text.primary, fontSize: 15, fontWeight: 700 }}>
                  Add your first unit
                </div>
                <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.5 }}>
                  Units make the property usable for leases, applications, and rent tracking. This is the clearest next workflow step after creating the property.
                </div>
                <div>
                  <Button
                    onClick={() => {
                      if (!selectedPropertyId) return;
                      setActivePropertyId(selectedPropertyId);
                      setUnitModalError(null);
                      setUnitModalSource("guided");
                      setDraftUnits([
                        { unitNumber: "", beds: 1, baths: 1, sqft: 500, marketRent: 1500, status: "vacant" },
                      ]);
                      setIsUnitsModalOpen(true);
                    }}
                  >
                    Add a unit
                  </Button>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 12,
                  borderRadius: radius.md,
                  border: upgradeConfirmed ? "1px solid rgba(16,185,129,0.28)" : `1px solid ${colors.border}`,
                  background: upgradeConfirmed ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.66)",
                }}
              >
                <div style={{ color: text.secondary, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {upgradeConfirmed ? "Upgrade unlocked" : "Step 3 later"}
                </div>
                <div style={{ color: text.primary, fontSize: 14, fontWeight: 700 }}>
                  {canInviteTenant ? "Move into the tenant workflow" : "Move into the application workflow"}
                </div>
                <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.5 }}>
                  {canInviteTenant
                    ? upgradeConfirmed
                      ? "Tenant invites are now unlocked. Move into the tenant workflow as soon as your first unit is ready."
                      : "Invite a tenant after at least one unit is ready so the application and lease flow has a clear place to start."
                    : upgradeConfirmed
                      ? "Application sending is now unlocked. Move into the application workflow as soon as your first unit is ready."
                      : "Send an application after your first unit is in place so the next workflow step stays clear and supported on Free."}
                </div>
                <div>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate(
                        canInviteTenant
                          ? "/tenants?invite=1&upgradeConfirmed=1&highlight=tenants"
                          : "/applications?openSendApplication=1&upgradeConfirmed=1&highlight=applications"
                      )
                    }
                    style={upgradeConfirmed ? { boxShadow: "0 0 0 3px rgba(16,185,129,0.14)" } : undefined}
                  >
                    {canInviteTenant ? "Invite a tenant" : "Send application"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

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
	                        setUnitModalError(null);
	                        setUnitModalSource("propertyTable");
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
              {selectedProperty ? (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      type="button"
                      className="no-print"
                      onClick={() => void printSummaryDocument("summary")}
                    >
                      Print / Save PDF
                    </Button>
                  </div>
                  <div className="print-only print-only-summary">
                    <div className="printHeader">
                      <div className="printTitle">{selectedProperty.name || selectedProperty.addressLine1 || "Property summary"}</div>
                      <div className="printMeta">
                        <div>{[selectedProperty.addressLine1, selectedProperty.city].filter(Boolean).join(", ") || "Address not available"}</div>
                        <div>Status: {selectedProperty.portfolioStatus || "active"}</div>
                      </div>
                    </div>
                    <table className="printTable">
                      <thead>
                        <tr>
                          <th>Unit</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray((selectedProperty as any)?.units) ? (selectedProperty as any).units : []).map((unit: any, index: number) => {
                          const leases = Array.isArray((selectedProperty as any)?.leases) ? (selectedProperty as any).leases : [];
                          const occupancy = deriveUnitOccupancyFromLeases(unit, leases);
                          return (
                            <tr key={String(unit?.id || unit?.unitId || unit?.uid || index)}>
                              <td>{String(unit?.unitNumber || unit?.label || unit?.name || "—")}</td>
                              <td>{occupancy.label}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
              <PropertyDetailPanel
                property={selectedProperty}
                onRefresh={loadProperties}
                onArchiveStateChanged={(nextProperty) => {
                  if (!nextProperty?.id) return;
                  setProperties((prev) =>
                    prev.filter((item) => String(item.id) !== String(nextProperty.id))
                  );
                  setSelectedPropertyId((prev) =>
                    prev === nextProperty.id ? null : prev
                  );
                }}
                onOpenLeasePack={() => {
                  setLeasePackInitialPropertyId(selectedProperty?.id || null);
                  setLeasePackOpen(true);
                }}
                onAddUnits={() => {
                  if (!selectedProperty?.id) return;
                  setActivePropertyId(selectedProperty.id);
                  setUnitModalError(null);
                  setUnitModalSource("propertyTable");
                  setDraftUnits([
                    { unitNumber: "", beds: 1, baths: 1, sqft: 500, marketRent: 1500, status: "vacant" },
                  ]);
                  setIsUnitsModalOpen(true);
                }}
                openEditProperty={openEditProperty}
                openSendApplication={openSendApplication}
                highlightUnitId={unitIdFromUrl || null}
                onSendApplicationOpened={() => {
                  const next = new URLSearchParams(location.search);
                  next.delete("openSendApplication");
                  navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
                }}
              />
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
              <div className="rc-action-requests-filters" style={{ display: "flex", gap: 8 }}>
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
              <SkeletonBlock lines={3} height={12} label="Loading action requests" />
            ) : actionRequestsError ? (
              <InlineError
                title="Action requests unavailable"
                message={actionRequestsError}
                retry={() => selectedPropertyId && void fetchActionRequests(selectedPropertyId)}
              />
            ) : actionRequests.length === 0 ? (
              <EmptyState
                title="No action requests"
                body="This property has no open operational requests right now."
              />
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
        onClose={() => {
          setUnitModalError(null);
          setIsUnitsModalOpen(false);
        }}
        units={draftUnits}
        setUnits={setDraftUnits}
        onSave={handleSaveUnits}
        saving={savingUnits}
        error={unitModalError}
      />
      <LeasePackGeneratorModal
        open={leasePackOpen}
        onClose={() => setLeasePackOpen(false)}
        properties={properties}
        initialPropertyId={leasePackInitialPropertyId}
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
  error,
}: {
  open: boolean;
  onClose: () => void;
  units: UnitInput[];
  setUnits: (u: UnitInput[]) => void;
  onSave: (unitsOverride?: UnitInput[]) => void;
  saving: boolean;
  error?: string | null;
}) => {
  if (!open) return null;

  const updateUnit = (idx: number, field: keyof UnitInput, value: any) => {
    const nextValue =
      field === "unitNumber" || field === "status" || field === "occupantName" || field === "leaseEndDate"
        ? String(value)
        : Number(value);
    setUnits(
      units.map((u, i) =>
        i === idx
          ? {
              ...u,
              [field]: nextValue,
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
  const baseFieldStyle = {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box" as const,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.45)",
    padding: "7px 8px",
  };
  const activeOccupancyFieldStyle = {
    ...baseFieldStyle,
    border: "1px solid rgba(37,99,235,0.45)",
    background: "white",
    color: "#0f172a",
  };
  const inactiveOccupancyFieldStyle = {
    ...baseFieldStyle,
    background: "rgba(241,245,249,0.85)",
    color: "#64748b",
  };
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
        padding: "clamp(10px, 2vw, 24px)",
      }}
    >
      <div
        className="rc-modal-shell"
        style={{
          background: "white",
          width: "min(1180px, calc(100vw - 24px))",
          maxHeight: "min(860px, calc(100vh - 24px))",
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          border: "1px solid rgba(148,163,184,0.35)",
          boxShadow: "0 25px 60px rgba(15,23,42,0.25)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid rgba(148,163,184,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
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

        <div className="rc-modal-body" style={{ padding: 16, overflow: "auto", minHeight: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="rc-units-edit-table" style={{ width: "100%", minWidth: 980, tableLayout: "fixed", borderCollapse: "collapse" }}>
              <colgroup>
                <col style={{ width: "13%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr>
                  {["Unit #", "Beds", "Baths", "Sqft", "Market Rent", "Status", "Occupant", "Lease End", ""].map((h) => (
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
	                        aria-label={`Unit number ${idx + 1}`}
	                        value={u.unitNumber}
	                        onChange={(e) => updateUnit(idx, "unitNumber", e.target.value)}
	                        style={baseFieldStyle}
	                      />
	                    </td>
	                    <td style={{ padding: "6px" }}>
	                      <input
	                        aria-label={`Beds ${idx + 1}`}
	                        type="number"
	                        value={u.beds}
	                        onChange={(e) => updateUnit(idx, "beds", e.target.value)}
	                        style={baseFieldStyle}
	                      />
	                    </td>
	                    <td style={{ padding: "6px" }}>
	                      <input
	                        aria-label={`Baths ${idx + 1}`}
	                        type="number"
	                        value={u.baths}
	                        onChange={(e) => updateUnit(idx, "baths", e.target.value)}
	                        style={baseFieldStyle}
	                      />
	                    </td>
	                    <td style={{ padding: "6px" }}>
	                      <input
	                        aria-label={`Square footage ${idx + 1}`}
	                        type="number"
	                        value={u.sqft}
	                        onChange={(e) => updateUnit(idx, "sqft", e.target.value)}
	                        style={baseFieldStyle}
	                      />
	                    </td>
	                    <td style={{ padding: "6px" }}>
	                      <input
	                        aria-label={`Market rent ${idx + 1}`}
	                        type="number"
	                        value={u.marketRent}
	                        onChange={(e) => updateUnit(idx, "marketRent", e.target.value)}
                        onFocus={() => {
                          if (
                            typeof window !== "undefined" &&
                            window.matchMedia("(max-width: 768px)").matches &&
                            String(u.marketRent ?? "") === "0"
                          ) {
                            updateUnit(idx, "marketRent", "");
                          }
                        }}
                        style={baseFieldStyle}
	                      />
	                    </td>
	                    <td style={{ padding: "6px" }}>
	                      <select
	                        aria-label={`Status ${idx + 1}`}
	                        value={u.status ?? "vacant"}
	                        onChange={(e) => updateUnit(idx, "status", e.target.value)}
	                        style={baseFieldStyle}
	                      >
	                        <option value="vacant">Vacant</option>
	                        <option value="occupied">Occupied</option>
	                      </select>
	                    </td>
	                    <td style={{ padding: "6px" }}>
	                      <input
	                        aria-label={`Occupant name ${idx + 1}`}
	                        value={u.occupantName ?? ""}
	                        onChange={(e) => updateUnit(idx, "occupantName", e.target.value)}
	                        disabled={(u.status ?? "vacant") !== "occupied"}
	                        placeholder={(u.status ?? "vacant") === "occupied" ? "Tenant name" : "Vacant"}
	                        style={(u.status ?? "vacant") === "occupied" ? activeOccupancyFieldStyle : inactiveOccupancyFieldStyle}
	                      />
	                    </td>
	                    <td style={{ padding: "6px" }}>
	                      <input
	                        aria-label={`Lease end date ${idx + 1}`}
	                        type="date"
	                        value={u.leaseEndDate ?? ""}
	                        onChange={(e) => updateUnit(idx, "leaseEndDate", e.target.value)}
	                        disabled={(u.status ?? "vacant") !== "occupied"}
	                        style={(u.status ?? "vacant") === "occupied" ? activeOccupancyFieldStyle : inactiveOccupancyFieldStyle}
	                      />
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
	                          whiteSpace: "nowrap",
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
          {error ? (
            <div
              role="alert"
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(220,38,38,0.24)",
                background: "rgba(254,242,242,0.9)",
                color: "#b91c1c",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="rc-modal-footer" style={{ padding: 16, borderTop: "1px solid rgba(148,163,184,0.2)", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
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
          <div className="rc-wrap-row">
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
              onClick={() => onSave(units)}
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
