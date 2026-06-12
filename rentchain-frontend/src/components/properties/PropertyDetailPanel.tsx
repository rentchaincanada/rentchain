import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  archiveProperty,
  publishProperty,
  unarchiveProperty,
  updateProperty,
  type Property,
} from "../../api/propertiesApi";
import {
  getLeasesForProperty,
  Lease,
} from "../../api/leasesApi";
import {
  getPropertyMonthlyPayments,
  Payment,
} from "@/api/paymentsApi";
import {
  importUnitsCsv,
  previewPropertyUnitsCsv,
  type UnitCsvIssue,
  type UnitCsvPreviewRow,
} from "../../api/unitsImportApi";
import { fetchUnitsForProperty } from "../../api/unitsApi";
import { buildUnitsCsvTemplate, downloadTextFile } from "../../utils/csvTemplates";
import { UnitsCsvPreviewModal } from "./UnitsCsvPreviewModal";
import { UnitEditModal } from "./UnitEditModal";
import { SendApplicationModal } from "./SendApplicationModal";
import { useToast } from "../ui/ToastProvider";
import { setOnboardingStep } from "../../api/onboardingApi";
import { track } from "../../lib/analytics";
import "../../styles/propertiesMobile.css";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useEntitlements } from "@/hooks/useEntitlements";
import { upgradeStarterButtonStyle } from "../../lib/upgradeButtonStyles";
import { dispatchUpgradePrompt, resolveRequiredPlanLabel } from "@/lib/upgradePrompt";
import { RiskScoreBadge } from "@/components/leases/RiskScoreBadge";
import { PropertyCredibilitySummaryCard } from "@/components/properties/PropertyCredibilitySummaryCard";
import { PropertyRegistryStatusCard } from "@/components/properties/PropertyRegistryStatusCard";
import { HalifaxRegistrySubmissionAssistant } from "@/components/properties/HalifaxRegistrySubmissionAssistant";
import type { PropertyCredibilitySummary } from "@/types/credibilitySummary";
import { calculateConfiguredUnitRentTotal, resolveConfiguredUnitRent } from "@/lib/propertyRentSummary";
import { buildPropertySummaryMetrics } from "@/lib/propertySummaryMetrics";
import {
  deriveUnitOccupancyFromLeases,
  type UnitOccupancy,
  type UnitOccupancyStatus,
} from "@/lib/leases/leaseLifecycle";
import { getUnitsNeedingOccupancySetup } from "./occupancyPrompt";

interface PropertyDetailPanelProps {
  property: Property | null;
  onRefresh?: () => Promise<void> | void;
  onArchiveStateChanged?: (property: Property) => Promise<void> | void;
  openEditProperty?: boolean;
  openSendApplication?: boolean;
  onSendApplicationOpened?: () => void;
  highlightUnitId?: string | null;
  onOpenLeasePack?: () => void;
}

import { safeLocaleNumber } from "@/utils/format";

const formatCurrency = (value: number): string => `$${safeLocaleNumber(value)}`;

const RAW_ID_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

function cleanLabel(value: unknown): string {
  return String(value || "").trim();
}

function isRawUnitIdLabel(value: string, rawIds: string[]) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  if (rawIds.some((id) => id && id.toLowerCase() === normalized)) return true;
  return RAW_ID_PATTERN.test(value) && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function isScheduleADocumentUrl(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && (normalized.includes("schedule-a") || normalized.includes("schedule_a"));
}

function findLeaseRiskUnit(lease: Lease, unitsForDisplay: any[]): any | null {
  const rawIds = [cleanLabel(lease.unitId), cleanLabel((lease as any).id)].filter(Boolean);
  const unitReference = cleanLabel(lease.unitId || lease.unitNumber || lease.unitLabel);
  return unitsForDisplay.find((unit: any) => {
    const candidates = [
      unit?.id,
      unit?.unitId,
      unit?.uid,
      unit?.unitNumber,
      unit?.label,
      unit?.name,
      unit?.unit,
    ]
      .map(cleanLabel)
      .filter(Boolean);
    return candidates.some((candidate) => candidate.toLowerCase() === unitReference.toLowerCase());
  }) || null;
}

function resolveLeaseRiskUnitLabel(lease: Lease, unitsForDisplay: any[]): string {
  const rawIds = [cleanLabel(lease.unitId), cleanLabel((lease as any).id)].filter(Boolean);
  const matchedUnit = findLeaseRiskUnit(lease, unitsForDisplay);
  const candidates = [
    matchedUnit?.unitNumber,
    matchedUnit?.label,
    matchedUnit?.name,
    matchedUnit?.unit,
    lease.unitLabel,
    lease.unitNumber,
  ]
    .map(cleanLabel)
    .filter((value) => value && !isRawUnitIdLabel(value, rawIds));
  const label = candidates[0];
  if (!label) return "Assigned unit";
  return /^unit\b/i.test(label) ? label : `Unit ${label}`;
}

function resolveLeaseRiskRent(lease: Lease, unitsForDisplay: any[]): number {
  const matchedUnit = findLeaseRiskUnit(lease, unitsForDisplay);
  return resolveConfiguredUnitRent(matchedUnit || {}) ?? lease.monthlyRent ?? 0;
}

function formatDateInputValue(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function resolveOccupancyTenantName(unit: any, occupancy: UnitOccupancy): string {
  const lease = occupancy.lease as any;
  return String(
    lease?.tenantName ||
      lease?.tenantDisplayName ||
      lease?.primaryTenantName ||
      lease?.occupantName ||
      unit?.occupantName ||
      unit?.tenantName ||
      ""
  ).trim();
}

function resolveOccupancyLeaseEndDate(unit: any, occupancy: UnitOccupancy): string {
  const lease = occupancy.lease as any;
  return String(lease?.endDate || lease?.leaseEndDate || unit?.leaseEndDate || unit?.leaseEnd || "").trim();
}

function buildUnitOccupancyView(unit: any, occupancy: UnitOccupancy) {
  const tenantName = occupancy.status === "occupied" || occupancy.status === "upcoming"
    ? resolveOccupancyTenantName(unit, occupancy)
    : "";
  const leaseEndDate = occupancy.status === "occupied" || occupancy.status === "upcoming"
    ? resolveOccupancyLeaseEndDate(unit, occupancy)
    : "";
  const lease = occupancy.lease as any;
  const leaseId = String((occupancy.lease as any)?.id || (occupancy.lease as any)?.leaseId || "").trim();
  const tenantId = String(
    lease?.tenantId ||
      lease?.primaryTenantId ||
      (Array.isArray(lease?.tenantIds) ? lease.tenantIds[0] : "") ||
      unit?.tenantId ||
      unit?.currentTenantId ||
      unit?.occupantTenantId ||
      ""
  ).trim();
  return {
    status: occupancy.status,
    label: occupancy.label,
    tenantName,
    tenantId,
    tenantHref: tenantName && tenantId ? `/tenants?tenantId=${encodeURIComponent(tenantId)}` : "",
    leaseEndDate,
    leaseId,
    leaseHref: leaseId ? `/leases/${encodeURIComponent(leaseId)}/summary` : "",
    reviewReason: occupancy.status === "review_required" ? occupancy.reason || "Occupancy data needs review." : "",
    ledgerHref: leaseId ? `/leases/${encodeURIComponent(leaseId)}/ledger` : "",
  };
}

function unitOccupancyTone(status: UnitOccupancyStatus) {
  if (status === "occupied") {
    return { background: "rgba(34,197,94,0.1)", color: "#166534", dot: "#22c55e" };
  }
  if (status === "review_required") {
    return { background: "rgba(245,158,11,0.12)", color: "#92400e", dot: "#f59e0b" };
  }
  if (status === "upcoming") {
    return { background: "rgba(59,130,246,0.1)", color: "#1d4ed8", dot: "#3b82f6" };
  }
  if (status === "archived") {
    return { background: "rgba(100,116,139,0.1)", color: "#475569", dot: "#64748b" };
  }
  return { background: "rgba(248,113,113,0.08)", color: "#b91c1c", dot: "#f87171" };
}

const formatDate = (iso: string): string => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function safeStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  const storage = window.localStorage;
  if (!storage || typeof storage.setItem !== "function") return;
  try {
    storage.setItem(key, value);
  } catch {
    // ignore storage write failures
  }
}

function isPersistedUnitId(unit: any) {
  const id = String(unit?.id || unit?.unitId || unit?.uid || "").trim();
  return Boolean(id) && !/^placeholder-/i.test(id);
}

export const PropertyDetailPanel: React.FC<PropertyDetailPanelProps> = ({
  property,
  onRefresh,
  onArchiveStateChanged,
  openEditProperty = false,
  openSendApplication = false,
  onSendApplicationOpened,
  highlightUnitId = null,
  onOpenLeasePack,
}) => {
  const propertyId = property?.id;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { caps, features, loading: capsLoading } = useCapabilities();
  const entitlements = useEntitlements();
  const unitsEnabled = features?.unitsTable !== false;
  const currentPlan = entitlements.plan || "free";
  const applicationsRequiredPlanLabel = resolveRequiredPlanLabel("applications", currentPlan) || "Starter";
  const unitsRequiredPlanLabel = resolveRequiredPlanLabel("units", currentPlan) || "Starter";
  const propertyUpgradeRedirect =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/properties";
  const applicationsEnabled =
    entitlements.hasCapability("applications") ||
    currentPlan === "starter" ||
    currentPlan === "pro" ||
    currentPlan === "elite";
  const [leases, setLeases] = useState<Lease[]>([]);
  const [credibilitySummary, setCredibilitySummary] = useState<PropertyCredibilitySummary | null>(null);
  const [isLeasesLoading, setIsLeasesLoading] = useState(false);
  const [leasesError, setLeasesError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalCollectedThisMonth, setTotalCollectedThisMonth] = useState(0);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [unitCsvPreviewRows, setUnitCsvPreviewRows] = useState<UnitCsvPreviewRow[]>([]);
  const [unitCsvIssues, setUnitCsvIssues] = useState<UnitCsvIssue[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>("");
  const [units, setUnits] = useState<any[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);
  const [isPublishingProperty, setIsPublishingProperty] = useState(false);
  const [isUpdatingArchiveState, setIsUpdatingArchiveState] = useState(false);
  const [isSavingScreeningToggle, setIsSavingScreeningToggle] = useState(false);
  const [sendAppUnit, setSendAppUnit] = useState<any | null>(null);
  const [editPropertyOpen, setEditPropertyOpen] = useState(false);
  const [isSavingPropertyEdit, setIsSavingPropertyEdit] = useState(false);
  const [editPropertyError, setEditPropertyError] = useState<string | null>(null);
  const [editPropertyForm, setEditPropertyForm] = useState({
    name: "",
    pid: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    province: "UNSET",
    postalCode: "",
    country: "Canada",
  });
  const sendApplicationOpenedRef = useRef(false);
  const editPropertyOpenedRef = useRef(false);
  const [highlightedUnitKey, setHighlightedUnitKey] = useState<string | null>(null);
  const [blockedApplicationUpgradeUnitKey, setBlockedApplicationUpgradeUnitKey] = useState<string | null>(null);
  const [occupancyPromptDismissed, setOccupancyPromptDismissed] = useState(false);
  const [unitResolutionError, setUnitResolutionError] = useState<string | null>(null);
  const [editComplianceExpanded, setEditComplianceExpanded] = useState(false);
  const [submissionAssistantOpen, setSubmissionAssistantOpen] = useState(false);
  const unitRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const unitCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const promptApplicationsUpgrade = useCallback(
    (source: string, currentPlanOverride?: string | null) => {
      dispatchUpgradePrompt({
        featureKey: "applications",
        currentPlan: currentPlanOverride || caps?.plan || currentPlan,
        source,
        redirectTo: propertyUpgradeRedirect,
      });
    },
    [caps?.plan, currentPlan, propertyUpgradeRedirect]
  );

  const openBlockedApplicationUpgrade = useCallback(
    (unitKey: string) => {
      setBlockedApplicationUpgradeUnitKey(unitKey);
      promptApplicationsUpgrade("property_detail_panel_units");
    },
    [promptApplicationsUpgrade]
  );

  const promptUnitsUpgrade = useCallback(
    (source: string) => {
      dispatchUpgradePrompt({
        featureKey: "units",
        currentPlan: caps?.plan || currentPlan,
        source,
        redirectTo: propertyUpgradeRedirect,
      });
    },
    [caps?.plan, currentPlan, propertyUpgradeRedirect]
  );

  const readFileText = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? "--"));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }, []);

  const confirmImport = useCallback(async () => {
    if (!pendingFile || !property?.id) return;
    try {
      setIsImporting(true);
      const csvText = await readFileText(pendingFile);
      console.log("[units-import] file=", pendingFile?.name, pendingFile?.size, pendingFile?.type);
      console.log("[units-import] csvText.len=", csvText?.length);
      console.log("[units-import] csvText.head=", String(csvText ?? "--").slice(0, 120));

      if (!csvText || !String(csvText).trim()) {
        showToast({
          message: "CSV import failed",
          description: "CSV file appears empty or unreadable.",
          variant: "error",
        });
        return;
      }
      const idempotencyKey = `${property.id}:${pendingFile.name}:${pendingFile.size}:${pendingFile.lastModified}`;
      const result = await importUnitsCsv(property.id, csvText, "partial", idempotencyKey);
      const created = result?.createdCount ?? result?.created ?? result?.imported ?? result?.summary?.insertable ?? 0;
      const updated = result?.updatedCount ?? result?.updated ?? 0;
      const skipped =
        result?.skippedCount ??
        result?.skipped ??
        ((result?.summary?.invalid ?? 0) +
          (result?.summary?.duplicatesInCsv ?? 0) +
          (result?.summary?.conflicts ?? 0)) ??
        0;
      const errCount = Array.isArray(result?.issues)
        ? result.issues.length
        : Array.isArray(result?.errors)
        ? result.errors.length
        : 0;
      showToast({
        message: "Units imported",
        description: `Created ${created} | Updated ${updated} | Skipped ${skipped}${
          errCount ? ` | ${errCount} issue(s)` : ""
        }`,
        variant: errCount ? "warning" : undefined,
      });
      setPreviewOpen(false);
      setPendingFile(null);
      setPendingFilename("");
      setUnitCsvPreviewRows([]);
      setUnitCsvIssues([]);
      setImportMessage(
        result?.message ||
          `Created ${created} | Updated ${updated} | Skipped ${skipped}${
            errCount ? ` | ${errCount} issue(s)` : ""
          }`
      );
      if (onRefresh) {
        await onRefresh();
      }
      track("activation_unit_created", {
        surface: "property_detail_panel",
        source: "units_csv_import",
        plan: currentPlan,
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      try {
        await setOnboardingStep("unitAdded", true);
      } catch {
        // ignore onboarding errors
      }
      // stay on page; no additional navigation/toasts
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      const code = data?.code;
      const errMsg = String(data?.error || e?.message || "");
      const isPlanLimit =
        (status === 403 && data?.error === "PLAN_LIMIT") ||
        (status === 409 && code === "LIMIT_REACHED") ||
        /plan limit/i.test(errMsg);

      if (isPlanLimit) {
        // UpgradePromptModal is dispatched via API error handlers.
        return;
      }

      showToast({
        message: "Import unsuccessful",
        description: e?.message ?? "--",
        variant: "error",
      });
    } finally {
      setIsImporting(false);
    }
  }, [navigate, onRefresh, pendingFile, property?.id, readFileText, showToast]);

  const handleSendApplication = useCallback(
    (u: any) => {
      if (!applicationsEnabled) {
        promptApplicationsUpgrade("property_detail_panel");
        return;
      }
      setSendAppUnit(u);
    },
    [applicationsEnabled, promptApplicationsUpgrade]
  );

  const openEditPropertyModal = useCallback(() => {
    if (!property) return;
    setEditPropertyError(null);
    setEditPropertyForm({
      name: String(property.name || ""),
      pid: String(property.pid || ""),
      addressLine1: String(property.addressLine1 || ""),
      addressLine2: String(property.addressLine2 || ""),
      city: String(property.city || ""),
      province: String(property.province || "UNSET"),
      postalCode: String(property.postalCode || ""),
      country: String(property.country || "Canada"),
    });
    setEditComplianceExpanded(Boolean(property.pid));
    setEditPropertyOpen(true);
  }, [property]);

  const sendApplicationActionLabel = applicationsEnabled
    ? "Send application"
    : `Upgrade to ${applicationsRequiredPlanLabel} to send application`;
  const sendApplicationActionStyle = applicationsEnabled
    ? {
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#fff",
        cursor: "pointer",
        fontSize: "0.85rem",
      }
    : {
        ...upgradeStarterButtonStyle,
        padding: "6px 10px",
        fontSize: "0.85rem",
      };

  const renderBlockedApplicationUpgrade = (unitKey: string) => {
    if (applicationsEnabled || blockedApplicationUpgradeUnitKey !== unitKey) return null;
    return (
      <div
        style={{
          marginTop: 8,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid rgba(59,130,246,0.22)",
          background: "rgba(59,130,246,0.08)",
          display: "grid",
          gap: 8,
          maxWidth: 280,
        }}
      >
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1d4ed8" }}>
          Send application is locked on Free
        </div>
        <div style={{ fontSize: "0.75rem", color: "#475569" }}>
          Starter unlocks tenant invites and application links. Use the upgrade button here to continue to plan options.
        </div>
        <button
          type="button"
          onClick={() => promptApplicationsUpgrade("property_detail_panel_units_inline")}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid rgba(59,130,246,0.35)",
            background: "#fff",
            color: "#2563eb",
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 700,
            justifySelf: "start",
          }}
        >
          See Starter upgrade options
        </button>
      </div>
    );
  };

  useEffect(() => {
    if (!openSendApplication) return;
    if (sendApplicationOpenedRef.current) return;
    if (!propertyId) return;
    sendApplicationOpenedRef.current = true;
    if (!applicationsEnabled) {
      promptApplicationsUpgrade("property_detail_panel");
      onSendApplicationOpened?.();
      return;
    }
    setSendAppUnit({ id: null });
    onSendApplicationOpened?.();
  }, [openSendApplication, applicationsEnabled, onSendApplicationOpened, promptApplicationsUpgrade, propertyId]);

  useEffect(() => {
    if (!openEditProperty) return;
    if (editPropertyOpenedRef.current) return;
    if (!property) return;
    editPropertyOpenedRef.current = true;
    openEditPropertyModal();
  }, [openEditProperty, openEditPropertyModal, property]);

  useEffect(() => {
    if (openEditProperty) return;
    editPropertyOpenedRef.current = false;
  }, [openEditProperty]);
  const setLeasesLoadingStates = (loading: boolean, error: string | null) => {
    setIsLeasesLoading(loading);
    setLeasesError(error);
  };

  useEffect(() => {
    let cancelled = false;
    setUnits(property?.units || []);

    const loadUnits = async () => {
      const pid = property?.id;
      if (!pid) {
        setUnits([]);
        return;
      }
      if (!unitsEnabled) {
        setUnits([]);
        return;
      }
      try {
        setUnitsLoading(true);
        const res = await fetchUnitsForProperty(pid);
        if (cancelled) return;
        if (Array.isArray(res) && res.length > 0) {
          setUnits(res);
          return;
        }
        const count = (property as any)?.unitCount ?? 0;
        if (count > 0) {
          setUnits(
            Array.from({ length: count }, (_, i) => ({
              id: `placeholder-${i}`,
              unitNumber: String(i + 1),
            }))
          );
        }
      } catch (e) {
        if (cancelled) return;
        const count = (property as any)?.unitCount ?? 0;
        if (count > 0) {
          setUnits(
            Array.from({ length: count }, (_, i) => ({
              id: `placeholder-${i}`,
              unitNumber: String(i + 1),
            }))
          );
        }
      } finally {
        if (!cancelled) setUnitsLoading(false);
      }
    };

    void loadUnits();
    return () => {
      cancelled = true;
    };
  }, [property?.id, property?.units, unitsEnabled]);

  useEffect(() => {
    let cancelled = false;
    const currentId = propertyId;
    if (!property) {
      setLeases([]);
      setCredibilitySummary(null);
      setLeasesLoadingStates(false, null);
      setPayments([]);
      setTotalCollectedThisMonth(0);
      setIsPaymentsLoading(false);
      setPaymentsError(null);
      return;
    }

    const load = async () => {
      try {
        setIsLeasesLoading(true);
        const data = await getLeasesForProperty(property.id);
        if (!cancelled) {
          if (currentId === propertyId) {
            setLeases(data.leases);
            setCredibilitySummary(data.credibilitySummary ?? null);
            setLeasesError(null);
          }
        }
      } catch (err) {
        console.error("[PropertyDetailPanel] Failed to load leases", err);
        if (!cancelled) {
          setLeases([]);
          setCredibilitySummary(null);
          setLeasesError("Leases could not be loaded");
        }
      } finally {
        if (!cancelled) {
          if (currentId === propertyId) {
            setIsLeasesLoading(false);
          }
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  // no plan fetch needed; starter supports unlimited units

  useEffect(() => {
    let cancelled = false;
    const currentId = propertyId;
    if (!property) {
      setPayments([]);
      setTotalCollectedThisMonth(0);
      setIsPaymentsLoading(false);
      setPaymentsError(null);
      return;
    }

    const loadPayments = async () => {
      try {
        setIsPaymentsLoading(true);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const resp = await getPropertyMonthlyPayments(property.id, year, month);
        if (!cancelled) {
          if (currentId === propertyId) {
            setPayments(resp.payments);
            setTotalCollectedThisMonth(resp.total);
            setPaymentsError(null);
          }
        }
      } catch (err) {
        console.error("[PropertyDetailPanel] Failed to load payments", err);
        if (!cancelled) {
          setPayments([]);
          setTotalCollectedThisMonth(0);
          setPaymentsError("Payments could not be loaded");
        }
      } finally {
        if (!cancelled) {
          if (currentId === propertyId) {
            setIsPaymentsLoading(false);
          }
        }
      }
    };

    void loadPayments();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  
  const unitCount =
    Array.isArray(units) && units.length > 0
      ? units.length
      : Number((property as any)?.unitsCount ?? (property as any)?.unitCount ?? 0) || 0;
  const propertyStatus = String((property as any)?.status || "DRAFT").toUpperCase();
  const portfolioStatus = String((property as any)?.portfolioStatus || "active").toLowerCase();
  const isArchived = portfolioStatus === "archived";
  const publishDisabled = unitCount < 1 || isPublishingProperty;
  const screeningRequiredBeforeApproval =
    (property as any)?.screeningRequiredBeforeApproval !== false;
  const totalRentConfigured = useMemo(() => calculateConfiguredUnitRentTotal(units), [units]);
  const displayedUnits = useMemo(() => {
    if (Array.isArray(units) && units.length > 0) return units;
    if (unitCount > 0) {
      return Array.from({ length: unitCount }, (_, i) => ({
        id: `placeholder-${i}`,
        unitNumber: String(i + 1),
      }));
    }
    return [];
  }, [units, unitCount]);

  const {
    activeLeases,
    leasedUnits,
    occupancyRate,
    activeLeaseRentTotal,
    currentOccupiedRentTotal,
  } = useMemo(() => buildPropertySummaryMetrics(displayedUnits, leases, unitCount), [displayedUnits, leases, unitCount]);
  const collectionRate =
    currentOccupiedRentTotal > 0 ? totalCollectedThisMonth / currentOccupiedRentTotal : 0;
  const getUnitOccupancy = useCallback(
    (unit: any) => deriveUnitOccupancyFromLeases(unit, leases),
    [leases]
  );
  const getUnitOccupancyView = useCallback(
    (unit: any) => buildUnitOccupancyView(unit, getUnitOccupancy(unit)),
    [getUnitOccupancy]
  );
  const getUnitForEdit = useCallback(
    (unit: any) => {
      const view = getUnitOccupancyView(unit);
      const hasLeaseDerivedOccupancy = Boolean(view.leaseId) && (view.status === "occupied" || view.status === "upcoming");
      if (!hasLeaseDerivedOccupancy) return unit;
      return {
        ...unit,
        status: "occupied",
        occupantName: view.tenantName || unit?.occupantName || "",
        leaseEndDate: formatDateInputValue(view.leaseEndDate) || unit?.leaseEndDate || "",
      };
    },
    [getUnitOccupancyView]
  );
  const openUnitEdit = useCallback(
    (unit: any) => {
      if (!isPersistedUnitId(unit)) {
        const message = "This unit is not ready for occupancy updates yet. Refresh the property after saving units, then try again.";
        setUnitResolutionError(message);
        showToast({
          message: "Unit not ready",
          description: message,
          variant: "error",
        });
        return;
      }
      setUnitResolutionError(null);
      setEditingUnit(getUnitForEdit(unit));
    },
    [getUnitForEdit, showToast]
  );

  const unitsNeedingOccupancySetup = useMemo(
    () => getUnitsNeedingOccupancySetup(displayedUnits, activeLeases),
    [activeLeases, displayedUnits]
  );
  const showOccupancyPrompt =
    displayedUnits.length > 0 && unitsNeedingOccupancySetup.length > 0 && !occupancyPromptDismissed;

  useEffect(() => {
    if (typeof window === "undefined" || !propertyId) return;
    const dismissed = safeStorageGet(`rentchain.occupancyPrompt.dismissed.${propertyId}`) === "1";
    setOccupancyPromptDismissed(dismissed);
  }, [propertyId]);

  const dismissOccupancyPrompt = useCallback(() => {
    if (propertyId) safeStorageSet(`rentchain.occupancyPrompt.dismissed.${propertyId}`, "1");
    setOccupancyPromptDismissed(true);
  }, [propertyId]);

  const displayName = property?.name || property?.addressLine1 || "Property";
  const showEmpty = !property;
  const showLoading = !!property && (isLeasesLoading || isPaymentsLoading);
  const showLeasesError = !!leasesError;
  const showPaymentsError = !!paymentsError;

  const handlePublishProperty = useCallback(async () => {
    if (!property?.id || publishDisabled) return;
    try {
      setIsPublishingProperty(true);
      await publishProperty(String(property.id));
      showToast({ message: "Property published", variant: "success" });
      await onRefresh?.();
    } catch (e: any) {
      const detail = String(e?.response?.data?.detail || e?.message || "Could not publish property");
      showToast({ message: "Publish failed", description: detail, variant: "error" });
    } finally {
      setIsPublishingProperty(false);
    }
  }, [onRefresh, property?.id, publishDisabled, showToast]);

  const handleScreeningRequiredToggle = useCallback(async () => {
    if (!property?.id) return;
    const nextValue = !screeningRequiredBeforeApproval;
    try {
      setIsSavingScreeningToggle(true);
      await updateProperty(String(property.id), {
        screeningRequiredBeforeApproval: nextValue,
      } as any);
      showToast({
        message: nextValue
          ? "Screening required before approval enabled"
          : "Screening requirement disabled",
        variant: "success",
      });
      await onRefresh?.();
    } catch (e: any) {
      showToast({
        message: "Could not update screening rule",
        description: String(e?.message || "Please try again"),
        variant: "error",
      });
    } finally {
      setIsSavingScreeningToggle(false);
    }
  }, [onRefresh, property?.id, screeningRequiredBeforeApproval, showToast]);

  const handleArchiveToggle = useCallback(async () => {
    if (!property?.id) return;
    const confirmed = window.confirm(
      isArchived
        ? "Restore this property to your active portfolio? You can archive it again later if needed."
        : "Are you sure you want to archive this property? You can reactivate this property later."
    );
    if (!confirmed) return;

    try {
      setIsUpdatingArchiveState(true);
      const result = isArchived
        ? await unarchiveProperty(String(property.id))
        : await archiveProperty(String(property.id));
      showToast({
        message: isArchived ? "Property restored" : "Property archived",
        variant: "success",
      });
      await onArchiveStateChanged?.(result.property);
      await onRefresh?.();
    } catch (e: any) {
      showToast({
        message: isArchived ? "Could not restore property" : "Could not archive property",
        description: String(e?.message || "Please try again."),
        variant: "error",
      });
    } finally {
      setIsUpdatingArchiveState(false);
    }
  }, [isArchived, onArchiveStateChanged, onRefresh, property?.id, showToast]);

  const handleSavePropertyEdit = useCallback(async () => {
    if (!property?.id) return;
    const addressLine1 = editPropertyForm.addressLine1.trim();
    const city = editPropertyForm.city.trim();
    if (!addressLine1 || !city) {
      setEditPropertyError("Address and city are required.");
      return;
    }

    try {
      setIsSavingPropertyEdit(true);
      setEditPropertyError(null);
      await updateProperty(String(property.id), {
        name: editPropertyForm.name.trim() || undefined,
        pid: editPropertyForm.pid.trim() || null,
        addressLine1,
        addressLine2: editPropertyForm.addressLine2.trim() || undefined,
        city,
        province: editPropertyForm.province.trim() || "UNSET",
        postalCode: editPropertyForm.postalCode.trim() || undefined,
        country: editPropertyForm.country.trim() || undefined,
      } as Partial<Property>);
      showToast({ message: "Property details updated", variant: "success" });
      setEditPropertyOpen(false);
      await onRefresh?.();
    } catch (e: any) {
      const detail = String(e?.response?.data?.detail || e?.message || "Could not update property details");
      setEditPropertyError(detail);
      showToast({ message: "Update failed", description: detail, variant: "error" });
    } finally {
      setIsSavingPropertyEdit(false);
    }
  }, [editPropertyForm, onRefresh, property?.id, showToast]);

  const getUnitKey = useCallback((u: any, idx: number) => {
    return String(u?.id || u?.unitId || u?.uid || u?.unitNumber || `unit-${idx}`);
  }, []);

  useEffect(() => {
    if (!highlightUnitId || !displayedUnits.length) {
      setHighlightedUnitKey(null);
      return;
    }
    const target = String(highlightUnitId).trim().toLowerCase();
    const matchIndex = displayedUnits.findIndex((u: any) => {
      const idMatch = String(u?.id || "").toLowerCase() === target;
      const unitIdMatch = String(u?.unitId || "").toLowerCase() === target;
      const unitNumberMatch = String(u?.unitNumber || "").toLowerCase() === target;
      return idMatch || unitIdMatch || unitNumberMatch;
    });
    if (matchIndex < 0) {
      setHighlightedUnitKey(null);
      return;
    }
    const key = getUnitKey(displayedUnits[matchIndex], matchIndex);
    setHighlightedUnitKey(key);
    const rowEl = unitRowRefs.current[key];
    const cardEl = unitCardRefs.current[key];
    const targetEl = rowEl || cardEl || null;
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [displayedUnits, getUnitKey, highlightUnitId]);

  if (showEmpty) {
    return (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        Select a property to view details and rent roll.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div className="rc-property-header" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="rc-property-title" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              {displayName}
            </div>
            <div className="rc-property-address" style={{ color: "#1f2937", fontSize: "0.9rem" }}>
              {property.addressLine1}
              {property.addressLine2 ? `, ${property.addressLine2}` : ""}
            </div>
            <div className="rc-property-city" style={{ color: "#475569", fontSize: "0.85rem" }}>
              {[property.city, property.province, property.postalCode]
                .filter(Boolean)
                .join(", ")}
            </div>
            <div className="rc-property-unit-count" style={{ color: "#0f172a", fontSize: "0.8rem", fontWeight: 600 }}>
              Units: {unitCount}
            </div>
            <div style={{ color: "#475569", fontSize: "0.8rem" }}>
              PID: {property.pid || "--"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  border: "1px solid rgba(148,163,184,0.35)",
                  color: propertyStatus === "PUBLISHED" ? "#166534" : "#92400e",
                  background:
                    propertyStatus === "PUBLISHED"
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(245,158,11,0.12)",
                }}
              >
                {propertyStatus}
              </span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  border: "1px solid rgba(148,163,184,0.35)",
                  color: isArchived ? "#92400e" : "#166534",
                  background: isArchived ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.1)",
                }}
              >
                {isArchived ? "ARCHIVED" : "ACTIVE PORTFOLIO"}
              </span>
            </div>
            <div className="rc-property-meta" style={{ color: "#6b7280", fontSize: "0.8rem" }}>
              Added {formatDate(property.createdAt)}
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#1f2937" }}>
              <input
                type="checkbox"
                checked={screeningRequiredBeforeApproval}
                disabled={isSavingScreeningToggle}
                onChange={() => {
                  void handleScreeningRequiredToggle();
                }}
              />
              Require screening before approval
            </label>
          </div>
          <div className="rc-units-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                void handleArchiveToggle();
              }}
              disabled={isUpdatingArchiveState}
              className="rc-units-action"
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: isArchived ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.12)",
                color: isArchived ? "#166534" : "#92400e",
                cursor: isUpdatingArchiveState ? "not-allowed" : "pointer",
              }}
            >
              {isUpdatingArchiveState
                ? isArchived
                  ? "Restoring..."
                  : "Archiving..."
                : isArchived
                ? "Restore to Active"
                : "Archive Property"}
            </button>
            {propertyStatus === "DRAFT" ? (
              <button
                type="button"
                onClick={() => {
                  void handlePublishProperty();
                }}
                disabled={publishDisabled}
                className="rc-units-action"
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(16,185,129,0.45)",
                  background: publishDisabled ? "rgba(15,23,42,0.06)" : "rgba(16,185,129,0.1)",
                  color: publishDisabled ? "#9ca3af" : "#065f46",
                  cursor: publishDisabled ? "not-allowed" : "pointer",
                }}
                title={unitCount < 1 ? "Add at least one unit before publishing." : undefined}
              >
                {isPublishingProperty ? "Publishing..." : "Publish Property"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onOpenLeasePack?.()}
              className="rc-units-action"
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: "#111827",
                cursor: "pointer",
              }}
            >
              Lease Pack
            </button>
            <button
              type="button"
              onClick={openEditPropertyModal}
              disabled={!property}
              className="rc-units-action"
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: property ? "#111827" : "#6b7280",
                cursor: property ? "pointer" : "not-allowed",
              }}
            >
              Edit
            </button>
            {capsLoading || unitsEnabled ? (
              <>
                <button
                  type="button"
                  title="Use Upload CSV to add units"
                  onClick={() => {
                    setImportMessage(null);
                    fileInputRef.current?.click();
                  }}
                  disabled={!property}
                  className="rc-units-action"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#fff",
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  Add units
                </button>
                <button
                  type="button"
                  title="Upload units CSV"
                  onClick={() => {
                    setImportMessage(null);
                    fileInputRef.current?.click();
                  }}
                  disabled={isImporting || !property}
                  className="rc-units-action"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#fff",
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  {isImporting ? "Uploading…" : "Upload CSV"}
                </button>
                <button
                  type="button"
                  title="Download a CSV template for units import"
                  onClick={() => {
                    const csv = buildUnitsCsvTemplate();
                    downloadTextFile("rentchain-units-template.csv", csv);
                  }}
                  className="rc-units-action rc-units-download"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#fff",
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  Download CSV template
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file || !property) return;
                    try {
                      const text = await readFileText(file);
                      const preview = await previewPropertyUnitsCsv(property.id, text);
                      setPendingFile(file);
                      setPendingFilename(file.name);
                      setPreviewHeaders(preview.headers?.expected || []);
                      setPreviewRows([]);
                      setUnitCsvPreviewRows(preview.preview?.rows || preview.rows || []);
                      setUnitCsvIssues(preview.preview?.errors || preview.issues || []);
                      setPreviewOpen(true);
                    } catch (err: any) {
                      showToast({
                        message: "Failed to preview CSV file",
                        description: err?.response?.data?.error || err?.message,
                        variant: "error",
                      });
                    }
                  }}
                />
              </>
            ) : (
              <button
                type="button"
                className="rc-units-action"
                onClick={() => promptUnitsUpgrade("property_detail_panel_units")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(59,130,246,0.35)",
                  background: "rgba(59,130,246,0.12)",
                  color: "#2563eb",
                  cursor: "pointer",
                }}
              >
                Upgrade to add units
              </button>
            )}
          </div>
        </div>
        {showLoading && (
          <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
            Loading leases/payments…
          </div>
        )}
        {(showLeasesError || showPaymentsError) && (
          <div style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
            {leasesError || paymentsError}
          </div>
        )}
      </div>

    {/* KPI strip */}
      <div
        className="rc-kpi-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#111827", fontSize: "0.8rem" }}>
            Total units
          </div>
          <div className="rc-kpi-value" style={{ color: "#0b1220", fontWeight: 700, fontSize: "1.1rem" }}>
            {unitCount}
          </div>
        </div>
        {propertyStatus === "DRAFT" && unitCount < 1 ? (
          <div style={{ color: "#92400e", fontSize: "0.8rem" }}>
            Add at least one unit to publish this property.
          </div>
        ) : null}
        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#111827", fontSize: "0.8rem" }}>
            Leased units
          </div>
          <div className="rc-kpi-value" style={{ color: "#0b1220", fontWeight: 700, fontSize: "1.1rem" }}>
            {leasedUnits.length}
          </div>
          <div className="rc-kpi-subtext" style={{ color: "#4b5563", fontSize: "0.75rem", marginTop: 2 }}>
            Counts units with an active lease record.
          </div>
        </div>
        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#111827", fontSize: "0.8rem" }}>
            Occupancy
          </div>
          <div className="rc-kpi-value" style={{ color: "#0b1220", fontWeight: 700, fontSize: "1.05rem" }}>
            {unitCount === 0 ? "--" : `${occupancyRate.toFixed(0)}%`}
          </div>
          <div className="rc-kpi-subtext" style={{ color: "#4b5563", fontSize: "0.75rem", marginTop: 2 }}>
            Based on active and notice-period lease records.
          </div>
        </div>
        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#111827", fontSize: "0.8rem" }}>
            Configured unit rent total
          </div>
          <div className="rc-kpi-value" style={{ color: "#0b1220", fontWeight: 700, fontSize: "1.05rem" }}>
            {formatCurrency(totalRentConfigured)}
          </div>
          <div className="rc-kpi-subtext" style={{ color: "#4b5563", fontSize: "0.75rem", marginTop: 2 }}>
            Based on the configured rents shown in the unit table.
          </div>
        </div>

        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#111827", fontSize: "0.8rem" }}>
            Active lease rent total
          </div>
          <div className="rc-kpi-value" style={{ color: "#0b1220", fontWeight: 700, fontSize: "1.05rem" }}>
            {formatCurrency(activeLeaseRentTotal)}
          </div>
          <div className="rc-kpi-subtext" style={{ color: "#4b5563", fontSize: "0.75rem", marginTop: 2 }}>
            Strictly from active lease records.
          </div>
        </div>

        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#111827", fontSize: "0.8rem" }}>
            Current occupied rent total
          </div>
          <div className="rc-kpi-value" style={{ color: "#0b1220", fontWeight: 700, fontSize: "1.05rem" }}>
            {formatCurrency(currentOccupiedRentTotal)}
          </div>
          <div className="rc-kpi-subtext" style={{ color: "#4b5563", fontSize: "0.75rem", marginTop: 2 }}>
            Uses active and notice-period lease rent when present.
          </div>
        </div>

        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#111827", fontSize: "0.8rem" }}>
            Collected this month
          </div>
          <div className="rc-kpi-value" style={{ color: "#0b1220", fontWeight: 700, fontSize: "1.05rem" }}>
            {formatCurrency(totalCollectedThisMonth)}
          </div>
        </div>

        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#111827", fontSize: "0.8rem" }}>
            Collection
          </div>
          <div className="rc-kpi-value" style={{ color: "#0b1220", fontWeight: 700, fontSize: "1.05rem" }}>
            {currentOccupiedRentTotal === 0 ? "--" : `${(collectionRate * 100).toFixed(0)}%`}
          </div>
        </div>
      </div>

      {importMessage && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(59,130,246,0.35)",
            background: "rgba(59,130,246,0.08)",
            color: "#0f172a",
            fontSize: "0.9rem",
          }}
        >
          {importMessage}
        </div>
      )}

      {unitResolutionError ? (
        <div
          role="alert"
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #fecdd3",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: "0.9rem",
          }}
        >
          {unitResolutionError}
        </div>
      ) : null}

      <PropertyCredibilitySummaryCard
        summary={credibilitySummary}
        leaseHref={property?.id ? `/leases?propertyId=${encodeURIComponent(String(property.id))}` : "/leases"}
      />
      <PropertyRegistryStatusCard property={property} onOpenSubmissionAssistant={() => setSubmissionAssistantOpen(true)} />

      {activeLeases.length > 0 && (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.16)",
            background: "rgba(255,255,255,0.03)",
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ color: "#0f172a", fontWeight: 700 }}>Lease risk overview</div>
            <div style={{ color: "#4b5563", fontSize: "0.82rem" }}>
              This score helps identify payment and stability risk using available lease data.
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {activeLeases.slice(0, 4).map((lease) => (
              <div
                key={lease.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(148,163,184,0.14)",
                  background: "rgba(248,250,252,0.9)",
                }}
              >
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ color: "#0f172a", fontWeight: 700 }}>
                    {resolveLeaseRiskUnitLabel(lease, displayedUnits)}
                  </div>
                  <div style={{ color: "#475569", fontSize: 12 }}>
                    {formatCurrency(resolveLeaseRiskRent(lease, displayedUnits))} / month
                    {lease.riskConfidence != null ? " • " + Math.round(lease.riskConfidence * 100) + "% confidence" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <RiskScoreBadge grade={(lease.riskGrade as any) || lease.risk?.grade || null} score={lease.riskScore ?? lease.risk?.score ?? null} compact />
                  {lease.id ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/leases/${encodeURIComponent(String(lease.id))}/ledger`)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #dbeafe",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      Ledger
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeLeases.length === 0 && (
        <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
          No active leases recorded for this property yet.
        </div>
      )}

      {/* Units table */}
      {!capsLoading && !unitsEnabled ? (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(59,130,246,0.35)",
            background: "rgba(59,130,246,0.08)",
            padding: 12,
            color: "#0f172a",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Upgrade to manage your rentals</div>
          <div style={{ fontSize: "0.9rem", color: "#475569", marginBottom: 10 }}>
            RentChain Screening is free. Rental management starts on {unitsRequiredPlanLabel}.
          </div>
          <button
            type="button"
            onClick={() => promptUnitsUpgrade("property_detail_panel_upgrade_card")}
            style={upgradeStarterButtonStyle}
          >
            Upgrade to {unitsRequiredPlanLabel}
          </button>
        </div>
      ) : (
        <>
          <div style={{ color: "#4b5563", fontSize: "0.82rem", marginBottom: 8 }}>
            The unit table shows configured unit rents. Active lease rent totals are shown separately above.
          </div>
          {showOccupancyPrompt ? (
            <div
              style={{
                marginBottom: 12,
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(37,99,235,0.18)",
                background: "rgba(37,99,235,0.06)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: "#0f172a" }}>
                Do any of these units already have active tenants?
              </div>
              <div style={{ color: "#475569", fontSize: "0.92rem", lineHeight: 1.6 }}>
                Set current occupancy now to keep your occupancy and rent views accurate. You can still upgrade later to create full lease records, tenant history, and verified reporting.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    const targetUnit = unitsNeedingOccupancySetup[0] || displayedUnits[0] || null;
                    if (targetUnit) openUnitEdit(targetUnit);
                    dismissOccupancyPrompt();
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #2563eb",
                    background: "#2563eb",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Set up current occupancy
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/pricing")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#fff",
                    color: "#0f172a",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Upgrade for full lease setup
                </button>
                <button
                  type="button"
                  onClick={dismissOccupancyPrompt}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "transparent",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          ) : null}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              overflow: "hidden",
            }}
          >
            <div className="rc-units-table-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table
                className="rc-units-table"
                style={{
                  width: "100%",
                  minWidth: 560,
                  borderCollapse: "collapse",
                  fontSize: "0.9rem",
                  color: "#0f172a",
                }}
              >
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", color: "#9ca3af" }}>
                <th className="rc-units-col-unit" style={{ textAlign: "left", padding: "10px 12px", whiteSpace: "nowrap" }}>Unit</th>
                <th className="rc-units-col-rent" style={{ textAlign: "right", padding: "10px 12px", whiteSpace: "nowrap" }}>Configured rent</th>
                <th className="rc-units-col-beds" style={{ textAlign: "center", padding: "10px 12px", whiteSpace: "nowrap" }}>Beds</th>
                <th className="rc-units-col-baths" style={{ textAlign: "center", padding: "10px 12px", whiteSpace: "nowrap" }}>Baths</th>
                <th className="rc-units-col-sqft" style={{ textAlign: "center", padding: "10px 12px", whiteSpace: "nowrap" }}>Sqft</th>
                <th className="rc-units-col-status" style={{ textAlign: "left", padding: "10px 12px", whiteSpace: "nowrap" }}>Status</th>
                <th className="rc-units-col-actions" style={{ textAlign: "left", padding: "10px 12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                if (unitsLoading) {
                  return (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "12px",
                          color: "#1f2937",
                          textAlign: "center",
                        }}
                      >
                        Loading units...
                      </td>
                    </tr>
                  );
                }

                if (displayedUnits.length === 0) {
                  return (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "12px",
                          color: "#1f2937",
                          textAlign: "center",
                        }}
                      >
                        No units recorded for this property yet.
                      </td>
                    </tr>
                  );
                }

                return displayedUnits.map((u, idx) => {
                  const unitKey = getUnitKey(u, idx);
                  const unitNum = (u as any).unitNumber || "--";
                  const bedsVal =
                    (u as any).beds ?? (u as any).bedrooms ?? (u as any).bedroomsCount ?? null;
                  const bathsVal =
                    (u as any).baths ?? (u as any).bathrooms ?? (u as any).bathroomsCount ?? null;
                  const rentVal = resolveConfiguredUnitRent(u);
                  const sqftVal = (u as any).sqft ?? null;
                  const occupancy = getUnitOccupancy(u);
                  const occupancyView = buildUnitOccupancyView(u, occupancy);
                  const occupancyTone = unitOccupancyTone(occupancy.status);
                  const occupantName = occupancyView.tenantName;
                  const leaseEndDate = occupancyView.leaseEndDate;
                  const rentDisplay =
                    rentVal !== null && rentVal !== undefined
                      ? formatCurrency(Number(rentVal) || 0)
                      : "--";
                  const bedsDisplay =
                    (u as any).bedrooms ?? (u as any).bedrooms === 0
                      ? (u as any).bedrooms
                      : "-";
                  const bathsDisplay =
                    (u as any).bathrooms ?? (u as any).bathrooms === 0
                      ? (u as any).bathrooms
                      : "-";
                  const sqftDisplay =
                    sqftVal ?? sqftVal === 0
                      ? sqftVal
                      : "-";
                  return (
                    <tr
                      key={unitKey}
                      ref={(el) => {
                        unitRowRefs.current[unitKey] = el;
                      }}
                      style={{
                        borderTop: "1px solid rgba(148,163,184,0.12)",
                        background:
                          highlightedUnitKey === unitKey
                            ? "rgba(37,99,235,0.14)"
                            : undefined,
                        color: "#0f172a",
                      }}
                    >
                      <td className="rc-units-col-unit" style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{unitNum}</td>
                      <td className="rc-units-col-rent" style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span className={rentVal !== null && rentVal !== undefined ? "" : "rc-unit-placeholder"}>
                          {rentDisplay}
                        </span>
                      </td>
                      <td className="rc-units-col-beds" style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span className={bedsVal !== null && bedsVal !== undefined ? "" : "rc-unit-placeholder"}>
                          {bedsDisplay}
                        </span>
                      </td>
                      <td className="rc-units-col-baths" style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span className={bathsVal !== null && bathsVal !== undefined ? "" : "rc-unit-placeholder"}>
                          {bathsDisplay}
                        </span>
                      </td>
                      <td className="rc-units-col-sqft" style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span className={sqftVal !== null && sqftVal !== undefined ? "" : "rc-unit-placeholder"}>
                          {sqftDisplay}
                        </span>
                      </td>
                      <td className="rc-units-col-status" style={{ padding: "10px 12px" }}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 10px",
                              borderRadius: 999,
                              border: "1px solid rgba(148,163,184,0.35)",
                              background: occupancyTone.background,
                              color: occupancyTone.color,
                              fontSize: "0.8rem",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "999px",
                                backgroundColor: occupancyTone.dot,
                              }}
                            />
                            {occupancy.label}
                          </span>
                          {occupantName ? (
                            <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                              {occupancyView.tenantHref ? (
                                <a href={occupancyView.tenantHref}>{occupantName}</a>
                              ) : (
                                occupantName
                              )}
                              {leaseEndDate ? ` · Ends ${formatDate(leaseEndDate)}` : ""}
                              {occupancyView.leaseHref ? (
                                <>
                                  {" · "}
                                  <a href={occupancyView.leaseHref}>View lease</a>
                                </>
                              ) : null}
                              {occupancyView.ledgerHref ? (
                                <>
                                  {" · "}
                                  <a href={occupancyView.ledgerHref}>Ledger</a>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          {occupancyView.reviewReason ? (
                            <div style={{ fontSize: "0.78rem", color: "#92400e" }}>
                              {occupancyView.reviewReason}
                            </div>
                          ) : null}
                          {(u as any).leaseDocument?.fileName ? (
                            <div style={{ fontSize: "0.78rem", color: "#2563eb" }}>
                              {(u as any).leaseDocument?.url ? (
                                <a href={(u as any).leaseDocument.url} target="_blank" rel="noreferrer">
                                  {isScheduleADocumentUrl((u as any).leaseDocument.url) ? "View Schedule A" : "View lease document"}
                                </a>
                              ) : (
                                `Lease document: ${String((u as any).leaseDocument.fileName)}`
                              )}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="rc-units-col-actions" style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => openUnitEdit(u)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                            }}
                          >
                            Edit
                          </button>
                          {(u as any)?.id ? (
                            <div style={{ display: "grid", gap: 4 }}>
                              <button
                                type="button"
                                onClick={() =>
                                  applicationsEnabled
                                    ? handleSendApplication(u)
                                    : openBlockedApplicationUpgrade(unitKey)
                                }
                                aria-label={`${sendApplicationActionLabel} for unit ${unitNum}`}
                                style={sendApplicationActionStyle}
                              >
                                {sendApplicationActionLabel}
                              </button>
                              {!applicationsEnabled ? (
                                <>
                                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                    Starter unlocks tenant invites and application links.
                                  </div>
                                  {renderBlockedApplicationUpgrade(unitKey)}
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rc-units-stack">
        {unitsLoading ? (
          <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>Loading units...</div>
        ) : displayedUnits.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            No units recorded for this property yet.
          </div>
        ) : (
          displayedUnits.map((u, idx) => {
            const unitKey = getUnitKey(u, idx);
            const unitNum = (u as any).unitNumber || "--";
            const bedsVal =
              (u as any).beds ?? (u as any).bedrooms ?? (u as any).bedroomsCount ?? null;
            const bathsVal =
              (u as any).baths ?? (u as any).bathrooms ?? (u as any).bathroomsCount ?? null;
            const rentVal = resolveConfiguredUnitRent(u);
            const sqftVal = (u as any).sqft ?? null;
            const occupancy = getUnitOccupancy(u);
            const occupancyView = buildUnitOccupancyView(u, occupancy);
            const occupantName = occupancyView.tenantName;
            const leaseEndDate = occupancyView.leaseEndDate;
            const rentDisplay =
              rentVal !== null && rentVal !== undefined
                ? formatCurrency(Number(rentVal) || 0)
                : "--";
            const bedsDisplay =
              (u as any).bedrooms ?? (u as any).bedrooms === 0
                ? (u as any).bedrooms
                : "-";
            const bathsDisplay =
              (u as any).bathrooms ?? (u as any).bathrooms === 0
                ? (u as any).bathrooms
                : "-";
            const sqftDisplay =
              sqftVal ?? sqftVal === 0
                ? sqftVal
                : "-";
            return (
              <div
                key={unitKey}
                ref={(el) => {
                  unitCardRefs.current[unitKey] = el;
                }}
                className="rc-unit-card"
                style={{
                  background:
                    highlightedUnitKey === unitKey
                      ? "rgba(37,99,235,0.14)"
                      : undefined,
                }}
              >
                <div className="rc-unit-card-row">
                  <div>
                    <div className="rc-unit-label">Unit #</div>
                    <div className="rc-unit-value">{unitNum}</div>
                  </div>
                  <div>
                    <div className="rc-unit-label">Status</div>
                    <div className="rc-unit-value">{occupancy.label}</div>
                    {occupantName ? (
                      <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: 4 }}>
                        {occupancyView.tenantHref ? (
                          <a href={occupancyView.tenantHref}>{occupantName}</a>
                        ) : (
                          occupantName
                        )}
                        {leaseEndDate ? ` · Ends ${formatDate(leaseEndDate)}` : ""}
                        {occupancyView.leaseHref ? (
                          <>
                            {" · "}
                            <a href={occupancyView.leaseHref}>View lease</a>
                          </>
                        ) : null}
                        {occupancyView.ledgerHref ? (
                          <>
                            {" · "}
                            <a href={occupancyView.ledgerHref}>Ledger</a>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {occupancyView.reviewReason ? (
                      <div style={{ fontSize: "0.78rem", color: "#92400e", marginTop: 4 }}>
                        {occupancyView.reviewReason}
                      </div>
                    ) : null}
                    {(u as any).leaseDocument?.fileName ? (
                      <div style={{ fontSize: "0.78rem", color: "#2563eb", marginTop: 4 }}>
                        {(u as any).leaseDocument?.url ? (
                          <a href={(u as any).leaseDocument.url} target="_blank" rel="noreferrer">
                            {isScheduleADocumentUrl((u as any).leaseDocument.url) ? "View Schedule A" : "View lease document"}
                          </a>
                        ) : (
                          `Lease document: ${String((u as any).leaseDocument.fileName)}`
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="rc-unit-card-row rc-unit-card-specs" style={{ marginTop: 8 }}>
                  <div>
                    <div className="rc-unit-label">Configured rent</div>
                    <div className={`rc-unit-value ${rentVal !== null && rentVal !== undefined ? "" : "rc-unit-placeholder"}`}>
                      {rentDisplay}
                    </div>
                  </div>
                  <div>
                    <div className="rc-unit-label">Beds</div>
                    <div className={`rc-unit-value ${bedsVal !== null && bedsVal !== undefined ? "" : "rc-unit-placeholder"}`}>
                      {bedsDisplay}
                    </div>
                  </div>
                  <div>
                    <div className="rc-unit-label">Baths</div>
                    <div className={`rc-unit-value ${bathsVal !== null && bathsVal !== undefined ? "" : "rc-unit-placeholder"}`}>
                      {bathsDisplay}
                    </div>
                  </div>
                  <div>
                    <div className="rc-unit-label">Sqft</div>
                    <div className={`rc-unit-value ${sqftVal !== null && sqftVal !== undefined ? "" : "rc-unit-placeholder"}`}>
                      {sqftDisplay}
                    </div>
                  </div>
                </div>
                <div className="rc-unit-actions">
                  <button
                    type="button"
                    onClick={() => openUnitEdit(u)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Edit
                  </button>
                  {(u as any)?.id ? (
                    <div style={{ display: "grid", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() =>
                          applicationsEnabled
                            ? handleSendApplication(u)
                            : openBlockedApplicationUpgrade(unitKey)
                        }
                        aria-label={`${sendApplicationActionLabel} for unit ${unitNum}`}
                        style={sendApplicationActionStyle}
                      >
                        {sendApplicationActionLabel}
                      </button>
                      {!applicationsEnabled ? (
                        <>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            Starter unlocks tenant invites and application links.
                          </div>
                          {renderBlockedApplicationUpgrade(unitKey)}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
        </>
      )}
      </div>
      <UnitEditModal
        open={!!editingUnit}
        unit={editingUnit}
        onClose={() => setEditingUnit(null)}
        onSaved={(updated) => {
          const editingKey = String(editingUnit?.id || editingUnit?.unitId || editingUnit?.uid || "").trim();
          const updatedKey = String(updated?.id || updated?.unitId || updated?.uid || "").trim();
          if (!isPersistedUnitId(updated)) {
            setUnitResolutionError("This unit is not ready for occupancy updates yet. Refresh the property after saving units, then try again.");
            showToast({
              title: "Unit not ready",
              description: "Refresh the property after saving units, then try again.",
              variant: "warning",
            });
            return;
          }
          setUnits((prev) =>
            prev.map((u) => {
              const currentKey = String(u?.id || u?.unitId || u?.uid || "").trim();
              return currentKey === updatedKey || currentKey === editingKey ? { ...u, ...updated } : u;
            })
          );
          setEditingUnit(null);
        }}
      />
      <SendApplicationModal
        open={!!sendAppUnit}
        propertyId={property?.id || null}
        propertyName={property?.name || property?.addressLine1 || null}
        properties={
          property?.id
            ? [
                {
                  id: String(property.id),
                  name: property?.name || property?.addressLine1 || "Selected property",
                },
              ]
            : []
        }
        units={(units || [])
          .map((u: any) => ({
            id: String(u?.id || u?.unitId || u?.uid || ""),
            name: u?.unitNumber || u?.label || u?.name || u?.unit || "Unit",
          }))
          .filter((u: any) => u.id)}
        initialUnitId={(sendAppUnit as any)?.id ? String((sendAppUnit as any).id) : null}
        allowGeneration={applicationsEnabled}
        lockedMessage={`${applicationsRequiredPlanLabel} unlocks tenant invites and secure application links for each unit.`}
        onUpgradeRequired={() => {
          promptApplicationsUpgrade("property_detail_panel");
          setSendAppUnit(null);
        }}
        unit={sendAppUnit}
        onClose={() => setSendAppUnit(null)}
      />
      <HalifaxRegistrySubmissionAssistant
        open={submissionAssistantOpen}
        property={property}
        onClose={() => setSubmissionAssistantOpen(false)}
      />
      {editPropertyOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit property details"
          onMouseDown={() => {
            if (isSavingPropertyEdit) return;
            setEditPropertyOpen(false);
            setEditPropertyError(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1200,
          }}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>Edit property details</div>
              <div style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.5 }}>
                Update the core address and naming details landlords rely on every day.
              </div>
            </div>

            <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
              Property name
              <input
                value={editPropertyForm.name}
                onChange={(event) =>
                  setEditPropertyForm((current) => ({ ...current, name: event.target.value }))
                }
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
              Address line 1
              <input
                value={editPropertyForm.addressLine1}
                onChange={(event) =>
                  setEditPropertyForm((current) => ({ ...current, addressLine1: event.target.value }))
                }
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
              Address line 2
              <input
                value={editPropertyForm.addressLine2}
                onChange={(event) =>
                  setEditPropertyForm((current) => ({ ...current, addressLine2: event.target.value }))
                }
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
            </label>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
                City
                <input
                  value={editPropertyForm.city}
                  onChange={(event) =>
                    setEditPropertyForm((current) => ({ ...current, city: event.target.value }))
                  }
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
                Province
                <input
                  value={editPropertyForm.province}
                  onChange={(event) =>
                    setEditPropertyForm((current) => ({ ...current, province: event.target.value }))
                  }
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
                Postal code
                <input
                  value={editPropertyForm.postalCode}
                  onChange={(event) =>
                    setEditPropertyForm((current) => ({ ...current, postalCode: event.target.value }))
                  }
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
                Country
                <input
                  value={editPropertyForm.country}
                  onChange={(event) =>
                    setEditPropertyForm((current) => ({ ...current, country: event.target.value }))
                  }
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              </label>
            </div>

            <div
              style={{
                borderRadius: 12,
                border: "1px solid #dbe4f0",
                background: "#f8fbff",
                padding: 12,
                display: "grid",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setEditComplianceExpanded((current) => !current)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  color: "#0f172a",
                }}
              >
                <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>Compliance &amp; Registry (Optional)</span>
                <span style={{ fontSize: "0.8rem", color: "#475569" }}>
                  {editComplianceExpanded ? "Hide" : "Add details"}
                </span>
              </button>
              {editComplianceExpanded ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
                    Property Identifier (PID)
                    <input
                      value={editPropertyForm.pid}
                      onChange={(event) =>
                        setEditPropertyForm((current) => ({ ...current, pid: event.target.value }))
                      }
                      placeholder="Optional PID"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                  </label>
                  <div style={{ color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>
                    Used for municipal registry matching and property verification in supported jurisdictions.
                    Adding a PID can improve automatic matching and reduce manual review.
                  </div>
                </div>
              ) : null}
            </div>

            {editPropertyError ? (
              <div
                style={{
                  border: "1px solid rgba(239,68,68,0.28)",
                  background: "rgba(239,68,68,0.08)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  color: "#b91c1c",
                  fontSize: "0.9rem",
                }}
              >
                {editPropertyError}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setEditPropertyOpen(false);
                  setEditPropertyError(null);
                }}
                disabled={isSavingPropertyEdit}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "#fff",
                  color: "#0f172a",
                  cursor: isSavingPropertyEdit ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSavePropertyEdit();
                }}
                disabled={isSavingPropertyEdit}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(37,99,235,0.22)",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: isSavingPropertyEdit ? "not-allowed" : "pointer",
                }}
              >
                {isSavingPropertyEdit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <UnitsCsvPreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPendingFile(null);
          setPendingFilename("");
          setUnitCsvPreviewRows([]);
          setUnitCsvIssues([]);
        }}
        onConfirm={confirmImport}
        filename={pendingFilename}
        headers={previewHeaders}
        rows={previewRows}
        previewRows={unitCsvPreviewRows}
        issues={unitCsvIssues}
        isImporting={isImporting}
      />
    </>
  );
};



