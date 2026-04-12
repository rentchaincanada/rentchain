import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Button } from "../components/ui/Ui";
import { colors, text } from "../styles/tokens";
import { useEntitlements } from "@/hooks/useEntitlements";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { ApplicationDecisionSummaryCard } from "@/components/applications/ApplicationDecisionSummaryCard";
import {
  evaluateApplicationRiskSnapshot,
  recordApplicationRiskDecision,
} from "@/api/rentalApplicationsApi";
import type { LandlordDecisionAction } from "@/types/applicationDecisionSummary";
import {
  fetchReviewSummary,
  fetchReviewSummaryPdfSignedUrl,
  type ApplicationReviewSummary,
  ReviewSummaryApiError,
} from "../api/reviewSummaryApi";
import { useToast } from "../components/ui/ToastProvider";
import { buildLandlordIntakeAlignmentView } from "./applicationReviewIntakeAlignment";
import { buildLandlordReviewGuidance } from "./landlordReviewGuidance";
import { buildTenantLandlordInteractionLoop } from "./tenantLandlordInteractionLoop";
import { buildLandlordStructuredActivityTimeline } from "./structuredActivityTimeline";
import { buildFollowUpResolutionState } from "./followUpResolutionState";
import { buildLandlordDecisionWorkspace } from "./landlordDecisionWorkspace";
import { buildLandlordDecisionOutcome } from "./landlordDecisionOutcome";
import { buildLeaseFlowTransitionState } from "./leaseFlowTransitionState";
import { buildLeasePreparationWorkspaceState } from "./leasePreparationWorkspaceState";
import { buildMoveInReadinessWorkspaceState } from "./moveInReadinessWorkspaceState";
import { buildLeaseExecutionReadinessState } from "./leaseExecutionReadinessState";
import { buildLeaseExecutionWorkspace } from "./leaseExecutionWorkspace";
import StructuredNotificationList from "./StructuredNotificationList";
import { buildLandlordStructuredNotificationTriggers } from "./structuredNotificationTriggers";

function money(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "Not provided";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function dateOr(value: string | null | undefined): string {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not provided" : parsed.toLocaleString();
}

function ratio(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Not provided";
  return `${value.toFixed(2)}x`;
}

function kv(label: string, value: string) {
  return (
    <div
      key={label}
      style={{
        display: "grid",
        gap: 4,
        padding: 10,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: text.subtle }}>{label}</div>
      <div style={{ fontWeight: 600, color: text.main }}>{value || "Not provided"}</div>
    </div>
  );
}

function intakeTone(state: "ready_for_review" | "needs_follow_up") {
  return state === "ready_for_review"
    ? { color: "#166534", background: "#dcfce7", label: "Ready for review" }
    : { color: "#9a3412", background: "#ffedd5", label: "Needs follow-up" };
}

function followUpTone(state: "follow_up_needed" | "partly_addressed" | "ready_for_rereview") {
  if (state === "ready_for_rereview") {
    return { color: "#166534", background: "#dcfce7", label: "Ready for re-review" };
  }
  if (state === "partly_addressed") {
    return { color: "#1d4ed8", background: "#dbeafe", label: "Partly addressed" };
  }
  return { color: "#9a3412", background: "#ffedd5", label: "Follow-up needed" };
}

function decisionTone(state: "needs_follow_up" | "hold_for_later" | "ready_for_decision") {
  if (state === "ready_for_decision") {
    return { color: "#166534", background: "#dcfce7", label: "Ready for decision" };
  }
  if (state === "hold_for_later") {
    return { color: "#1d4ed8", background: "#dbeafe", label: "Hold for later" };
  }
  return { color: "#9a3412", background: "#ffedd5", label: "Needs follow-up" };
}

function decisionOutcomeTone(state: "ready_for_next_step" | "hold_for_later" | "not_proceeding") {
  if (state === "ready_for_next_step") {
    return { color: "#166534", background: "#dcfce7", label: "Ready for next step" };
  }
  if (state === "not_proceeding") {
    return { color: "#7f1d1d", background: "#fee2e2", label: "Not proceeding" };
  }
  return { color: "#1d4ed8", background: "#dbeafe", label: "Hold for later" };
}

function leaseTransitionTone(
  state: "not_ready_for_lease" | "ready_for_lease_step" | "lease_step_started" | "awaiting_next_action"
) {
  if (state === "lease_step_started") {
    return { color: "#0f766e", background: "#ccfbf1", label: "Lease step started" };
  }
  if (state === "ready_for_lease_step") {
    return { color: "#166534", background: "#dcfce7", label: "Ready for lease step" };
  }
  if (state === "awaiting_next_action") {
    return { color: "#1d4ed8", background: "#dbeafe", label: "Awaiting next action" };
  }
  return { color: "#9a3412", background: "#ffedd5", label: "Not ready for lease step" };
}

function leasePreparationTone(
  state: "not_started" | "preparing_lease" | "needs_attention" | "ready_for_execution" | "awaiting_next_action"
) {
  if (state === "ready_for_execution") {
    return { color: "#166534", background: "#dcfce7", label: "Ready for execution" };
  }
  if (state === "preparing_lease") {
    return { color: "#0f766e", background: "#ccfbf1", label: "Preparing lease" };
  }
  if (state === "awaiting_next_action") {
    return { color: "#1d4ed8", background: "#dbeafe", label: "Awaiting next action" };
  }
  if (state === "needs_attention") {
    return { color: "#9a3412", background: "#ffedd5", label: "Needs attention" };
  }
  return { color: "#64748b", background: "#e2e8f0", label: "Not started" };
}

function moveInReadinessTone(
  state:
    | "not_started"
    | "in_progress"
    | "needs_attention"
    | "ready_for_move_in"
    | "awaiting_next_action"
) {
  if (state === "ready_for_move_in") {
    return { color: "#166534", background: "#dcfce7", label: "Ready for move-in" };
  }
  if (state === "in_progress") {
    return { color: "#0f766e", background: "#ccfbf1", label: "Preparing for move-in" };
  }
  if (state === "needs_attention") {
    return { color: "#9a3412", background: "#ffedd5", label: "Needs attention" };
  }
  if (state === "awaiting_next_action") {
    return { color: "#1d4ed8", background: "#dbeafe", label: "Awaiting next action" };
  }
  return { color: "#64748b", background: "#e2e8f0", label: "Not started" };
}

function leaseExecutionReadinessTone(
  state:
    | "not_ready_for_execution"
    | "ready_for_execution"
    | "execution_in_progress"
    | "awaiting_execution_action"
) {
  if (state === "execution_in_progress") {
    return { color: "#0f766e", background: "#ccfbf1", label: "Execution in progress" };
  }
  if (state === "ready_for_execution") {
    return { color: "#166534", background: "#dcfce7", label: "Ready for execution" };
  }
  if (state === "awaiting_execution_action") {
    return { color: "#1d4ed8", background: "#dbeafe", label: "Awaiting execution action" };
  }
  return { color: "#64748b", background: "#e2e8f0", label: "Not ready for execution" };
}

type SummaryLoadError = {
  message: string;
  status?: number;
  backendError?: string;
  detail?: string;
};

class ReviewSummaryErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Review summary failed to render." };
  }

  componentDidCatch(error: Error) {
    console.error("[review-summary] render crash", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card style={{ color: colors.danger }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Review summary failed to render.</div>
          <div style={{ marginBottom: 10 }}>{this.state.message}</div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

function ApplicationReviewSummaryPageBody() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const entitlements = useEntitlements();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SummaryLoadError | null>(null);
  const [summary, setSummary] = useState<ApplicationReviewSummary | null>(null);
  const [evaluatingRisk, setEvaluatingRisk] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);

  const loadSummary = React.useCallback(async () => {
    if (!entitlements.canViewReviewSummary) {
      setLoading(false);
      setSummary(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReviewSummary(id);
      setSummary(data);
    } catch (err: any) {
      console.error("[review-summary] load failed", err);
      const parsed: SummaryLoadError = {
        message: err?.message || "Failed to load review summary",
      };
      if (err instanceof ReviewSummaryApiError) {
        parsed.status = err.status;
        parsed.backendError = err.backendError;
        parsed.detail = err.detail;
      } else if (typeof err?.status === "number") {
        parsed.status = err.status;
      }
      setSummary(null);
      setError(parsed);
    } finally {
      setLoading(false);
    }
  }, [entitlements.canViewReviewSummary, id]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/applications/${id}/review-summary`;
  }, [id]);

  const downloadPdf = async () => {
    if (!entitlements.canExportPdf) {
      showToast({
        message: "Upgrade required",
        description: "PDF review summaries are available on Pro plans.",
        variant: "info",
      });
      return;
    }
    try {
      const url = await fetchReviewSummaryPdfSignedUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      showToast({
        message: "Unable to open PDF",
        description: err?.message || "Failed to load review summary PDF.",
        variant: "error",
      });
    }
  };

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast({ message: successMessage, variant: "success" });
    } catch {
      showToast({ message: "Copy failed", variant: "error" });
    }
  };

  const handleEvaluateRisk = async () => {
    if (!id) return;
    setEvaluatingRisk(true);
    try {
      await evaluateApplicationRiskSnapshot(id);
      await loadSummary();
      showToast({
        message: "Risk snapshot refreshed",
        description: "The latest Risk Agent result is now available in this review summary.",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Risk refresh failed",
        description: err?.message || "Unable to refresh the latest risk snapshot.",
        variant: "error",
      });
    } finally {
      setEvaluatingRisk(false);
    }
  };

  const handleDecision = async (decision: LandlordDecisionAction, notes: string) => {
    if (!id) return;
    setSavingDecision(true);
    try {
      await recordApplicationRiskDecision(id, { decision, notes });
      showToast({
        message: "Decision note saved",
        description: "Your landlord review decision was captured without changing application status.",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Decision note failed",
        description: err?.message || "Unable to save the landlord decision note.",
        variant: "error",
      });
    } finally {
      setSavingDecision(false);
    }
  };

  const intakeView = useMemo(() => (summary ? buildLandlordIntakeAlignmentView(summary) : null), [summary]);

  const guidanceView = useMemo(() => (intakeView ? buildLandlordReviewGuidance(intakeView) : null), [intakeView]);

  const interactionLoop = useMemo(
    () =>
      intakeView
        ? buildTenantLandlordInteractionLoop({
            audience: "landlord",
            packageCategories: intakeView.packageCategories,
          })
        : null,
    [intakeView]
  );

  const resolutionView = useMemo(
    () => (intakeView ? buildFollowUpResolutionState(intakeView.packageCategories) : null),
    [intakeView]
  );
  const structuredNotifications = useMemo(
    () =>
      summary && intakeView
        ? buildLandlordStructuredNotificationTriggers(summary, intakeView.packageCategories)
        : [],
    [summary, intakeView]
  );
  const decisionWorkspace = useMemo(
    () =>
      summary && intakeView
        ? buildLandlordDecisionWorkspace({
            summary,
            packageCategories: intakeView.packageCategories,
          })
        : null,
    [summary, intakeView]
  );
  const decisionOutcome = useMemo(
    () =>
      decisionWorkspace && resolutionView
        ? buildLandlordDecisionOutcome({
            decisionStatus: summary?.decisionSummary?.status || null,
            decisionWorkspace,
            followUpOverallState: resolutionView.overallState,
            remainingCategories: resolutionView.remainingCategoriesNeedingAttention,
          })
        : null,
    [decisionWorkspace, resolutionView, summary]
  );
  const leaseTransition = useMemo(
    () =>
      decisionOutcome
        ? buildLeaseFlowTransitionState({
            audience: "landlord",
            decisionOutcome,
          })
        : null,
    [decisionOutcome]
  );
  const leasePreparation = useMemo(
    () =>
      decisionOutcome && leaseTransition && intakeView
        ? buildLeasePreparationWorkspaceState({
            audience: "landlord",
            decisionOutcome,
            leaseTransition,
            packageCategories: intakeView.packageCategories,
          })
        : null,
    [decisionOutcome, intakeView, leaseTransition]
  );
  const moveInReadiness = useMemo(
    () =>
      decisionOutcome && leaseTransition && leasePreparation && intakeView
        ? buildMoveInReadinessWorkspaceState({
            audience: "landlord",
            decisionOutcome,
            leaseTransition,
            leasePreparation,
            packageCategories: intakeView.packageCategories,
          })
        : null,
    [decisionOutcome, intakeView, leasePreparation, leaseTransition]
  );
  const executionWorkspace = useMemo(
    () =>
      decisionOutcome && leasePreparation && moveInReadiness && intakeView
        ? buildLeaseExecutionWorkspace({
            audience: "landlord",
            executionReadiness: buildLeaseExecutionReadinessState({
              audience: "landlord",
              decisionOutcome,
              leasePreparation,
              moveInReadiness,
              packageCategories: intakeView.packageCategories,
            }),
          })
        : null,
    [decisionOutcome, intakeView, leasePreparation, moveInReadiness]
  );

  const recentActivity = useMemo(
    () => (summary ? buildLandlordStructuredActivityTimeline(summary).slice(0, 4) : []),
    [summary]
  );

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      {!entitlements.canViewReviewSummary ? (
        <LockedFeature
          featureKey="review_summary"
          title="Screening decision summaries are available on Pro"
          description="Keep application risk signals, screening recommendation, and landlord-ready review notes in one place once your plan includes review summaries."
          hint="This page stays stable, but the richer decision-support view unlocks on Pro."
          ctaLabel="Upgrade to Pro"
        />
      ) : null}
      {entitlements.canViewReviewSummary ? (
        <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem" }}>Application Review Summary</h1>
          <div style={{ fontSize: 12, color: text.subtle }}>Application ID: {id}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
          <Button variant="secondary" onClick={() => void downloadPdf()}>Download PDF</Button>
          <Button variant="secondary" onClick={() => void copyText(shareUrl, "Share link copied")}>Copy link</Button>
          {summary?.screening?.referenceId ? (
            <Button
              variant="secondary"
              onClick={() => void copyText(summary.screening.referenceId || "", "Reference ID copied")}
            >
              Copy reference ID
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? <Card>Loading summary…</Card> : null}
      {error ? (
        <Card style={{ color: colors.danger, display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>Unable to load review summary</div>
          <div>{error.message}</div>
          <div style={{ fontSize: 13, color: text.subtle }}>
            Status: {error.status ?? "unknown"}
          </div>
          {error.backendError ? (
            <div style={{ fontSize: 13, color: text.subtle }}>Error: {error.backendError}</div>
          ) : null}
          {error.detail ? (
            <div style={{ fontSize: 13, color: text.subtle }}>Detail: {error.detail}</div>
          ) : null}
          <div>
            <Button variant="secondary" onClick={() => void loadSummary()}>
              Retry
            </Button>
          </div>
        </Card>
      ) : null}

      {!loading && !error && summary ? (
        <>
          {intakeView ? (
            <Card style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Intake Summary</div>
                  <div style={{ fontSize: 13, color: text.subtle, marginTop: 4 }}>
                    {intakeView.detail}
                  </div>
                </div>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontWeight: 700,
                    color: intakeTone(intakeView.state).color,
                    background: intakeTone(intakeView.state).background,
                  }}
                >
                  {intakeTone(intakeView.state).label}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {intakeView.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      background: "#fff",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 800, color: metric.accent }}>{metric.value}</div>
                    <div style={{ fontWeight: 600, color: text.main }}>{metric.label}</div>
                    <div style={{ fontSize: 12, color: text.subtle }}>{metric.hint}</div>
                  </div>
                ))}
              </div>

              <Card style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Shared package categories</div>
                <div style={{ fontSize: 12, color: text.subtle }}>
                  These categories match the tenant-facing package language and only reflect records available in the current authorized review summary.
                </div>
                {intakeView.packageCategories.map((item) => {
                  const tone =
                    item.status === "ready"
                      ? { color: "#166534", background: "#dcfce7", label: "Available to review" }
                      : item.status === "partial"
                      ? { color: "#1d4ed8", background: "#dbeafe", label: "Partly available" }
                      : { color: "#9a3412", background: "#ffedd5", label: "Missing" };
                  return (
                    <div
                      key={item.key}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 600, color: text.main }}>{item.label}</div>
                        <div
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            color: tone.color,
                            background: tone.background,
                          }}
                        >
                          {tone.label}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: text.subtle }}>{item.detail}</div>
                    </div>
                  );
                })}
              </Card>

              <Card style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Missing items</div>
                <div style={{ fontSize: 12, color: text.subtle }}>
                  Missing categories stay high-level so this view does not imply access to anything the tenant has not shared.
                </div>
                {intakeView.missingItems.length ? (
                  intakeView.missingItems.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: text.main }}>{item.label}</div>
                      <div style={{ fontSize: 13, color: text.subtle }}>{item.detail}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: text.subtle }}>
                    No major intake gaps are surfaced in the current review summary.
                  </div>
                )}
                <div style={{ fontSize: 12, color: text.subtle }}>
                  Shared with tenant permission and current server-authorized review access.
                </div>
              </Card>

              <Card style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Recent activity</div>
                <div style={{ fontSize: 12, color: text.subtle }}>
                  Recent review-state updates are shown here using the same authorized summary and current package state.
                </div>
                {recentActivity.length ? (
                  recentActivity.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 600, color: text.main }}>{item.title}</div>
                        <div
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            color: item.actionRequired ? "#9a3412" : "#1d4ed8",
                            background: item.actionRequired ? "#ffedd5" : "#dbeafe",
                          }}
                        >
                          {item.actionRequired ? "Needs attention" : "Updated"}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: text.subtle }}>{item.description}</div>
                      <div style={{ fontSize: 12, color: text.subtle }}>
                        {(item.actorLabel ? `${item.actorLabel} • ` : "") + dateOr(item.occurredAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: text.subtle }}>
                    No recent review activity is available from the current summary yet.
                  </div>
                )}
              </Card>
            </Card>
          ) : null}

          {guidanceView && interactionLoop && resolutionView ? (
            <Card style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Follow-up resolution</div>
                  <div style={{ fontSize: 13, color: text.subtle, marginTop: 4 }}>
                    {guidanceView.explanation}
                  </div>
                </div>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontWeight: 700,
                    color: followUpTone(guidanceView.state).color,
                    background: followUpTone(guidanceView.state).background,
                  }}
                >
                  {followUpTone(guidanceView.state).label}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 700, color: text.main }}>Still needs follow-up</div>
                  {resolutionView.openFollowUpCategories.length ? (
                    resolutionView.openFollowUpCategories.map((item) => (
                      <div key={item.key} style={{ fontSize: 13, color: text.subtle }}>
                        <strong style={{ color: text.main }}>{item.label}:</strong> {item.detail}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: text.subtle }}>
                      No categories still need follow-up from the current authorized package.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 700, color: text.main }}>Now appears addressed</div>
                  {resolutionView.addressedCategories.length ? (
                    resolutionView.addressedCategories.map((item) => (
                      <div key={item.key} style={{ fontSize: 13, color: text.subtle }}>
                        <strong style={{ color: text.main }}>{item.label}:</strong> {item.detail}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: text.subtle }}>
                      No addressed categories are visible yet from the current authorized package.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Structured follow-up loop</div>
                <div style={{ fontSize: 13, color: text.subtle }}>{interactionLoop.detail}</div>
                {resolutionView.openFollowUpCategories.length ? (
                  <div style={{ fontSize: 13, color: text.subtle }}>
                    Follow-up stays organized by aligned package categories so the tenant and landlord are looking at the same high-level areas.
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: text.subtle }}>
                    The currently visible follow-up categories now appear addressed, so this package is ready for re-review.
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Next steps</div>
                {interactionLoop.nextSteps.map((step) => (
                  <div
                    key={step}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      padding: 10,
                      fontSize: 13,
                      color: text.subtle,
                    }}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {decisionWorkspace ? (
            <Card style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Decision workspace</div>
                  <div style={{ fontSize: 13, color: text.subtle, marginTop: 4 }}>
                    {decisionWorkspace.explanation}
                  </div>
                </div>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontWeight: 700,
                    color: decisionTone(decisionWorkspace.decisionState).color,
                    background: decisionTone(decisionWorkspace.decisionState).background,
                  }}
                >
                  {decisionTone(decisionWorkspace.decisionState).label}
                </div>
              </div>

              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: 10,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700, color: text.main }}>Decision status</div>
                <div style={{ fontSize: 13, color: text.subtle }}>
                  {decisionWorkspace.statusLabel}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 700, color: text.main }}>What is still missing</div>
                  {decisionWorkspace.blockers.length ? (
                    decisionWorkspace.blockers.map((item, index) => (
                      <div key={`${item}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                        {item}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: text.subtle }}>
                      No decision blockers are currently surfaced in this read-first workspace.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 700, color: text.main }}>Next steps</div>
                  {decisionWorkspace.nextSteps.map((step, index) => (
                    <div key={`${step}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 12, color: text.subtle }}>
                This workspace helps organize the next landlord step after review. It does not automate approval, decline, or lease actions.
              </div>

              {decisionOutcome ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: text.main }}>Decision outcome</div>
                      <div style={{ fontSize: 13, color: text.subtle, marginTop: 4 }}>
                        {decisionOutcome.description}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontWeight: 700,
                        color: decisionOutcomeTone(decisionOutcome.outcomeState).color,
                        background: decisionOutcomeTone(decisionOutcome.outcomeState).background,
                      }}
                    >
                      {decisionOutcomeTone(decisionOutcome.outcomeState).label}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: text.subtle }}>
                    {decisionOutcome.sourceLabel}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Outcome blockers</div>
                      {decisionOutcome.blockers.length ? (
                        decisionOutcome.blockers.map((item, index) => (
                          <div key={`${item}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                            {item}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: text.subtle }}>
                          No current blockers are surfaced for this structured outcome view.
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Outcome next steps</div>
                      {decisionOutcome.landlordNextSteps.map((step, index) => (
                        <div key={`${step}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {leaseTransition ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: text.main }}>Lease step</div>
                      <div style={{ fontSize: 13, color: text.subtle, marginTop: 4 }}>
                        {leaseTransition.explanation}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontWeight: 700,
                        color: leaseTransitionTone(leaseTransition.transitionState).color,
                        background: leaseTransitionTone(leaseTransition.transitionState).background,
                      }}
                    >
                      {leaseTransitionTone(leaseTransition.transitionState).label}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Lease blockers</div>
                      {leaseTransition.blockers.length ? (
                        leaseTransition.blockers.map((item, index) => (
                          <div key={`${item}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                            {item}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: text.subtle }}>
                          No lease-step blockers are currently surfaced in this read-first transition view.
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Next action</div>
                      {leaseTransition.nextActions.map((step, index) => (
                        <div key={`${step}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {leasePreparation ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: text.main }}>Lease preparation</div>
                      <div style={{ fontSize: 13, color: text.subtle, marginTop: 4 }}>
                        {leasePreparation.explanation}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontWeight: 700,
                        color: leasePreparationTone(leasePreparation.preparationState).color,
                        background: leasePreparationTone(leasePreparation.preparationState).background,
                      }}
                    >
                      {leasePreparationTone(leasePreparation.preparationState).label}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Completed items</div>
                      {leasePreparation.completedItems.length ? (
                        leasePreparation.completedItems.map((item) => (
                          <div key={item.key} style={{ fontSize: 13, color: text.subtle }}>
                            <strong style={{ color: text.main }}>{item.label}:</strong> {item.detail}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: text.subtle }}>
                          No completed lease-preparation items are surfaced from this review-summary view yet.
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Outstanding items</div>
                      {leasePreparation.outstandingItems.length ? (
                        leasePreparation.outstandingItems.map((item) => (
                          <div key={item.key} style={{ fontSize: 13, color: text.subtle }}>
                            <strong style={{ color: text.main }}>{item.label}:</strong> {item.detail}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: text.subtle }}>
                          No outstanding lease-preparation items are currently surfaced from the visible review state.
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Preparation blockers</div>
                      {leasePreparation.blockers.length ? (
                        leasePreparation.blockers.map((item, index) => (
                          <div key={`${item}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                            {item}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: text.subtle }}>
                          No current blockers are surfaced in this read-first preparation workspace.
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Next steps</div>
                      {leasePreparation.nextActions.map((step, index) => (
                        <div key={`${step}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {moveInReadiness ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: text.main }}>Move-in readiness</div>
                      <div style={{ fontSize: 13, color: text.subtle, marginTop: 4 }}>
                        {moveInReadiness.explanation}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontWeight: 700,
                        color: moveInReadinessTone(moveInReadiness.readinessState).color,
                        background: moveInReadinessTone(moveInReadiness.readinessState).background,
                      }}
                    >
                      {moveInReadinessTone(moveInReadiness.readinessState).label}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Completed items</div>
                      {moveInReadiness.completedItems.length ? (
                        moveInReadiness.completedItems.map((item) => (
                          <div key={item.key} style={{ fontSize: 13, color: text.subtle }}>
                            <strong style={{ color: text.main }}>{item.label}:</strong> {item.detail}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: text.subtle }}>
                          No completed move-in readiness items are surfaced from this review-summary view yet.
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Outstanding items</div>
                      {moveInReadiness.outstandingItems.length ? (
                        moveInReadiness.outstandingItems.map((item) => (
                          <div key={item.key} style={{ fontSize: 13, color: text.subtle }}>
                            <strong style={{ color: text.main }}>{item.label}:</strong> {item.detail}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: text.subtle }}>
                          No outstanding move-in readiness items are currently surfaced from the visible review state.
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Readiness blockers</div>
                      {moveInReadiness.blockers.length ? (
                        moveInReadiness.blockers.map((item, index) => (
                          <div key={`${item}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                            {item}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: text.subtle }}>
                          No current blockers are surfaced in this read-first move-in readiness workspace.
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Next steps</div>
                      {moveInReadiness.nextActions.map((step, index) => (
                        <div key={`${step}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {executionWorkspace ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: text.main }}>Lease execution workspace</div>
                      <div style={{ fontSize: 13, color: text.subtle, marginTop: 4 }}>
                        {executionWorkspace.explanation}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontWeight: 700,
                        color: leaseExecutionReadinessTone(executionWorkspace.executionState).color,
                        background: leaseExecutionReadinessTone(executionWorkspace.executionState).background,
                      }}
                    >
                      {leaseExecutionReadinessTone(executionWorkspace.executionState).label}
                    </div>
                  </div>

                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      padding: 10,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: text.main }}>Execution status</div>
                    <div style={{ fontSize: 13, color: text.subtle }}>{executionWorkspace.label}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Blockers</div>
                      {executionWorkspace.blockers.length ? (
                        executionWorkspace.blockers.map((item, index) => (
                          <div key={`${item}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                            {item}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: text.subtle }}>
                          No current blockers are surfaced in this execution handoff view.
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: text.main }}>Next step</div>
                      {executionWorkspace.nextSteps.map((step, index) => (
                        <div key={`${step}-${index}`} style={{ fontSize: 13, color: text.subtle }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: text.subtle }}>
                    This workspace defines the handoff from structured readiness into the real-world execution process. It does not imply signing, payment, or completion has already happened.
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          {structuredNotifications.length ? (
            <Card style={{ display: "grid", gap: 8 }}>
              <StructuredNotificationList
                heading="Recent updates"
                emptyLabel="Recent workflow-triggered review updates will appear here as the package changes."
                items={structuredNotifications}
              />
            </Card>
          ) : null}

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Applicant Overview</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {kv("Name", summary.applicant.name || "Not provided")}
              {kv("Email", summary.applicant.email || "Not provided")}
              {kv(
                "Address",
                [
                  summary.applicant.currentAddressLine,
                  summary.applicant.city,
                  summary.applicant.provinceState,
                  summary.applicant.postalCode,
                  summary.applicant.country,
                ]
                  .filter(Boolean)
                  .join(", ") || "Not provided"
              )}
              {kv(
                "Time at current address",
                summary.applicant.timeAtCurrentAddressMonths != null
                  ? `${summary.applicant.timeAtCurrentAddressMonths} months`
                  : "Not provided"
              )}
              {kv("Current rent", money(summary.applicant.currentRentAmountCents))}
            </div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Employment & Income</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {kv("Employer", summary.employment.employerName || "Not provided")}
              {kv("Job title", summary.employment.jobTitle || "Not provided")}
              {kv("Income", money(summary.employment.incomeAmountCents))}
              {kv("Income frequency", summary.employment.incomeFrequency || "Not provided")}
              {kv("Income monthly (derived)", money(summary.employment.incomeMonthlyCents))}
              {kv(
                "Months at current job",
                summary.employment.monthsAtJob != null ? String(summary.employment.monthsAtJob) : "Not provided"
              )}
              {kv("Work reference name", summary.reference.name || "Not provided")}
              {kv("Work reference phone", summary.reference.phone || "Not provided")}
            </div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Screening & Compliance</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {kv("Screening status", summary.screening.status || "not_run")}
              {kv("Screening provider", summary.screening.provider || "Not provided")}
              {kv("Reference ID", summary.screening.referenceId || "Not provided")}
              {kv(
                "Completeness",
                `${summary.derived.completeness.label} (${Math.round(summary.derived.completeness.score * 100)}%)`
              )}
              {kv("Income-to-rent ratio", ratio(summary.derived.incomeToRentRatio))}
              {kv("Consent version", summary.compliance.applicationConsentVersion || "Not provided")}
              {kv("Consent accepted at", dateOr(summary.compliance.applicationConsentAcceptedAt))}
              {kv("Signature type", summary.compliance.signatureType || "Not provided")}
              {kv("Signed at", dateOr(summary.compliance.signedAt))}
            </div>
            {summary.derived.flags.length ? (
              <div style={{ fontSize: 13, color: text.subtle }}>
                Flags: {summary.derived.flags.join(", ")}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: text.subtle }}>Flags: none</div>
            )}
          </Card>

          <ApplicationDecisionSummaryCard
            summary={summary.decisionSummary || null}
            onEvaluateRisk={handleEvaluateRisk}
            evaluatingRisk={evaluatingRisk}
            onDecision={handleDecision}
            submittingDecision={savingDecision}
          />

          <Card style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Insights</div>
            {summary.insights.length ? (
              <ul style={{ margin: 0, paddingLeft: 20, color: text.main }}>
                {summary.insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: text.subtle }}>No insights available.</div>
            )}
            <div style={{ fontSize: 12, color: text.subtle }}>
              This summary is descriptive and does not provide approval/denial recommendations.
            </div>
          </Card>
        </>
      ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function ApplicationReviewSummaryPage() {
  return (
    <ReviewSummaryErrorBoundary>
      <ApplicationReviewSummaryPageBody />
    </ReviewSummaryErrorBoundary>
  );
}
