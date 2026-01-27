import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, Section, Input, Button, Pill } from "../components/ui/Ui";
import { spacing, colors, text, radius } from "../styles/tokens";
import { apiFetch } from "@/api/http";
import {
  fetchRentalApplications,
  fetchRentalApplication,
  updateRentalApplicationStatus,
  fetchScreeningQuote,
  createScreeningCheckout,
  fetchScreening,
  fetchScreeningResult,
  fetchScreeningEvents,
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
import { useAuth } from "../context/useAuth";
import "./ApplicationsPage.css";

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
  const { features, loading: loadingCaps } = useCapabilities();
  const { user } = useAuth();
  const [screeningQuote, setScreeningQuote] = useState<ScreeningQuote | null>(null);
  const [screeningQuoteDetail, setScreeningQuoteDetail] = useState<string | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningRunning, setScreeningRunning] = useState(false);
  const [scoreAddOn, setScoreAddOn] = useState(false);
  const [serviceLevel, setServiceLevel] = useState<"SELF_SERVE" | "VERIFIED" | "VERIFIED_AI">("SELF_SERVE");
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

  const screeningOptions = [
    { value: "SELF_SERVE", label: "Self-serve screening", priceLabel: "$19.99" },
    { value: "VERIFIED", label: "Verified screening by RentChain", priceLabel: "$29.99" },
    { value: "VERIFIED_AI", label: "Verified + AI Verification", priceLabel: "$39.99" },
  ] as const;

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

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
        const res: any = await apiFetch("/properties");
        const list = Array.isArray(res?.properties) ? res.properties : [];
        if (!alive) return;
        setProperties(
          list.map((p: any) => ({
            id: String(p.id || p.propertyId || p.uid || ""),
            name: p.name || p.addressLine1 || p.label || "Property",
          }))
        );
      } catch {
        if (!alive) return;
        setProperties([]);
      }
    };
    void loadProperties();
    return () => {
      alive = false;
    };
  }, []);

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
        if (!selectedId && list?.length) {
          setSelectedId(list[0].id);
        }
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
        const res = await fetchScreeningQuote(selectedId, { serviceLevel, scoreAddOn });
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
  }, [selectedId, serviceLevel, scoreAddOn]);

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

  const handleExportReport = async (copyOnly: boolean) => {
    if (!detail?.id) return;
    setExportingReport(true);
    try {
      const res = await exportScreeningReport(detail.id);
      if (!res.ok || !res.shareUrl) {
        showToast({ message: res.error || "Unable to export report.", variant: "error" });
        return;
      }
      setExportShareUrl(res.shareUrl || null);
      setExportExpiresAt(res.expiresAt || null);
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
      const res = await createScreeningCheckout(detail.id, { scoreAddOn, serviceLevel });
      if (!res.ok || !res.checkoutUrl) {
        throw new Error(res.detail || res.error || "Unable to start checkout");
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
          </div>
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
        </div>
      </Card>

      <Card elevated className="rc-applications-grid">
        <div className="rc-applications-list">
          {loading ? (
            <div style={{ color: text.muted }}>Loading applications...</div>
          ) : error ? (
            <div style={{ color: colors.danger }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: text.muted }}>No applications found.</div>
          ) : (
            <div className="rc-applications-list-scroll">
              {filtered.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className="rc-applications-list-item"
                  onClick={() => setSelectedId(app.id)}
                  style={{
                    textAlign: "left",
                    border: `1px solid ${app.id === selectedId ? colors.accent : colors.border}`,
                    background: app.id === selectedId ? "rgba(37,99,235,0.08)" : colors.card,
                    borderRadius: radius.md,
                    padding: "12px 12px",
                    cursor: "pointer",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 700, color: text.primary, fontSize: 15 }}>{app.applicantName || "Applicant"}</div>
                  <div style={{ color: text.muted, fontSize: 12 }}>{app.email || "No email"}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Pill>{app.status}</Pill>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

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
                <div style={{ display: "flex", gap: 8 }}>
                  {statusOptions.map((s) => (
                    <Button key={s} variant={detail.status === s ? "primary" : "secondary"} onClick={() => void setStatus(s)}>
                      {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>

              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>Screening</div>
                  <Button
                    variant="ghost"
                    onClick={() => void refreshSelectedApplication(detail.id)}
                    disabled={!detail?.id || loadingDetail}
                  >
                    Refresh
                  </Button>
                </div>
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Pill>{formatScreeningStatus(screeningStatus?.status || detail.screeningStatus || null)}</Pill>
                    {screeningStatusLoading ? (
                      <span style={{ fontSize: 12, color: text.subtle }}>Refreshing…</span>
                    ) : null}
                    {screeningStatus?.provider ? (
                      <span style={{ fontSize: 12, color: text.subtle }}>Provider: {screeningStatus.provider}</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: text.muted }}>
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
                        fontSize: 13,
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
                      <div style={{ fontSize: 12, fontWeight: 700, color: text.subtle, marginBottom: 6 }}>
                        Admin screening controls
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                    <div style={{ fontSize: 12, color: text.muted }}>
                      Eligibility checked: {new Date(detail.screeningLastEligibilityCheckedAt).toLocaleString()}
                    </div>
                  ) : null}
                  {formatEligibilityReason(detail.screeningLastEligibilityReasonCode) ? (
                    <div style={{ fontSize: 12, color: text.muted }}>
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
                      <div style={{ display: "grid", gap: 6 }}>
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
                          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 8, display: "grid", gap: 6 }}>
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
                            <div>Price: ${(screeningQuote.totalAmountCents / 100).toFixed(2)} {screeningQuote.currency}</div>
                            <div style={{ fontSize: 12, color: text.muted }}>
                              Base ${(screeningQuote.baseAmountCents / 100).toFixed(2)}
                              {screeningQuote.verifiedAddOnCents ? ` + Verified ${(screeningQuote.verifiedAddOnCents / 100).toFixed(2)}` : ""}
                              {screeningQuote.aiAddOnCents ? ` + AI ${(screeningQuote.aiAddOnCents / 100).toFixed(2)}` : ""}
                              {screeningQuote.scoreAddOnCents ? ` + Score ${(screeningQuote.scoreAddOnCents / 100).toFixed(2)}` : ""}
                            </div>
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>Screening type</div>
                              {screeningOptions.map((opt) => (
                                <label key={opt.value} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                                  <input
                                    type="radio"
                                    name="screeningType"
                                    checked={serviceLevel === opt.value}
                                    onChange={() => setServiceLevel(opt.value)}
                                  />
                                  {opt.label} — {opt.priceLabel}
                                </label>
                              ))}
                            </div>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                              <input type="checkbox" checked={scoreAddOn} onChange={(e) => setScoreAddOn(e.target.checked)} />
                              Include credit score (+${(screeningQuote.scoreAddOnCents / 100).toFixed(2)})
                            </label>
                            <Button
                              variant="primary"
                              onClick={() => void runScreeningRequest()}
                              disabled={screeningRunning}
                            >
                              {screeningRunning ? "Running..." : "Run screening ($19.99)"}
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
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>Timeline</div>
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
                        <div style={{ fontWeight: 600 }}>{formatScreeningEventLabel(event.type)}</div>
                        <div style={{ fontSize: 12, color: text.muted }}>
                          {event.at ? new Date(event.at).toLocaleString() : "—"}
                        </div>
                        {event.meta?.reasonCode ? (
                          <div style={{ fontSize: 12, color: text.subtle }}>Reason: {event.meta.reasonCode}</div>
                        ) : null}
                        {event.meta?.status ? (
                          <div style={{ fontSize: 12, color: text.subtle }}>Status: {event.meta.status}</div>
                        ) : null}
                        {event.meta?.from || event.meta?.to ? (
                          <div style={{ fontSize: 12, color: text.subtle }}>
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
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Consent</div>
                <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  <div>Credit consent: {detail.consent.creditConsent ? "Yes" : "No"}</div>
                  <div>Reference consent: {detail.consent.referenceConsent ? "Yes" : "No"}</div>
                  <div>Data sharing consent: {detail.consent.dataSharingConsent ? "Yes" : "No"}</div>
                  <div>Accepted at: {detail.consent.acceptedAt ? new Date(detail.consent.acceptedAt).toLocaleString() : "-"}</div>
                </div>
              </Card>

              <Card>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Residential history</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {detail.residentialHistory?.length ? detail.residentialHistory.map((h, idx) => (
                    <div key={idx} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{h.address}</div>
                      <div style={{ color: text.muted, fontSize: 12 }}>
                        {h.durationMonths ? `${h.durationMonths} months` : ""}{h.rentAmountCents ? ` · $${(h.rentAmountCents / 100).toFixed(0)}` : ""}
                      </div>
                      <div style={{ fontSize: 12 }}>Landlord: {h.landlordName || "-"} {h.landlordPhone ? `(${h.landlordPhone})` : ""}</div>
                      {h.reasonForLeaving ? <div style={{ fontSize: 12 }}>Reason: {h.reasonForLeaving}</div> : null}
                    </div>
                  )) : <div style={{ color: text.muted }}>No history provided.</div>}
                </div>
              </Card>
            </div>
          )}
        </Section>
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
                  {exportingReport ? "Preparing..." : "Download PDF"}
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
