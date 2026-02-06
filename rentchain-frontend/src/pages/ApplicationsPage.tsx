import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, Section, Input, Button, Pill } from "../components/ui/Ui";
import { spacing, colors, text, radius } from "../styles/tokens";
import { fetchProperties } from "../api/propertiesApi";
import {
  fetchRentalApplications,
  fetchRentalApplication,
  updateRentalApplicationStatus,
  fetchScreeningQuote,
  createScreeningCheckout,
  fetchScreening,
  fetchScreeningResult,
  fetchScreeningEvents,
  fetchScreeningOrderReport,
  adminMarkScreeningComplete,
  adminMarkScreeningFailed,
  adminRecomputeScreening,
  exportScreeningReport,
  type RentalApplication,
  type RentalApplicationStatus,
  type RentalApplicationSummary,
  type ScreeningQuote,
  type ScreeningPipeline,
  type ScreeningResult,
  type ScreeningEvent,
} from "@/api/rentalApplicationsApi";
import { useToast } from "../components/ui/ToastProvider";
import { useCapabilities } from "@/hooks/useCapabilities";
import { track } from "@/lib/analytics";
import { useAuth } from "../context/useAuth";
import { ResponsiveMasterDetail } from "@/components/layout/ResponsiveMasterDetail";
import { useOnboardingState } from "../hooks/useOnboardingState";
import { SendApplicationModal } from "../components/properties/SendApplicationModal";
import { unitsForProperty } from "../lib/propertyCounts";
import { getApplicationPrereqState } from "../lib/applicationPrereqs";
import { CreatePropertyFirstModal } from "../components/properties/CreatePropertyFirstModal";
import { buildCreatePropertyUrl, buildReturnTo } from "../lib/propertyGate";
import "./ApplicationsPage.css";
import { SendScreeningInviteModal } from "../components/screening/SendScreeningInviteModal";
import { ScreeningStatusBadge } from "../components/screening/ScreeningStatusBadge";

const statusOptions: RentalApplicationStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "DECLINED",
  "CONDITIONAL_COSIGNER",
  "CONDITIONAL_DEPOSIT",
];

type PropertyOption = { id: string; name: string };

const AI_FLAG_LABELS: Record<string, string> = {
  INCOME_STRESS: "Income stress",
  ADDRESS_GAP: "Address gap",
  EMPLOYMENT_SHORT_TENURE: "Short employment tenure",
  REFERENCE_WEAK: "Weak references",
  IDENTITY_MISMATCH_HINT: "Identity mismatch hint",
};

const SCREENING_REASON_LABELS: Record<string, string> = {
  ELIGIBLE: "Eligible for screening.",
  MISSING_TENANT_PROFILE: "Tenant profile details are incomplete.",
  APPLICATION_STATUS_NOT_READY: "Application must be submitted before screening.",
  MISSING_CONSENT: "Applicant consent is required before screening.",
  SCREENING_ALREADY_PAID: "Screening has already been paid for.",
  LANDLORD_NOT_AUTHORIZED: "You don’t have access to start screening for this application.",
};

const formatScreeningStatus = (value?: string | null) => {
  if (!value) return "unknown";
  return value.replace(/_/g, " ");
};

const formatEligibilityReason = (value?: string | null) => {
  if (!value) return null;
  return SCREENING_REASON_LABELS[value] || value;
};

const formatScreeningEventLabel = (value: ScreeningEvent["type"]) => {
  switch (value) {
    case "paid":
      return "Paid";
    case "processing_started":
      return "Processing started";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "eligibility_checked":
      return "Eligibility checked";
    case "checkout_blocked":
      return "Checkout blocked";
    case "webhook_ignored":
      return "Webhook ignored";
    case "manual_complete":
      return "Manual complete";
    case "manual_fail":
      return "Manual fail";
    case "recomputed":
      return "Recomputed";
    case "consent_created":
      return "Tenant started";
    case "kba_in_progress":
      return "Identity verification in progress";
    case "kba_failed":
      return "KBA failed";
    case "report_ready":
      return "Report ready";
    default:
      return value.replace(/_/g, " ");
  }
};

const ApplicationsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<RentalApplicationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RentalApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyRecords, setPropertyRecords] = useState<any[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const propertiesLoaded = !propertiesLoading;
  const propertiesReady = propertiesLoaded && !propertiesError;
  const { features, loading: loadingCaps } = useCapabilities();
  const { user } = useAuth();
  const [screeningQuote, setScreeningQuote] = useState<ScreeningQuote | null>(null);
  const [screeningQuoteDetail, setScreeningQuoteDetail] = useState<string | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningRunning, setScreeningRunning] = useState(false);
  const [scoreAddOn, setScoreAddOn] = useState(false);
  const [expeditedAddOn, setExpeditedAddOn] = useState(false);
  const [screeningTier, setScreeningTier] = useState<"basic" | "verify" | "verify_ai">("verify_ai");
  const [screeningStatus, setScreeningStatus] = useState<ScreeningPipeline | null>(null);
  const [screeningStatusLoading, setScreeningStatusLoading] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ScreeningResult | null>(null);
  const [manualCompleteOpen, setManualCompleteOpen] = useState(false);
  const [manualFailOpen, setManualFailOpen] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualOverall, setManualOverall] = useState<"pass" | "review" | "fail">("pass");
  const [manualScoreBand, setManualScoreBand] = useState("");
  const [manualFlags, setManualFlags] = useState("");
  const [manualReportText, setManualReportText] = useState("");
  const [manualFailureCode, setManualFailureCode] = useState("");
  const [manualFailureDetail, setManualFailureDetail] = useState("");
  const [screeningEvents, setScreeningEvents] = useState<ScreeningEvent[]>([]);
  const [screeningEventsLoading, setScreeningEventsLoading] = useState(false);
  const [screeningEventsRefreshedAt, setScreeningEventsRefreshedAt] = useState<number | null>(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [exportShareUrl, setExportShareUrl] = useState<string | null>(null);
  const [exportExpiresAt, setExportExpiresAt] = useState<number | null>(null);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportPreviewSource, setExportPreviewSource] = useState<"applications" | "onboarding">("applications");
  const [orderReportLoading, setOrderReportLoading] = useState(false);
  const [sendAppOpen, setSendAppOpen] = useState(false);
  const [sendAppPropertyId, setSendAppPropertyId] = useState<string | null>(null);
  const [propertyGateOpen, setPropertyGateOpen] = useState(false);
  const [screeningInviteOpen, setScreeningInviteOpen] = useState(false);
  const screeningSectionRef = React.useRef<HTMLDivElement | null>(null);
  const onboarding = useOnboardingState();
  const propertiesCount = propertyRecords.length;
  const unitsCount = propertyRecords.reduce((sum, p) => sum + unitsForProperty(p), 0);
  const prereqState = getApplicationPrereqState({
    propertiesCount,
    unitsCount,
    selectedPropertyId: propertyFilter || null,
    requireSelection: true,
  });

  const screeningOptions = [
    { value: "basic", label: "Basic", priceLabel: "$19.99" },
    { value: "verify", label: "Verify", priceLabel: "$29.99" },
    { value: "verify_ai", label: "Verify + AI", priceLabel: "$39.99", recommended: true },
  ] as const;

  const computedTotalCents = useMemo(() => {
    const base =
      screeningTier === "basic" ? 1999 : screeningTier === "verify" ? 2999 : 3999;
    const score = scoreAddOn ? 499 : 0;
    const expedited = expeditedAddOn ? 999 : 0;
    return base + score + expedited;
  }, [screeningTier, scoreAddOn, expeditedAddOn]);
  const effectiveTotalCents = screeningQuote?.totalAmountCents ?? computedTotalCents;

  const screeningBadge = useMemo(() => {
    const eventTypes = new Set(screeningEvents.map((event) => event.type));
    if (eventTypes.has("report_ready")) return { label: "Report ready", tone: "success" as const };
    if (eventTypes.has("completed")) return { label: "Completed", tone: "success" as const };
    if (eventTypes.has("kba_failed") || eventTypes.has("failed")) {
      return { label: "Failed — Manual verification required", tone: "danger" as const };
    }
    if (eventTypes.has("kba_in_progress")) {
      return { label: "Identity verification in progress", tone: "info" as const };
    }
    if (eventTypes.has("consent_created")) return { label: "Tenant started", tone: "info" as const };
    const status = screeningStatus?.status || detail?.screeningStatus || null;
    if (status === "processing") return { label: "Identity verification in progress", tone: "info" as const };
    if (status === "complete") return { label: "Completed", tone: "success" as const };
    if (status === "failed") return { label: "Failed — Manual verification required", tone: "danger" as const };
    if (status === "paid") return { label: "Sent", tone: "neutral" as const };
    if (eventTypes.has("paid")) return { label: "Sent", tone: "neutral" as const };
    return null;
  }, [detail?.screeningStatus, screeningEvents, screeningStatus?.status]);

  const orderReportReady =
    screeningEvents.some((event) => event.type === "report_ready") ||
    screeningStatus?.status === "complete" ||
    detail?.screeningStatus === "complete";

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";
  const selectedLabel = detail
    ? `${detail.applicant.firstName} ${detail.applicant.lastName}`.trim()
    : "Application";
  const screeningOrderId = detail?.screening?.orderId || null;

  const loadScreeningStatus = async (applicationId: string) => {
    setScreeningStatusLoading(true);
    try {
      const res = await fetchScreening(applicationId);
      if (res?.ok) {
        setScreeningStatus(res.screening || null);
      }
    } catch {
      setScreeningStatus(null);
    } finally {
      setScreeningStatusLoading(false);
    }
  };

  const loadScreeningEvents = async (applicationId: string) => {
    setScreeningEventsLoading(true);
    try {
      const res = await fetchScreeningEvents(applicationId, 50);
      if (res?.ok) {
        setScreeningEvents(res.events || []);
      } else {
        setScreeningEvents([]);
      }
    } catch {
      setScreeningEvents([]);
    } finally {
      setScreeningEventsLoading(false);
    }
  };

  const refreshSelectedApplication = async (applicationId?: string | null) => {
    const id = String(applicationId || "").trim();
    if (!id) return;
    setExportShareUrl(null);
    setExportExpiresAt(null);
    setLoadingDetail(true);
    try {
      const app = await fetchRentalApplication(id);
      setDetail(app);
      await loadScreeningStatus(id);
      await loadScreeningEvents(id);
      setScreeningEventsRefreshedAt(Date.now());
      if (app?.screeningStatus === "complete" && app?.screeningResultId) {
        const res = await fetchScreeningResult(id);
        if (res.ok) {
          setResultData(res.result || null);
          setResultError(null);
        }
      } else {
        setResultData(null);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load application details.");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const loadProperties = async () => {
      try {
        setPropertiesLoading(true);
        setPropertiesError(null);
        const res: any = await fetchProperties();
        const list = Array.isArray(res?.properties)
          ? res.properties
          : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res)
          ? res
          : [];
        if (!alive) return;
        if (import.meta.env.DEV) {
          console.debug("[applications] properties", {
            count: list.length,
            sample: list[0],
          });
        }
        setPropertyRecords(list);
        setProperties(
          list
            .map((p: any) => ({
              id: String(p.id || p.propertyId || p.uid || ""),
              name: p.name || p.addressLine1 || p.label || "Property",
            }))
            .filter((p: PropertyOption) => Boolean(p.id))
        );
      } catch {
        if (!alive) return;
        setPropertiesError("Couldn’t load properties. Retry.");
        setPropertyRecords([]);
        setProperties([]);
      } finally {
        if (alive) setPropertiesLoading(false);
      }
    };
    void loadProperties();
    return () => {
      alive = false;
    };
  }, []);

  const retryProperties = useCallback(async () => {
    try {
      setPropertiesLoading(true);
      setPropertiesError(null);
      const res: any = await fetchProperties();
      const list = Array.isArray(res?.properties)
        ? res.properties
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : [];
      setPropertyRecords(list);
      setProperties(
        list
          .map((p: any) => ({
            id: String(p.id || p.propertyId || p.uid || ""),
            name: p.name || p.addressLine1 || p.label || "Property",
          }))
          .filter((p: PropertyOption) => Boolean(p.id))
      );
    } catch {
      setPropertiesError("Couldn’t load properties. Retry.");
    } finally {
      setPropertiesLoading(false);
    }
  }, []);

  if (import.meta.env.DEV) {
    console.debug("[applications] properties state", {
      loaded: propertiesLoaded,
      count: propertiesCount,
      error: propertiesError,
    });
  }

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchRentalApplications({
          propertyId: propertyFilter || undefined,
          status: statusFilter || undefined,
        });
        if (!alive) return;
        setApplications(list || []);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || "Failed to load applications.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [propertyFilter, statusFilter, selectedId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedId = params.get("applicationId");
    if (!requestedId) return;
    if (requestedId !== selectedId) {
      setSelectedId(requestedId);
      void refreshSelectedApplication(requestedId);
      return;
    }
    void refreshSelectedApplication(requestedId);
  }, [location.search, selectedId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("exportPreview") === "1") {
      setExportPreviewSource("onboarding");
      setExportPreviewOpen(true);
    }
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("openSendApplication") !== "1") return;
    if (!propertiesLoaded) return;
    if (propertiesError) {
      showToast({ message: "Couldn’t load properties. Retry.", variant: "error" });
      return;
    }

    const autoSelect = params.get("autoSelectProperty") === "1";
    if (autoSelect && properties[0]?.id && !propertyFilter) {
      setPropertyFilter(properties[0].id);
    }

    const nextSelectedId = propertyFilter || (autoSelect ? properties[0]?.id : null) || null;
    const prereq = getApplicationPrereqState({
      propertiesCount,
      unitsCount,
      selectedPropertyId: nextSelectedId,
      requireSelection: true,
    });

    if (prereq.missingProperty && propertiesReady && propertiesCount === 0) {
      setPropertyGateOpen(true);
      params.delete("openSendApplication");
      params.delete("autoSelectProperty");
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
      return;
    }
    if (prereq.missingSelectedProperty) {
      showToast({ message: "Select a property first.", variant: "error" });
      params.delete("openSendApplication");
      params.delete("autoSelectProperty");
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
      return;
    }

    const nextPropertyId = nextSelectedId;
    setSendAppPropertyId(nextPropertyId);
    setSendAppOpen(true);
    params.delete("openSendApplication");
    params.delete("autoSelectProperty");
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [
    location.pathname,
    location.search,
    navigate,
    properties,
    propertyFilter,
    propertiesCount,
    propertiesError,
    unitsCount,
    propertiesLoaded,
    propertiesReady,
    showToast,
  ]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setScreeningQuote(null);
      setScreeningQuoteDetail(null);
      return;
    }
    void refreshSelectedApplication(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!detail?.id) {
      setScreeningStatus(null);
      setScreeningEvents([]);
      return;
    }
    setScreeningStatus({
      status: detail.screeningStatus ?? null,
      paidAt: detail.screeningPaidAt ?? null,
      startedAt: detail.screeningStartedAt ?? null,
      completedAt: detail.screeningCompletedAt ?? null,
      lastUpdatedAt: detail.screeningLastUpdatedAt ?? null,
      provider: detail.screeningProvider ?? null,
      summary: detail.screeningResultSummary ?? null,
      resultId: detail.screeningResultId ?? null,
    });
    void loadScreeningStatus(detail.id);
    void loadScreeningEvents(detail.id);
  }, [detail?.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const screeningStatus = params.get("screening");
    if (!screeningStatus) return;
    if (screeningStatus === "success") {
      showToast({ message: "Payment received. Screening is processing.", variant: "success" });
      if (selectedId) {
        void refreshSelectedApplication(selectedId);
      }
    } else if (screeningStatus === "cancelled") {
      showToast({ message: "Payment cancelled.", variant: "error" });
    }
    params.delete("screening");
    params.delete("orderId");
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate, selectedId, showToast]);

  useEffect(() => {
    const loadQuote = async () => {
      if (!selectedId) return;
      setScreeningLoading(true);
      setScreeningQuote(null);
      setScreeningQuoteDetail(null);
      try {
        const res = await fetchScreeningQuote(selectedId, {
          screeningTier,
          addons: [scoreAddOn ? "credit_score" : null, expeditedAddOn ? "expedited" : null].filter(
            Boolean
          ) as string[],
          totalAmount: computedTotalCents / 100,
          serviceLevel:
            screeningTier === "basic"
              ? "SELF_SERVE"
              : screeningTier === "verify"
              ? "VERIFIED"
              : "VERIFIED_AI",
          scoreAddOn,
        });
        if (res.ok) {
          setScreeningQuote(res.data || null);
        } else {
          setScreeningQuote(null);
          setScreeningQuoteDetail(res.detail || "Screening not eligible.");
        }
      } catch (err: any) {
        setScreeningQuote(null);
        setScreeningQuoteDetail(err?.message || "Failed to load screening quote.");
      } finally {
        setScreeningLoading(false);
      }
    };
    void loadQuote();
  }, [selectedId, screeningTier, scoreAddOn, expeditedAddOn, computedTotalCents]);

  useEffect(() => {
    if (!resultModalOpen || !detail?.id) return;
    let active = true;
    setResultLoading(true);
    setResultError(null);
    setResultData(null);
    fetchScreeningResult(detail.id)
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          setResultData(res.result || null);
        } else {
          setResultError(res.error || "Failed to load screening result.");
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setResultError(err?.message || "Failed to load screening result.");
      })
      .finally(() => {
        if (active) setResultLoading(false);
      });
    return () => {
      active = false;
    };
  }, [detail?.id, resultModalOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return applications;
    const q = search.toLowerCase();
    return applications.filter((a) => {
      const name = (a.applicantName || "").toLowerCase();
      const email = (a.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [applications, search]);

  const handleSelectApplication = (applicationId: string) => {
    setSelectedId(applicationId);
    navigate(`/applications?applicationId=${applicationId}`);
  };

  const handleManualComplete = async () => {
    if (!detail?.id) return;
    setManualSubmitting(true);
    try {
      const flags = manualFlags
        .split(",")
        .map((flag) => flag.trim())
        .filter(Boolean);
      const res = await adminMarkScreeningComplete(detail.id, {
        overall: manualOverall,
        scoreBand: manualScoreBand ? (manualScoreBand.toUpperCase() as any) : undefined,
        flags: flags.length ? flags : undefined,
        reportText: manualReportText.trim() || undefined,
      });
      if (!res.ok) {
        showToast({ message: res.error || "Unable to mark screening complete.", variant: "error" });
        return;
      }
      showToast({ message: "Screening marked complete.", variant: "success" });
      setManualCompleteOpen(false);
      setManualReportText("");
      setManualFlags("");
      setManualScoreBand("");
      await refreshSelectedApplication(detail.id);
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleManualFail = async () => {
    if (!detail?.id) return;
    if (!manualFailureCode.trim()) {
      showToast({ message: "Failure code is required.", variant: "error" });
      return;
    }
    setManualSubmitting(true);
    try {
      const res = await adminMarkScreeningFailed(detail.id, {
        failureCode: manualFailureCode.trim(),
        failureDetail: manualFailureDetail.trim() || undefined,
      });
      if (!res.ok) {
        showToast({ message: res.error || "Unable to mark screening failed.", variant: "error" });
        return;
      }
      showToast({ message: "Screening marked failed.", variant: "success" });
      setManualFailOpen(false);
      setManualFailureCode("");
      setManualFailureDetail("");
      await refreshSelectedApplication(detail.id);
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleRecomputeScreening = async () => {
    if (!detail?.id) return;
    setManualSubmitting(true);
    try {
      const res = await adminRecomputeScreening(detail.id);
      if (!res.ok) {
        showToast({ message: res.error || "Unable to recompute screening status.", variant: "error" });
        return;
      }
      showToast({ message: `Screening recomputed: ${res.from} → ${res.to}`, variant: "success" });
      await refreshSelectedApplication(detail.id);
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleCreateApplication = (autoSelectProperty: boolean = false) => {
    if (!propertiesLoaded) {
      showToast({ message: "Loading properties…", variant: "info" });
      return;
    }
    if (propertiesError) {
      showToast({ message: "Couldn’t load properties. Retry.", variant: "error" });
      return;
    }
    const nextSelectedId = propertyFilter || (autoSelectProperty ? properties[0]?.id : null) || null;
    const prereq = getApplicationPrereqState({
      propertiesCount,
      unitsCount,
      selectedPropertyId: nextSelectedId,
      requireSelection: true,
    });

    if (prereq.missingProperty && propertiesReady && propertiesCount === 0) {
      setPropertyGateOpen(true);
      return;
    }
    if (prereq.missingSelectedProperty) {
      if (autoSelectProperty && properties[0]?.id) {
        setPropertyFilter(properties[0].id);
        setSendAppPropertyId(properties[0].id);
        setSendAppOpen(true);
        return;
      }
      showToast({ message: "Select a property first.", variant: "error" });
      return;
    }
    setSendAppPropertyId(nextSelectedId);
    setSendAppOpen(true);
  };

  const handleRowScreen = (applicationId: string) => {
    handleSelectApplication(applicationId);
    window.setTimeout(() => {
      screeningSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const handleExportReport = async (copyOnly: boolean) => {
    if (!detail?.id) return;
    if (!features?.exports_basic && !isAdmin) {
      setExportPreviewSource("applications");
      setExportPreviewOpen(true);
      return;
    }
    setExportingReport(true);
    try {
      const res = await exportScreeningReport(detail.id);
      if (!res.ok || !res.shareUrl) {
        showToast({ message: res.error || "Unable to export report.", variant: "error" });
        return;
      }
      setExportShareUrl(res.shareUrl || null);
      setExportExpiresAt(res.expiresAt || null);
      track("exports_export_success", { source: "applications" });
      onboarding.markStepComplete("exportPreviewed", "explicit");
      if (copyOnly) {
        await navigator.clipboard?.writeText(res.shareUrl);
        showToast({ message: "Link copied.", variant: "success" });
      } else {
        window.open(res.shareUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      showToast({ message: err?.message || "Unable to export report.", variant: "error" });
    } finally {
      setExportingReport(false);
    }
  };

  const handleViewOrderReport = async () => {
    if (!screeningOrderId) return;
    setOrderReportLoading(true);
    try {
      const res = await fetchScreeningOrderReport(screeningOrderId);
      if (!res.ok || !res.url) {
        showToast({ message: res.error || "Report not ready.", variant: "error" });
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      showToast({ message: err?.message || "Unable to open report.", variant: "error" });
    } finally {
      setOrderReportLoading(false);
    }
  };

  useEffect(() => {
    if (!exportPreviewOpen) return;
    track("exports_preview_opened", { source: exportPreviewSource, gated: !features?.exports_basic && !isAdmin });
    onboarding.markStepComplete("exportPreviewed", "explicit");
  }, [exportPreviewOpen, exportPreviewSource, features?.exports_basic, isAdmin]);

  const previewText = useMemo(() => {
    const raw =
      resultData?.reportText ||
      detail?.screening?.result?.notes ||
      detail?.screeningResultSummary ||
      "";
    if (!raw) return "";
    const lines = String(raw).split("\n").filter(Boolean);
    return lines.slice(0, 10).join("\n");
  }, [detail?.screening?.result?.notes, detail?.screeningResultSummary, resultData?.reportText]);

  const handleOpenPricing = () => {
    const url = "/pricing?plan=pro&source=screening_export_preview";
    track("exports_upgrade_clicked", { source: "applications", capability: "exports_basic" });
    if (typeof window !== "undefined") {
      window.location.assign(url);
    }
  };

  const handleSampleOpen = () => {
    track("exports_sample_opened", { source: "applications" });
    if (typeof window !== "undefined") {
      const win = window.open(
        "/sample/screening_report_sample.pdf",
        "_blank",
        "noopener,noreferrer"
      );
      if (!win) {
        showToast({
          message: "Sample report unavailable",
          description: "Please allow popups to view the sample report.",
          variant: "error",
        });
      }
    }
  };

  const setStatus = async (status: RentalApplicationStatus) => {
    if (!detail) return;
    try {
      const updated = await updateRentalApplicationStatus(detail.id, status, detail.landlordNote ?? null);
      setDetail(updated);
      setApplications((prev) => prev.map((a) => (a.id === detail.id ? { ...a, status } : a)));
      showToast({ message: `Status set to ${status}`, variant: "success" });
    } catch (err: any) {
      showToast({ message: "Failed to update status", description: err?.message || "", variant: "error" });
    }
  };

  const runScreeningRequest = async () => {
    if (!detail) return;
    setScreeningRunning(true);
    try {
      const addons = [scoreAddOn ? "credit_score" : null, expeditedAddOn ? "expedited" : null].filter(
        Boolean
      ) as string[];
      const res = await createScreeningCheckout(detail.id, {
        screeningTier,
        addons,
        totalAmount: effectiveTotalCents / 100,
        scoreAddOn,
        serviceLevel:
          screeningTier === "basic"
            ? "SELF_SERVE"
            : screeningTier === "verify"
            ? "VERIFIED"
            : "VERIFIED_AI",
      });
      if (!res.ok || !res.checkoutUrl) {
        throw new Error(res.detail || res.error || "Unable to start checkout");
      }
      onboarding.markStepComplete("applicationCreated", "explicit");
      if (res.tenantInviteUrl) {
        showToast({
          message: "Tenant invite created",
          description: "We emailed the applicant a verification link.",
          variant: "success",
        });
      }
      window.location.href = res.checkoutUrl;
    } catch (err: any) {
      showToast({ message: "Screening failed", description: err?.message || "", variant: "error" });
    } finally {
      setScreeningRunning(false);
    }
  };

  return (
    <>
      <div className="rc-applications-page" style={{ display: "grid", gap: spacing.lg }}>
      <Card elevated className="rc-applications-header">
        <div className="rc-applications-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Applications</h1>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              Review submitted rental applications.
            </div>
            {propertiesError ? (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#b91c1c",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {propertiesError}
                <Button variant="secondary" onClick={() => void retryProperties()} disabled={propertiesLoading}>
                  {propertiesLoading ? "Retrying..." : "Retry"}
                </Button>
              </div>
            ) : null}
          </div>
          <Button
            variant="secondary"
            onClick={() => setScreeningInviteOpen(true)}
            disabled={!propertiesReady}
          >
            {propertiesLoaded ? "Send screening invite" : "Loading properties…"}
          </Button>
        </div>
      </Card>

      <Card elevated className="rc-applications-grid">
        <ResponsiveMasterDetail
          title={undefined}
          searchSlot={
            <div className="rc-applications-filters" style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Input
                className="rc-applications-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                style={{ width: 240 }}
              />
              <select
                className="rc-applications-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: radius.md, border: `1px solid ${colors.border}` }}
              >
                <option value="">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rc-applications-filter"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: radius.md, border: `1px solid ${colors.border}` }}
              >
                <option value="">All properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          }
          masterTitle="Applications"
          master={
            <div className="rc-applications-list">
              {loading ? (
                <div style={{ color: text.muted }}>Loading applications...</div>
              ) : error ? (
                <div style={{ color: colors.danger }}>{error}</div>
              ) : filtered.length === 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ color: text.muted }}>No applications found.</div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      track("empty_state_cta_clicked", { pageKey: "applications", ctaKey: "create_application" });
                      handleCreateApplication(false);
                    }}
                    style={{ width: "fit-content" }}
                    disabled={!propertiesReady}
                  >
                    {propertiesLoaded ? "Create application" : "Loading properties…"}
                  </Button>
                </div>
              ) : (
                <div className="rc-applications-list-scroll">
                  {filtered.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      className="rc-applications-list-item"
                      onClick={() => handleSelectApplication(app.id)}
                      style={{
                        textAlign: "left",
                        border: `1px solid ${app.id === selectedId ? colors.accent : colors.border}`,
                        background: app.id === selectedId ? "rgba(37,99,235,0.08)" : colors.card,
                        borderRadius: radius.md,
                        padding: "12px 12px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        minWidth: 0,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.primary, fontSize: 15, overflowWrap: "anywhere" }}>
                        {app.applicantName || "Applicant"}
                      </div>
                      <div style={{ color: text.muted, fontSize: 12, overflowWrap: "anywhere" }}>
                        {app.email || "No email"}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <Pill>{app.status}</Pill>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowScreen(app.id);
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: `1px solid ${colors.border}`,
                            background: colors.accentSoft,
                            color: text.primary,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Screen tenant
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
          masterDropdown={
            filtered.length ? (
              <select
                value={selectedId || ""}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  handleSelectApplication(next);
                }}
                className="rc-full-width-mobile"
              >
                <option value="">Select application</option>
                {filtered.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.applicantName || "Applicant"}
                  </option>
                ))}
              </select>
            ) : null
          }
          hasSelection={Boolean(selectedId)}
          selectedLabel={selectedLabel}
          onClearSelection={() => {
            setSelectedId(null);
            navigate("/applications");
          }}
          detail={
            <Section className="rc-applications-detail">
              {loadingDetail ? (
                <div style={{ color: text.muted }}>Loading application...</div>
              ) : !detail ? (
                <div style={{ color: text.muted }}>Select an application to view details.</div>
              ) : (
                <div style={{ display: "grid", gap: spacing.md }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 700 }}>{detail.applicant.firstName} {detail.applicant.lastName}</div>
                  <div style={{ color: text.muted, fontSize: 13 }}>{detail.applicant.email}</div>
                </div>
                <div className="rc-applications-status-row">
                  {statusOptions.map((s) => (
                    <Button key={s} variant={detail.status === s ? "primary" : "secondary"} onClick={() => void setStatus(s)}>
                      {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>

              <div ref={screeningSectionRef}>
                <Card>
                  <div className="rc-applications-card-header" style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>Screening</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {screeningOrderId && orderReportReady ? (
                        <Button
                          variant="secondary"
                          onClick={() => void handleViewOrderReport()}
                          disabled={orderReportLoading}
                        >
                          {orderReportLoading ? "Opening..." : "View report"}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        onClick={() => void refreshSelectedApplication(detail.id)}
                        disabled={!detail?.id || loadingDetail}
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                    <div className="rc-wrap-row">
                      {screeningBadge ? (
                        <ScreeningStatusBadge label={screeningBadge.label} tone={screeningBadge.tone} />
                      ) : (
                        <Pill>{formatScreeningStatus(screeningStatus?.status || detail.screeningStatus || null)}</Pill>
                      )}
                      {screeningStatusLoading ? (
                        <span style={{ fontSize: 12, color: text.subtle }}>Refreshing…</span>
                      ) : null}
                      {screeningStatus?.provider ? (
                        <span style={{ fontSize: 12, color: text.subtle }}>Provider: {screeningStatus.provider}</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 13, color: text.muted }}>
                      Last updated:{" "}
                      {screeningStatus?.lastUpdatedAt
                        ? new Date(screeningStatus.lastUpdatedAt).toLocaleString()
                        : "—"}
                    </div>
                    {screeningStatus?.summary ? (
                      <div
                        style={{
                          border: `1px solid ${colors.border}`,
                          borderRadius: radius.md,
                          padding: spacing.sm,
                          background: colors.panel,
                          display: "grid",
                          gap: 4,
                          fontSize: 14,
                        }}
                      >
                      <div>Overall: {screeningStatus.summary.overall}</div>
                      {screeningStatus.summary.scoreBand ? (
                        <div>Score band: {screeningStatus.summary.scoreBand}</div>
                      ) : null}
                      {screeningStatus.summary.flags?.length ? (
                        <div>Flags: {screeningStatus.summary.flags.join(", ")}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: text.muted }}>No screening summary yet.</div>
                  )}
                  {screeningStatus?.status === "complete" && screeningStatus?.resultId ? (
                    <div>
                      <Button variant="secondary" onClick={() => setResultModalOpen(true)}>
                        View screening result
                      </Button>
                    </div>
                  ) : null}
                  {isAdmin ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: text.subtle, marginBottom: 6 }}>
                        Admin screening controls
                      </div>
                      <div className="rc-wrap-row">
                        <Button
                          variant="primary"
                          onClick={() => setManualCompleteOpen(true)}
                          disabled={manualSubmitting || !["paid", "processing"].includes(String(screeningStatus?.status || ""))}
                        >
                          Mark complete
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setManualFailOpen(true)}
                          disabled={manualSubmitting || !["paid", "processing"].includes(String(screeningStatus?.status || ""))}
                        >
                          Mark failed
                        </Button>
                        <Button variant="ghost" onClick={() => void handleRecomputeScreening()} disabled={manualSubmitting}>
                          {manualSubmitting ? "Recomputing..." : "Recompute status"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {isAdmin ? (
                    <div>
                      <Button variant="ghost" onClick={() => void handleRecomputeScreening()} disabled={manualSubmitting}>
                        {manualSubmitting ? "Recomputing..." : "Recompute screening status"}
                      </Button>
                    </div>
                  ) : null}
                  {detail.screeningLastEligibilityCheckedAt ? (
                    <div style={{ fontSize: 13, color: text.muted }}>
                      Eligibility checked: {new Date(detail.screeningLastEligibilityCheckedAt).toLocaleString()}
                    </div>
                  ) : null}
                  {formatEligibilityReason(detail.screeningLastEligibilityReasonCode) ? (
                    <div style={{ fontSize: 13, color: text.muted }}>
                      Last eligibility reason: {formatEligibilityReason(detail.screeningLastEligibilityReasonCode)}
                    </div>
                  ) : null}
                </div>
                {!loadingCaps && features?.screening === false ? (
                  <div style={{ color: text.muted }}>
                    Screening is unavailable on your current plan.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 13, color: text.muted }}>
                      {detail.screening?.status ? `Status: ${detail.screening.status}` : "Status: NOT_REQUESTED"}
                    </div>
                    {detail.screening?.status === "COMPLETE" && detail.screening.result ? (
                      <div className="rc-applications-screening-grid">
                        {detail.screening.serviceLevel ? (
                          <div>Service level: {detail.screening.serviceLevel.replace("_", " ")}</div>
                        ) : null}
                        {detail.screening.orderId ? <div>Order ID: {detail.screening.orderId}</div> : null}
                        {typeof detail.screening.totalAmountCents === "number" ? (
                          <div>
                            Paid: ${(detail.screening.totalAmountCents / 100).toFixed(2)} {detail.screening.currency || "CAD"}
                          </div>
                        ) : typeof detail.screening.amountCents === "number" ? (
                          <div>
                            Paid: ${(detail.screening.amountCents / 100).toFixed(2)} {detail.screening.currency || "CAD"}
                          </div>
                        ) : null}
                        {detail.screening.scoreAddOn && typeof detail.screening.scoreAddOnCents === "number" ? (
                          <div>
                            Score add-on: ${(detail.screening.scoreAddOnCents / 100).toFixed(2)} {detail.screening.currency || "CAD"}
                          </div>
                        ) : null}
                        {detail.screening.paidAt ? (
                          <div>Paid at: {new Date(detail.screening.paidAt).toLocaleString()}</div>
                        ) : null}
                        <div>Provider: {detail.screening.provider || "STUB"}</div>
                        <div>Risk band: {detail.screening.result.riskBand}</div>
                        <div>Match confidence: {detail.screening.result.matchConfidence}</div>
                        <div>File found: {detail.screening.result.fileFound ? "Yes" : "No"}</div>
                        {detail.screening.result.score ? <div>Score: {detail.screening.result.score}</div> : null}
                        <div style={{ fontSize: 12, color: text.muted }}>
                          {detail.screening.result.notes || "This is a pre-approval report (stub)."}
                        </div>
                        {detail.screening.ai ? (
                          <div className="rc-applications-ai-panel" style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 8 }}>
                            <div style={{ fontWeight: 600 }}>AI Verification</div>
                            <div>Risk assessment: <Pill>{detail.screening.ai.riskAssessment}</Pill></div>
                            <div>Confidence score: {detail.screening.ai.confidenceScore}/100</div>
                            {detail.screening.ai.flags?.length ? (
                              <div>
                                Flags: {detail.screening.ai.flags.map((f) => AI_FLAG_LABELS[f] || f).join(", ")}
                              </div>
                            ) : null}
                            {detail.screening.ai.recommendations?.length ? (
                              <div>Recommendations: {detail.screening.ai.recommendations.join("; ")}</div>
                            ) : null}
                            <div style={{ fontSize: 12, color: text.muted }}>{detail.screening.ai.summary}</div>
                            <div style={{ fontSize: 12, color: text.muted }}>
                              AI Verification provides risk signals to assist decision-making.
                            </div>
                          </div>
                        ) : null}
                        <div style={{ fontSize: 12, color: text.muted }}>Receipt recorded for audit.</div>
                      </div>
                    ) : (
                      <>
                        {screeningLoading ? (
                          <div style={{ color: text.muted }}>Checking eligibility...</div>
                        ) : screeningQuote ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            <div>Price: ${(effectiveTotalCents / 100).toFixed(2)} {screeningQuote.currency}</div>
                            <div style={{ fontSize: 12, color: text.muted }}>
                              Base {screeningTier === "basic" ? "$19.99" : screeningTier === "verify" ? "$29.99" : "$39.99"}
                              {scoreAddOn ? " + Credit score $4.99" : ""}
                              {expeditedAddOn ? " + Expedited $9.99" : ""}
                            </div>
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>Screening tier</div>
                              {screeningOptions.map((opt) => (
                                <label key={opt.value} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                                  <input
                                    type="radio"
                                    name="screeningType"
                                    checked={screeningTier === opt.value}
                                    onChange={() => setScreeningTier(opt.value)}
                                  />
                                  {opt.label} — {opt.priceLabel}{opt.recommended ? " (recommended)" : ""}
                                </label>
                              ))}
                            </div>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                              <input type="checkbox" checked={scoreAddOn} onChange={(e) => setScoreAddOn(e.target.checked)} />
                              Credit score (+$4.99)
                            </label>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                              <input type="checkbox" checked={expeditedAddOn} onChange={(e) => setExpeditedAddOn(e.target.checked)} />
                              Expedited processing (+$9.99)
                            </label>
                            <Button
                              variant="primary"
                              onClick={() => void runScreeningRequest()}
                              disabled={screeningRunning}
                            >
                              {screeningRunning ? "Running..." : `Run screening ($${(effectiveTotalCents / 100).toFixed(2)})`}
                            </Button>
                          </div>
                        ) : (
                          <div style={{ color: colors.danger, fontSize: 13 }}>
                            {screeningQuoteDetail || "Screening not eligible."}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: text.muted }}>
                          This is a pre-approval report (stub). Real bureau integration coming.
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
              </div>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Timeline</div>
                  {isAdmin && screeningEventsRefreshedAt ? (
                    <div style={{ fontSize: 12, color: text.subtle }}>
                      Last refreshed: {new Date(screeningEventsRefreshedAt).toLocaleTimeString()}
                    </div>
                  ) : null}
                </div>
                {screeningEventsLoading ? (
                  <div style={{ color: text.muted, fontSize: 13 }}>Loading timeline...</div>
                ) : screeningEvents.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {screeningEvents.map((event) => (
                      <div
                        key={event.id}
                        style={{
                          border: `1px solid ${colors.border}`,
                          borderRadius: radius.md,
                          padding: spacing.sm,
                          background: colors.panel,
                          display: "grid",
                          gap: 4,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{formatScreeningEventLabel(event.type)}</div>
                        <div style={{ fontSize: 13, color: text.muted }}>
                          {event.at ? new Date(event.at).toLocaleString() : "—"}
                        </div>
                        {event.meta?.reasonCode ? (
                          <div style={{ fontSize: 13, color: text.subtle }}>Reason: {event.meta.reasonCode}</div>
                        ) : null}
                        {event.meta?.status ? (
                          <div style={{ fontSize: 13, color: text.subtle }}>Status: {event.meta.status}</div>
                        ) : null}
                        {event.meta?.from || event.meta?.to ? (
                          <div style={{ fontSize: 13, color: text.subtle }}>
                            {event.meta?.from ? `From: ${event.meta.from}` : null}
                            {event.meta?.from && event.meta?.to ? " · " : null}
                            {event.meta?.to ? `To: ${event.meta.to}` : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: text.muted, fontSize: 13 }}>No screening events recorded yet.</div>
                )}
              </Card>

              <Card>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>Consent</div>
                <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                  <div>Credit consent: {detail.consent.creditConsent ? "Yes" : "No"}</div>
                  <div>Reference consent: {detail.consent.referenceConsent ? "Yes" : "No"}</div>
                  <div>Data sharing consent: {detail.consent.dataSharingConsent ? "Yes" : "No"}</div>
                  <div>Accepted at: {detail.consent.acceptedAt ? new Date(detail.consent.acceptedAt).toLocaleString() : "-"}</div>
                </div>
              </Card>

              <Card>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>Residential history</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {detail.residentialHistory?.length ? detail.residentialHistory.map((h, idx) => (
                    <div key={idx} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.address}</div>
                      <div style={{ color: text.muted, fontSize: 13 }}>
                        {h.durationMonths ? `${h.durationMonths} months` : ""}{h.rentAmountCents ? ` · $${(h.rentAmountCents / 100).toFixed(0)}` : ""}
                      </div>
                      <div style={{ fontSize: 13 }}>Landlord: {h.landlordName || "-"} {h.landlordPhone ? `(${h.landlordPhone})` : ""}</div>
                      {h.reasonForLeaving ? <div style={{ fontSize: 13 }}>Reason: {h.reasonForLeaving}</div> : null}
                    </div>
                  )) : <div style={{ color: text.muted }}>No history provided.</div>}
                </div>
              </Card>
            </div>
              )}
            </Section>
          }
        />
      </Card>
    </div>
      {resultModalOpen && (
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
            width: "min(560px, 95vw)",
            maxHeight: "80vh",
            overflowY: "auto",
            padding: spacing.md,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Screening result</div>
            <Button variant="ghost" onClick={() => setResultModalOpen(false)}>
              Close
            </Button>
          </div>
          {resultLoading ? (
            <div style={{ color: text.muted }}>Loading…</div>
          ) : resultError ? (
            <div
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.4)",
                color: colors.danger,
                padding: spacing.sm,
                borderRadius: radius.md,
              }}
            >
              {resultError}
            </div>
          ) : resultData ? (
            <div style={{ display: "grid", gap: spacing.sm }}>
              {resultData.summary ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    background: colors.panel,
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div>Overall: {resultData.summary.overall}</div>
                  {resultData.summary.scoreBand ? (
                    <div>Score band: {resultData.summary.scoreBand}</div>
                  ) : null}
                  {resultData.summary.flags?.length ? (
                    <div>Flags: {resultData.summary.flags.join(", ")}</div>
                  ) : null}
                </div>
              ) : (
                <div style={{ color: text.muted }}>No summary provided.</div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button variant="primary" onClick={() => void handleExportReport(false)} disabled={exportingReport}>
                  {exportingReport ? "Preparing..." : `Download PDF${!features?.exports_basic && !isAdmin ? " (Pro)" : ""}`}
                </Button>
                <Button variant="secondary" onClick={() => void handleExportReport(true)} disabled={exportingReport}>
                  Copy share link
                </Button>
              </div>
              {exportShareUrl ? (
                <div style={{ fontSize: 12, color: text.subtle }}>
                  Share link ready
                  {exportExpiresAt ? ` · Expires ${new Date(exportExpiresAt).toLocaleString()}` : ""}
                </div>
              ) : null}
              {resultData.reportUrl ? (
                <a href={resultData.reportUrl} target="_blank" rel="noreferrer">
                  View report
                </a>
              ) : null}
              {resultData.reportText ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    whiteSpace: "pre-wrap",
                    fontSize: 13,
                  }}
                >
                  {resultData.reportText}
                </div>
              ) : (
                <div style={{ color: text.muted, fontSize: 12 }}>No report text available.</div>
              )}
            </div>
          ) : null}
        </Card>
      </div>
      )}
      {exportPreviewOpen && (
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
            width: "min(620px, 95vw)",
            maxHeight: "80vh",
            overflowY: "auto",
            padding: spacing.md,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Export Screening Report (Pro)</div>
            <Button variant="ghost" onClick={() => setExportPreviewOpen(false)}>
              Close
            </Button>
          </div>
          <div style={{ fontSize: 13, color: text.muted, marginBottom: spacing.sm }}>
            Download a shareable PDF for your records and compliance.
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: text.subtle, marginBottom: 6 }}>
            Included with Pro
          </div>
          <ul style={{ margin: "0 0 12px 18px", padding: 0, fontSize: 13, color: text.subtle, lineHeight: 1.6 }}>
            <li>Downloadable PDF export</li>
            <li>Share with partners or file securely</li>
            <li>Consistent formatting for audits</li>
          </ul>
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: spacing.sm,
              background: colors.panel,
              whiteSpace: "pre-wrap",
              fontSize: 13,
              minHeight: 120,
            }}
          >
            {previewText || "Preview not available yet. Upgrade to Pro to export the full report."}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: spacing.sm }}>
            <Button variant="secondary" onClick={handleSampleOpen}>
              See a sample PDF
            </Button>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: spacing.sm }}>
            <Button variant="secondary" onClick={handleOpenPricing}>
              View Pro features
            </Button>
            <Button variant="primary" onClick={handleOpenPricing}>
              Upgrade to Pro to export PDF
            </Button>
          </div>
        </Card>
      </div>
      )}
      <CreatePropertyFirstModal
        open={propertyGateOpen}
        onClose={() => setPropertyGateOpen(false)}
        onCreate={() => {
          const returnTo = buildReturnTo("create_application");
          navigate(buildCreatePropertyUrl(returnTo));
          setPropertyGateOpen(false);
        }}
      />
      <SendApplicationModal
        open={sendAppOpen}
        propertyId={sendAppPropertyId}
        unit={null}
        onClose={() => setSendAppOpen(false)}
      />
      <SendScreeningInviteModal
        open={screeningInviteOpen}
        onClose={() => setScreeningInviteOpen(false)}
        returnTo={`${location.pathname}${location.search}`}
      />
      {manualCompleteOpen && (
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
            width: "min(560px, 95vw)",
            maxHeight: "80vh",
            overflowY: "auto",
            padding: spacing.md,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Mark screening complete</div>
            <Button variant="ghost" onClick={() => setManualCompleteOpen(false)}>
              Close
            </Button>
          </div>
          <div style={{ display: "grid", gap: spacing.sm }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Overall
              <select value={manualOverall} onChange={(e) => setManualOverall(e.target.value as any)}>
                <option value="pass">Pass</option>
                <option value="review">Review</option>
                <option value="fail">Fail</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Score band (optional)
              <Input
                value={manualScoreBand}
                onChange={(e) => setManualScoreBand(e.target.value)}
                placeholder="A, B, C..."
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Flags (comma-separated)
              <Input
                value={manualFlags}
                onChange={(e) => setManualFlags(e.target.value)}
                placeholder="identity_unverified, income_low"
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Report text (MVP)
              <textarea
                value={manualReportText}
                onChange={(e) => setManualReportText(e.target.value)}
                style={{
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  padding: spacing.sm,
                  minHeight: 120,
                  resize: "vertical",
                }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setManualCompleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void handleManualComplete()} disabled={manualSubmitting}>
                {manualSubmitting ? "Saving..." : "Confirm complete"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
      )}
      {manualFailOpen && (
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
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Mark screening failed</div>
            <Button variant="ghost" onClick={() => setManualFailOpen(false)}>
              Close
            </Button>
          </div>
          <div style={{ display: "grid", gap: spacing.sm }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Failure code
              <Input
                value={manualFailureCode}
                onChange={(e) => setManualFailureCode(e.target.value)}
                placeholder="provider_error"
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Failure detail (optional)
              <textarea
                value={manualFailureDetail}
                onChange={(e) => setManualFailureDetail(e.target.value)}
                style={{
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  padding: spacing.sm,
                  minHeight: 100,
                  resize: "vertical",
                }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setManualFailOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void handleManualFail()} disabled={manualSubmitting}>
                {manualSubmitting ? "Saving..." : "Confirm failure"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
      )}
    </>
  );
};

export default ApplicationsPage;
