// @ts-nocheck
// rentchain-frontend/src/pages/ApplicationsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import {
  fetchApplications,
  fetchApplication,
  buildScreeningPayload,
  fetchApplicationTimeline,
} from "@/api/applicationsApi";
import { updateApplicationStatus as updateApplicationStatusApi } from "@/api/applicationsApi";
import { convertApplicationToTenant as convertApplicationToTenantApi } from "@/api/applicationsApi";
import { deriveScreeningReadiness } from "../api/applicationsScreeningApi";
import { useSubscription } from "../context/SubscriptionContext";
import { fetchApplicationEvents } from "../api/eventsApi";
import type {
  Application,
  ApplicationStatus,
  ApplicationTimelineEntry,
} from "../types/applications";
import { ScreeningDetailModal } from "../components/applications/ScreeningDetailModal";
import { ApplicationDetailPanel } from "../components/applications/ApplicationDetailPanel";
import { PrintApplicationView } from "../components/applications/PrintApplicationView";
import { useToast } from "../components/ui/ToastProvider";
import { Card, Section, Input, Button, Pill } from "../components/ui/Ui";
import { spacing, colors, text, radius } from "../styles/tokens";
import { useAuth } from "../context/useAuth";

const timelineLabelMap: Record<string, string> = {
  created: "Application created",
  phone_code_sent: "Verification code sent",
  phone_verified: "Phone verified",
  submitted: "Application submitted",
  references_contacted: "References contacted",
  screening_requested: "Screening requested",
  screening_paid: "Screening payment received",
  screening_completed: "Screening completed",
};

const buildTimelineForApplication = (
  app: Application
): ApplicationTimelineEntry[] => {
  const entries: ApplicationTimelineEntry[] = [];

  if (app.submittedAt) {
    entries.push({
      id: `submitted-${app.id}`,
      date: app.submittedAt,
      label: "Application submitted",
      status: app.status === "new" ? "new" : undefined,
    });
  }

  if (app.inReviewAt) {
    entries.push({
      id: `in_review-${app.id}`,
      date: app.inReviewAt,
      label: "Application moved to review",
      status: "in_review",
    });
  }

  if (app.approvedAt) {
    entries.push({
      id: `approved-${app.id}`,
      date: app.approvedAt,
      label: "Application approved",
      status: "approved",
    });
  }

  if (app.rejectedAt) {
    entries.push({
      id: `rejected-${app.id}`,
      date: app.rejectedAt,
      label: "Application rejected",
      status: "rejected",
    });
  }

  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return entries;
};

const mapEventsToTimeline = (
  events: { id: string; type: string; message: string; createdAt: string; actor?: string }[]
): ApplicationTimelineEntry[] =>
  events.map((event) => ({
    id: event.id,
    date: event.createdAt,
    label: timelineLabelMap[event.type] || event.message || event.type,
    actor: (event.actor as any) || undefined,
  }));

// --- Print helpers (keep lightweight, no deps) ---
function fmtDate(d: Date) {
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

function getApplicantName(app: any) {
  return (
    app?.applicantFullName ||
    app?.applicantName ||
    app?.fullName ||
    app?.name ||
    [app?.firstName, app?.lastName].filter(Boolean).join(" ") ||
    "-"
  );
}

function getApplicantEmail(app: any) {
  return app?.applicantEmail || app?.email || app?.contactEmail || "-";
}

function getApplicantPhone(app: any) {
  return app?.applicantPhone || app?.phone || app?.phoneNumber || app?.contactPhone || "-";
}

const ApplicationsPage: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [timelineByApp, setTimelineByApp] = useState<Record<string, ApplicationTimelineEntry[]>>({});
  const [missingFieldsByApp, setMissingFieldsByApp] = useState<Record<string, string[]>>({});
  const [validatingScreeningId, setValidatingScreeningId] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [printTarget, setPrintTarget] = useState<Application | null>(null);
  const [eventsByApp, setEventsByApp] = useState<Record<string, any[]>>({});
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [activeScreeningId, setActiveScreeningId] = useState<string | null>(null);
  const [screeningModalOpen, setScreeningModalOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [riskFilter, setRiskFilter] = useState<"low" | "medium" | "high" | null>(null);
  const [cosignFilter, setCosignFilter] = useState<"needs_cosign" | "cosign_requested" | null>(null);
  const [runScreeningNow, setRunScreeningNow] = useState<boolean>(
    () => (user?.screeningCredits ?? 0) > 0
  );
  const [printMode, setPrintMode] = useState<"summary" | "application">("summary");
  const canRun = Boolean(
    user &&
      (user.role === "landlord" ||
        user.role === "admin" ||
        user.permissions?.includes("applications:run"))
  );

const statusLabelMap: Record<ApplicationStatus, string> = {
  new: "New",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  submitted: "Submitted",
  converted: "Converted",
};

const getScreeningReadiness = (application: Application | null) =>
  deriveScreeningReadiness(application);

const screeningRequirementsFor = (app: Application | null) => {
  if (!app) {
    return {
      consent: false,
      phone: false,
      references: false,
      missing: ["Consent required", "Phone verification required", "References must be contacted"],
      canRun: false,
    };
  }
  const consent = !!app.consentCreditCheck;
  const phone = !!app.phoneVerified;
  const references = !!app.referencesContacted;
  const missing: string[] = [];
  if (!consent) missing.push("Consent required");
  if (!phone) missing.push("Phone verification required");
  if (!references) missing.push("References must be contacted");
  return {
    consent,
    phone,
    references,
    missing,
    canRun: missing.length === 0,
  };
};

const nextStepMessage = (reqs: ReturnType<typeof screeningRequirementsFor>) => {
  if (!reqs.phone) return "Applicant must verify phone";
  if (!reqs.references) return "Mark references contacted";
  if (!reqs.consent) return "Collect consent";
  return null;
};

  const navigate = useNavigate();
  const { showToast } = useToast();
  const { features } = useSubscription();

  const normalizeApplications = (data: any) => {
    const raw = data ?? {};
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.applications)) return raw.applications;
    return [];
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchApplications();
        if (!mounted) return;
        const apps = normalizeApplications(data);
        setApplications(apps);
        if (apps.length && !selectedApplicationId) {
          setSelectedApplicationId(apps[0].id);
        }
      } catch (err: any) {
        console.error("[ApplicationsPage] fetch error:", err);
        if (mounted) {
          setError(err?.message ?? "Failed to load applications.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setRunScreeningNow((user?.screeningCredits ?? 0) > 0);
  }, [user?.screeningCredits]);

  useEffect(() => {
    if (!selectedApplicationId && applications.length > 0) {
      setSelectedApplicationId(applications[0].id);
    }
  }, [applications, selectedApplicationId]);

  useEffect(() => {
    if (!selectedApplicationId) return;
    let active = true;
    (async () => {
      try {
        const events = await fetchApplicationTimeline(selectedApplicationId);
        if (!active) return;
        setTimelineByApp((prev) => ({
          ...prev,
          [selectedApplicationId]: mapEventsToTimeline(events),
        }));
      } catch (err: any) {
        console.error("[ApplicationsPage] Failed to load timeline", err);
        const fallbackApp =
          applications.find((a) => a.id === selectedApplicationId) || null;
        if (fallbackApp) {
          setTimelineByApp((prev) => ({
            ...prev,
            [selectedApplicationId]: buildTimelineForApplication(fallbackApp),
          }));
        }
        showToast({
          message: "Timeline unavailable",
          description: err?.message || "Unable to load timeline.",
          variant: "error",
        });
      }

      try {
        setEventsLoading(true);
        setEventsError(null);
        const evts = await fetchApplicationEvents(selectedApplicationId);
        if (!active) return;
        setEventsByApp((prev) => ({ ...prev, [selectedApplicationId]: evts }));
      } catch (err: any) {
        if (!active) return;
        setEventsError(err?.message || "Failed to load events");
      } finally {
        if (active) setEventsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [applications, selectedApplicationId, showToast]);

  const filteredApplications = applications.filter((app) => {
    // Text search across applicant, property, and unit
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const nameMatch = (app.fullName || "").toLowerCase().includes(q);
      const propertyMatch = (app.propertyName || "").toLowerCase().includes(q);
      const unitMatch = (app.unit || "").toLowerCase().includes(q);
      if (!nameMatch && !propertyMatch && !unitMatch) {
        return false;
      }
    }

    if (statusFilter !== "all" && app.status !== statusFilter) return false;
    if (riskFilter) {
      if (riskFilter === "low" && app.riskLevel !== "Low") return false;
      if (riskFilter === "medium" && app.riskLevel !== "Medium") return false;
      if (riskFilter === "high" && app.riskLevel !== "High") return false;
    }

    const verdict = getCosignerVerdict ? getCosignerVerdict(app).verdict : null;

    if (cosignFilter === "needs_cosign") {
      if (verdict !== "Required" && verdict !== "Recommended") {
        return false;
      }
    } else if (cosignFilter === "cosign_requested") {
      if (!app.cosignerRequested) return false;
    }

    return true;
  });

  const selectedApplication = useMemo(
    () => applications.find((a) => a.id === selectedApplicationId) ?? null,
    [applications, selectedApplicationId]
  );

  const selectedTimeline: ApplicationTimelineEntry[] = useMemo(() => {
    if (!selectedApplication) return [];
    return timelineByApp[selectedApplication.id] ?? [];
  }, [selectedApplication, timelineByApp]);

  const refreshApplication = async (appId: string) => {
    try {
      const fresh = await fetchApplication(appId);
      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? fresh : app))
      );
    } catch (err) {
      console.error("[ApplicationsPage] Failed to refresh application", err);
    }
  };

  const handleApplicationUpdated = (updated: Application) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === updated.id ? updated : app))
    );
    setMissingFieldsByApp((prev) => ({ ...prev, [updated.id]: [] }));
    void refreshApplication(updated.id);
  };

  const handleStatusChange = async (status: ApplicationStatus) => {
    if (!selectedApplication) return;

    const appId = selectedApplication.id;
    const statusLabel =
      status === "in_review"
        ? "In review"
        : status === "approved"
        ? "Approved"
        : status === "rejected"
        ? "Rejected"
        : "New";

    try {
      const updated = await updateApplicationStatusApi(appId, status);

      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? updated : app))
      );

      setTimelineByApp((prev) => ({
        ...prev,
        [appId]: buildTimelineForApplication(updated),
      }));

      showToast({
        message: "Status updated",
        description: `Application status set to ${statusLabel}.`,
        variant: "success",
      });
    } catch (err) {
      console.error("[ApplicationsPage] Failed to update application status", err);
      showToast({
        message: "Failed to update status",
        description: "Could not save the new application status.",
        variant: "error",
      });
    }
  };

  const handleRunCreditReport = async (application: Application) => {
    const readiness = getScreeningReadiness(application);
    if (!readiness.canRun) return;

    setValidatingScreeningId(application.id);
    try {
      const payload = await buildScreeningPayload(application.id);
      setMissingFieldsByApp((prev) => ({ ...prev, [application.id]: [] }));

      navigate(`/screening?applicationId=${encodeURIComponent(application.id)}`, {
        state: { screeningPayload: payload, application },
      });
    } catch (err: any) {
      const missing = Array.isArray(err?.missing) ? err.missing : [];
      if (err?.code === "missing_fields" || missing.length) {
        setMissingFieldsByApp((prev) => ({ ...prev, [application.id]: missing }));
        showToast({
          message: "More details needed",
          description:
            missing.length > 0
              ? `Add: ${missing.join(", ")}`
              : "Required fields are missing before running credit.",
          variant: "error",
        });
      } else {
        showToast({
          message: "Unable to start credit report",
          description: err?.message || "Please try again.",
          variant: "error",
        });
      }
    } finally {
      setValidatingScreeningId(null);
    }
  };

  const handleConvertToTenant = async (application: Application) => {
    if (!application?.id) return;
    if (!application.fullName && !(application as any).applicantFullName) {
      showToast({
        message: "Applicant name missing",
        description: "Provide a name before converting to tenant.",
        variant: "error",
      });
      return;
    }
    try {
      setIsConverting(true);
      const result = await convertApplicationToTenantApi(
        application.id,
        runScreeningNow
      );

      setApplications((prev) =>
        prev.map((a) =>
          a.id === application.id
            ? {
                ...a,
                status: "converted",
                convertedTenantId: result.tenantId,
                screeningId: result.screening?.screeningId || a.screeningId,
                screeningRequestId:
                  result.screening?.screeningId || a.screeningRequestId,
                updatedAt: new Date().toISOString(),
              }
            : a
        )
      );

      if (result.alreadyConverted) {
        showToast({ message: "Already converted", variant: "info" });
      } else {
        const msg = result.inviteEmailed
          ? "Converted to tenant and invite emailed"
          : "Converted to tenant";
        const desc =
          !result.inviteEmailed && result.inviteUrl
            ? "Invite link ready to share."
            : undefined;
        showToast({ message: msg, description: desc, variant: "success" });
      }

      if (!result.inviteEmailed && result.inviteUrl) {
        try {
          await navigator.clipboard.writeText(result.inviteUrl);
          showToast({
            message: "Invite link copied",
            description: "Share this link with the tenant.",
            variant: "info",
          });
        } catch {
          showToast({
            message: "Invite link ready",
            description: result.inviteUrl,
            variant: "info",
          });
        }
      }

      if (result.screening?.status === "blocked_no_credits") {
        showToast({
          message: "Screening blocked: no credits",
          variant: "warning",
        });
      }

      navigate(`/tenants?tenantId=${encodeURIComponent(result.tenantId)}`);
    } catch (err: any) {
      console.error("[ApplicationsPage] Failed to convert application", err);
      const msg = String(err?.message || "");
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        showToast({
          message: "Application not found",
          description: "This application may have been deleted or already converted.",
          variant: "error",
        });
      } else {
        showToast({
          message: "Conversion failed",
          description: err?.message || "Unable to convert this application to a tenant.",
          variant: "error",
        });
      }
    } finally {
      setIsConverting(false);
    }
  };

  const handlePrintApplication = (application: Application) => {
    setPrintMode("application");
    setPrintTarget(application);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        setPrintTarget(null);
        setPrintMode("summary");
      }, 250);
    }, 30);
  };

  useEffect(() => {
    document.body.setAttribute("data-print-mode", printMode);
    return () => {
      document.body.removeAttribute("data-print-mode");
    };
  }, [printMode]);

  if (!features.hasApplications) {
    return (
      <MacShell title="RentChain · Applications">
        <Card elevated>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: spacing.xs, color: text.primary }}>
            Applications are not available on your current plan
          </div>
          <div style={{ fontSize: 13, color: text.muted, marginBottom: spacing.xs }}>
            Upgrade to <span style={{ fontWeight: 600 }}>Core</span> or higher to manage online rental applications, co-applicants, and AI-assisted screening, all from one place.
          </div>
          <div style={{ fontSize: 12, color: text.subtle }}>
            Once enabled, this screen will show your active applications, status timeline, and screening insights.
          </div>
        </Card>
      </MacShell>
    );
  }

  return (
    <MacShell title="RentChain · Applications">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <Card elevated>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: text.primary }}>
                Applications
              </h1>
              <div style={{ marginTop: 4, color: text.muted, fontSize: "0.95rem" }}>
                Review, filter, and advance applicants through your pipeline.
              </div>
            </div>
            <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setPrintMode("summary");
                  setPrintTarget(null);
                  window.setTimeout(() => window.print(), 30);
                }}
                title="Print a PDF summary of applications"
              >
                Print PDF
              </Button>
            </div>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1.2fr) minmax(0, 2fr)",
            gap: spacing.lg,
            minHeight: 0,
          }}
        >
          <Section style={{ display: "flex", flexDirection: "column", gap: spacing.sm, minHeight: 0 }}>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by applicant, property, or unit..."
              style={{ borderRadius: radius.pill }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <FilterChip
                  label="All"
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                />
                <FilterChip
                  label="New"
                  active={statusFilter === "new"}
                  onClick={() => setStatusFilter("new")}
                />
                <FilterChip
                  label="In review"
                  active={statusFilter === "in_review"}
                  onClick={() => setStatusFilter("in_review")}
                />
                <FilterChip
                  label="Rejected"
                  active={statusFilter === "rejected"}
                  onClick={() => setStatusFilter("rejected")}
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <FilterChip
                  label="Low"
                  active={riskFilter === "low"}
                  onClick={() =>
                    setRiskFilter((prev) => (prev === "low" ? null : "low"))
                  }
                />
                <FilterChip
                  label="Medium"
                  active={riskFilter === "medium"}
                  onClick={() =>
                    setRiskFilter((prev) => (prev === "medium" ? null : "medium"))
                  }
                />
                <FilterChip
                  label="High"
                  active={riskFilter === "high"}
                  onClick={() =>
                    setRiskFilter((prev) => (prev === "high" ? null : "high"))
                  }
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <FilterChip
                  label="Needs cosign"
                  active={cosignFilter === "needs_cosign"}
                  onClick={() =>
                    setCosignFilter((prev) =>
                      prev === "needs_cosign" ? null : "needs_cosign"
                    )
                  }
                />
                <FilterChip
                  label="Cosign requested"
                  active={cosignFilter === "cosign_requested"}
                  onClick={() =>
                    setCosignFilter((prev) =>
                      prev === "cosign_requested" ? null : "cosign_requested"
                    )
                  }
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
              {loading ? (
                <div style={{ fontSize: 13, color: text.muted }}>Loading applications…</div>
              ) : error ? (
                <div style={{ fontSize: 13, color: colors.danger }}>{error}</div>
              ) : filteredApplications.length === 0 ? (
                <div style={{ fontSize: 13, color: text.muted }}>No applications found.</div>
              ) : (
                filteredApplications.map((app) => {
                  const selected = app.id === selectedApplicationId;
                  const cosignVerdict = getCosignerVerdict ? getCosignerVerdict(app) : null;
                  const readiness = getScreeningReadiness(app);
                  const reqs = screeningRequirementsFor(app);
                  const serverMissing = missingFieldsByApp[app.id] ?? [];
                  const combinedMissing = Array.from(
                    new Set([...(reqs.missing || []), ...(readiness.missing || []), ...serverMissing])
                  );
                  const isChecking = validatingScreeningId === app.id;
                  const disableRun = isChecking || !reqs.canRun;
                  const applicantName = getApplicantName(app);
                  const applicantEmail = getApplicantEmail(app);
                  const applicantPhone = getApplicantPhone(app);
                  const unitLabel =
                    app.unit ||
                    app.unitApplied ||
                    app.unitLabel ||
                    app.unitNumber ||
                    app.unitId ||
                    "—";

                  return (
                    <div
                      key={app.id}
                      onClick={() => {
                        setSelectedApplicationId(app.id);
                        navigate(`/applications?applicationId=${app.id}`, { replace: true });
                      }}
                      style={{
                        borderRadius: radius.md,
                        padding: "10px 12px",
                        backgroundColor: selected ? "rgba(37,99,235,0.08)" : colors.card,
                        border: `1px solid ${selected ? colors.accent : colors.border}`,
                        cursor: "pointer",
                        boxShadow: selected ? "0 8px 18px rgba(37,99,235,0.12)" : "none",
                      }}
                    >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {applicantName || "Applicant"}
                            </div>
                            <div style={{ fontSize: 12, color: text.muted }}>
                              {app.propertyName || "Property"} · Unit {unitLabel}
                            </div>
                            <div style={{ fontSize: 11, color: text.subtle }}>
                              {(applicantEmail && applicantEmail !== "-") ? applicantEmail : "Email n/a"}
                              {" \u2022 "}
                              {(applicantPhone && applicantPhone !== "-") ? applicantPhone : "Phone n/a"}
                            </div>
                          </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <div style={{ fontSize: 12, color: text.subtle }}>
                            {app.submittedAt
                              ? new Date(app.submittedAt).toLocaleDateString()
                              : "Date n/a"}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {app.screeningStatus && (
                              <Pill tone="muted" style={{ alignSelf: "flex-end" }}>
                                Screening: {app.screeningStatus}
                              </Pill>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={runScreeningNow}
                                disabled={!canRun || (user?.screeningCredits ?? 0) <= 0}
                                onChange={(e) => setRunScreeningNow(e.target.checked)}
                                style={{ width: 16, height: 16 }}
                              />
                              <span style={{ fontSize: 12, color: text.subtle }}>
                                Run screening now{" "}
                                {(user?.screeningCredits ?? 0) <= 0 ? "(no credits)" : ""}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (disableRun) return;
                                void handleRunCreditReport(app);
                              }}
                              disabled={disableRun}
                              style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                            >
                              {isChecking ? "Checking..." : "Run credit report"}
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isConverting) {
                                  void handleConvertToTenant(app);
                                }
                              }}
                              disabled={isConverting}
                              style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                            >
                              {isConverting ? "Converting..." : "Convert to tenant"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintApplication(app);
                              }}
                              style={{
                                padding: "6px 10px",
                                fontSize: "0.85rem",
                                border: `1px solid ${colors.border}`,
                                backgroundColor: colors.card,
                              }}
                            >
                              Print application
                            </Button>
                          </div>
                          {disableRun && combinedMissing.length > 0 && (
                            <div
                              style={{
                                fontSize: 11,
                                color: text.muted,
                                textAlign: "right",
                                maxWidth: 220,
                              }}
                            >
                              To run screening: {combinedMissing.join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.border}`, backgroundColor: colors.panel }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                          Screening readiness
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                          <ReadinessRow label="Consent for credit check" ok={reqs.consent} />
                          <ReadinessRow label="Phone verified" ok={reqs.phone} />
                          <ReadinessRow label="References contacted" ok={reqs.references} />
                        </div>
                        {reqs.missing.length > 0 && (
                          <div style={{ marginTop: 6, fontSize: 12, color: text.muted }}>
                            Missing: {reqs.missing.join(" · ")}
                          </div>
                        )}
                        {nextStepMessage(reqs) && (
                          <div style={{ marginTop: 6, fontSize: 12, color: colors.accent }}>
                            Next step: {nextStepMessage(reqs)}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          padding: "8px 10px",
                          borderRadius: radius.sm,
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.panel,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Conversion</div>
                        {app.convertedTenantId ? (
                          <div style={{ fontSize: 12, color: text.primary }}>
                            Converted → Tenant: {app.convertedTenantId}{" "}
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/tenants?tenantId=${encodeURIComponent(app.convertedTenantId!)}`);
                              }}
                              style={{ marginLeft: 8, padding: "4px 8px", fontSize: 12 }}
                            >
                              Open tenant
                            </Button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: text.subtle }}>
                            Not converted yet.
                          </div>
                        )}
                        {app.screeningId || app.screeningRequestId ? (
                          <div style={{ fontSize: 12, color: text.primary }}>
                            Screening: {app.screeningId || app.screeningRequestId}{" "}
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveScreeningId(app.screeningId || app.screeningRequestId || null);
                                setScreeningModalOpen(true);
                              }}
                              style={{ padding: "4px 8px", fontSize: 12 }}
                            >
                              View screening
                            </Button>
                          </div>
                        ) : null}
                        <div style={{ fontSize: 12, color: text.subtle }}>
                          Recent events:
                        </div>
                        {eventsLoading ? (
                          <div style={{ fontSize: 12, color: text.muted }}>Loading events…</div>
                        ) : eventsError ? (
                          <div style={{ fontSize: 12, color: colors.danger }}>{eventsError}</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {(eventsByApp[app.id] || []).slice(0, 3).map((evt) => (
                              <div
                                key={evt.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 12,
                                  color: text.muted,
                                }}
                              >
                                <span>{evt.type}</span>
                                <span>
                                  {evt.occurredAt
                                    ? new Date(evt.occurredAt).toLocaleString()
                                    : ""}
                                </span>
                              </div>
                            ))}
                            {(eventsByApp[app.id] || []).length === 0 && (
                              <div style={{ fontSize: 12, color: text.subtle }}>
                                No events yet.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <Pill tone="accent">{statusLabelMap[app.status]}</Pill>

                        {app.riskLevel && (
                          <Pill
                            tone="muted"
                            style={{
                              borderColor:
                                app.riskLevel === "Low"
                                  ? "rgba(52, 211, 153, 0.6)"
                                  : app.riskLevel === "Medium"
                                  ? "rgba(250,204,21,0.6)"
                                  : "rgba(239,68,68,0.6)",
                              color:
                                app.riskLevel === "Low"
                                  ? "#15803d"
                                  : app.riskLevel === "Medium"
                                  ? "#92400e"
                                  : colors.danger,
                            }}
                          >
                            Risk: {app.riskLevel}
                          </Pill>
                        )}

                        {cosignVerdict && (
                          <Pill tone="muted" style={{ borderColor: colors.border, color: text.primary }}>
                            Cosign: {cosignVerdict.verdict}
                          </Pill>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Section>

          <Section style={{ minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            {selectedApplication ? (
              <ApplicationDetailPanel
                application={selectedApplication}
                timeline={selectedTimeline}
                onStatusChange={handleStatusChange}
                onConvertToTenant={handleConvertToTenant}
                isConverting={isConverting}
                onApplicationUpdated={handleApplicationUpdated}
                missingFields={missingFieldsByApp[selectedApplication.id] ?? []}
              />
            ) : (
              <div style={{ fontSize: 13, color: text.muted }}>
                Select an application to view details.
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* PRINT ONLY: Applications Summary */}
      <div className="print-only print-only-summary">
        <div className="printHeader">
          <div className="printTitle">Applications Summary</div>
          <div className="printMeta">
            <div>
              <strong>Total applications:</strong>{" "}
              {Array.isArray(applications) ? applications.length : 0}
            </div>
            <div>
              <strong>Generated:</strong> {fmtDate(new Date())}
            </div>
          </div>
        </div>

        <table className="printTable">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Name</th>
              <th style={{ textAlign: "left" }}>Email</th>
              <th style={{ textAlign: "left" }}>Phone</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(applications) ? applications : []).map((app: any) => (
              <tr
                key={
                  app?.id ||
                  `${getApplicantEmail(app)}-${getApplicantPhone(app)}-${getApplicantName(app)}`
                }
              >
                <td>{getApplicantName(app)}</td>
                <td>{getApplicantEmail(app)}</td>
                <td>{getApplicantPhone(app)}</td>
              </tr>
            ))}
            {!applications || applications.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ opacity: 0.75 }}>
                  No applications found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="printFooter">
          <div style={{ opacity: 0.7 }}>
            RentChain • Internal use • {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* PRINT ONLY: Single Application Detail */}
      <div className="print-only print-only-application">
        <div className="printHeader">
          <div className="printTitle">Application Details</div>
          <div className="printMeta">
            <div>
              <strong>Generated:</strong> {fmtDate(new Date())}
            </div>
          </div>
        </div>

        <table className="printTable">
          <tbody>
            <tr>
              <th style={{ width: 180 }}>Name</th>
              <td>{printTarget ? getApplicantName(printTarget) : "-"}</td>
            </tr>
            <tr>
              <th>Email</th>
              <td>{printTarget ? getApplicantEmail(printTarget) : "-"}</td>
            </tr>
            <tr>
              <th>Phone</th>
              <td>{printTarget ? getApplicantPhone(printTarget) : "-"}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>
                {printTarget ? (printTarget as any)?.status ?? (printTarget as any)?.state ?? "-" : "-"}
              </td>
            </tr>
            <tr>
              <th>Property</th>
              <td>
                {printTarget
                  ? (printTarget as any)?.propertyName ??
                    (printTarget as any)?.propertyAddress ??
                    "-"
                  : "-"}
              </td>
            </tr>
            <tr>
              <th>Unit</th>
              <td>{printTarget ? (printTarget as any)?.unitNumber ?? "-" : "-"}</td>
            </tr>
            <tr>
              <th>Submitted</th>
              <td>
                {printTarget
                  ? (printTarget as any)?.createdAt
                    ? String((printTarget as any)?.createdAt)
                    : "-"
                  : "-"}
              </td>
            </tr>
            <tr>
              <th>Notes</th>
              <td>{printTarget ? (printTarget as any)?.notes ?? "-" : "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ScreeningDetailModal
        screeningId={activeScreeningId}
        open={screeningModalOpen}
        onClose={() => setScreeningModalOpen(false)}
      />
    </MacShell>
  );
};

interface FilterChipProps {
  label: string;
  active?: boolean;
  onClick: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: "0.18rem 0.55rem",
      borderRadius: "999px",
      border: active
        ? "1px solid rgba(96,165,250,0.95)"
        : "1px solid rgba(148,163,184,0.65)",
      backgroundColor: active ? "rgba(37,99,235,0.12)" : "transparent",
      color: active ? colors.accent : text.muted,
      fontSize: "0.72rem",
      cursor: "pointer",
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </button>
);

const ReadinessRow: React.FC<{ label: string; ok: boolean }> = ({ label, ok }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      color: ok ? "#16a34a" : colors.danger,
    }}
  >
    <span style={{ fontWeight: 700 }}>{ok ? "✓" : "✕"}</span>
    <span style={{ color: text.primary }}>{label}</span>
  </div>
);

// Co-signer helper for filtering only

type CosignerVerdict = "NotRequired" | "Recommended" | "Required";

function getCosignerVerdict(
  app: Application
): { verdict: CosignerVerdict; reason: string } {
  const ratio = app.rentToIncomeRatio || 0;
  const risk = app.riskLevel;

  if (ratio >= 0.5 || risk === "High") {
    return {
      verdict: "Required",
      reason:
        "Rent-to-income is at or above 50% or overall risk is rated High.",
    };
  }

  if (ratio >= 0.4 || risk === "Medium") {
    return {
      verdict: "Recommended",
      reason:
        "Rent-to-income is above 40% or overall risk is Medium. A co-signer would strengthen the file.",
    };
  }

  return {
    verdict: "NotRequired",
    reason:
      "Rent-to-income is in a comfortable range and overall risk is Low based on the current information.",
  };
}

export default ApplicationsPage;
