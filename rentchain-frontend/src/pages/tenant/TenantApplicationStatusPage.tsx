import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getTenantApplicationCompletion,
  type TenantApplicationCompletionItem,
  type TenantApplicationCompletionStatus,
} from "../../api/tenantApplicationCompletion";
import { getTenantNotificationPreferences } from "../../api/tenantNotificationPreferences";
import { getTenantAccess } from "../../api/tenantAccess";
import { getTenantAttachments } from "../../api/tenantAttachmentsApi";
import { getTenantProfile } from "../../api/tenantProfile";
import { getTenantLeaseWorkspace } from "../../api/tenantPortal";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantLoadingState,
  TenantSurfaceShell,
  TenantUnauthorizedState,
  formatDate,
  prettyStatus,
} from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";
import { buildTenantApplicationReuseView } from "./tenantApplicationReuse";
import { buildTenantApplicationFlow } from "./tenantApplicationFlow";
import { buildTenantLandlordInteractionLoop } from "../tenantLandlordInteractionLoop";
import { buildFollowUpResolutionState } from "../followUpResolutionState";
import { buildLandlordDecisionOutcome } from "../landlordDecisionOutcome";
import { buildLeaseFlowTransitionState } from "../leaseFlowTransitionState";
import { buildLeasePreparationWorkspaceState } from "../leasePreparationWorkspaceState";
import { buildMoveInReadinessWorkspaceState } from "../moveInReadinessWorkspaceState";
import { buildLeaseExecutionReadinessState } from "../leaseExecutionReadinessState";
import { buildLeaseExecutionWorkspace } from "../leaseExecutionWorkspace";
import { buildLeaseSigningWorkspaceState } from "../leaseSigningWorkspaceState";
import { buildDepositPaymentFlowState } from "../depositPaymentFlowState";
import StructuredNotificationList from "../StructuredNotificationList";
import { buildTenantStructuredNotificationTriggers } from "../structuredNotificationTriggers";
import { filterStructuredNotificationsByPreferences } from "../notificationChannelRouting";
import { buildTenantWorkspaceModeView } from "./tenantWorkspaceMode";
import TenantWorkspaceModeBanner from "./TenantWorkspaceModeBanner";

function statusTone(status: TenantApplicationCompletionStatus) {
  switch (status) {
    case "completed":
    case "verified":
      return { label: status === "verified" ? "Verified" : "Completed", color: "#166534", background: "#dcfce7" };
    case "pending":
      return { label: "Pending", color: "#1d4ed8", background: "#dbeafe" };
    case "needs_review":
      return { label: "Needs review", color: "#9a3412", background: "#ffedd5" };
    case "missing":
      return { label: "Missing", color: "#991b1b", background: "#fee2e2" };
    case "not_started":
      return { label: "Not started", color: "#475569", background: "#e2e8f0" };
    default:
      return { label: "In progress", color: "#0f766e", background: "#ccfbf1" };
  }
}

function sectionSummary(status: TenantApplicationCompletionStatus) {
  if (status === "completed" || status === "verified") return "All key items in this section are complete.";
  if (status === "needs_review") return "At least one item needs attention before your file is fully ready.";
  if (status === "pending") return "This section is moving forward, but some steps are still being processed.";
  if (status === "missing" || status === "not_started") return "You still have steps to finish in this section.";
  return "You’ve started this section, but it still needs a few more updates.";
}

const CompletionProgressCard: React.FC<{ progressPercent: number; status: TenantApplicationCompletionStatus }> = ({
  progressPercent,
  status,
}) => {
  const tone = statusTone(status);
  return (
    <TenantInfoCard heading="Completion Progress" accent="#1d4ed8">
      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "2.4rem", fontWeight: 900, color: textTokens.primary, lineHeight: 1 }}>
              {progressPercent}%
            </div>
            <div style={{ color: textTokens.secondary }}>Complete based on your tenant-safe application checklist.</div>
          </div>
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontWeight: 700,
              color: tone.color,
              background: tone.background,
            }}
          >
            {tone.label}
          </div>
        </div>
        <div
          style={{
            width: "100%",
            height: 12,
            borderRadius: 999,
            background: "rgba(15,23,42,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(progressPercent, 100))}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #1d4ed8, #0f766e)",
            }}
          />
        </div>
      </div>
    </TenantInfoCard>
  );
};

const CompletionItemRow: React.FC<{ item: TenantApplicationCompletionItem }> = ({ item }) => {
  const tone = statusTone(item.status);
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.label}</div>
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
      {item.nextAction ? <div style={{ color: textTokens.secondary }}>{item.nextAction}</div> : null}
      {item.actionPath ? (
        <div>
          <Link to={item.actionPath} style={{ fontWeight: 700 }}>
            {item.actionLabel || "Continue this step"}
          </Link>
        </div>
      ) : null}
    </div>
  );
};

export default function TenantApplicationStatusPage() {
  const location = useLocation();
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantApplicationCompletion>>>(null);
  const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof getTenantProfile>> | null>(null);
  const [attachments, setAttachments] = React.useState<Awaited<ReturnType<typeof getTenantAttachments>> | null>(null);
  const [access, setAccess] = React.useState<Awaited<ReturnType<typeof getTenantAccess>> | null>(null);
  const [lease, setLease] = React.useState<Awaited<ReturnType<typeof getTenantLeaseWorkspace>> | null>(null);
  const [notificationPreferences, setNotificationPreferences] = React.useState<Awaited<ReturnType<typeof getTenantNotificationPreferences>> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [completionResult, profileResult, attachmentsResult, accessResult, leaseResult, preferencesResult] = await Promise.allSettled([
        getTenantApplicationCompletion(),
        getTenantProfile(),
        getTenantAttachments(),
        getTenantAccess(),
        getTenantLeaseWorkspace(),
        getTenantNotificationPreferences(),
      ]);
      if (completionResult.status !== "fulfilled") {
        throw completionResult.reason;
      }
      setData(completionResult.value);
      setProfile(profileResult.status === "fulfilled" ? profileResult.value : null);
      setAttachments(attachmentsResult.status === "fulfilled" ? attachmentsResult.value : null);
      setAccess(accessResult.status === "fulfilled" ? accessResult.value : null);
      setLease(leaseResult.status === "fulfilled" ? leaseResult.value : null);
      setNotificationPreferences(preferencesResult.status === "fulfilled" ? preferencesResult.value : null);
    } catch (err: any) {
      setData(null);
      setProfile(null);
      setAttachments(null);
      setAccess(null);
      setLease(null);
      setNotificationPreferences(null);
      setError(err?.payload?.error || err?.message || "Unable to load application completion.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <TenantSurfaceShell
        title="Application Completion"
        subtitle="Follow the guided completion engine to see what’s done, what’s missing, and what needs review."
      >
        <TenantLoadingState label="Loading your application completion checklist..." />
      </TenantSurfaceShell>
    );
  }

  if (error) {
    const unauthorized = /unauthorized|forbidden|ambiguous/i.test(error);
    return (
      <TenantSurfaceShell
        title="Application Completion"
        subtitle="This view only uses tenant-safe application completion signals from your current tenancy or application context."
      >
        {unauthorized ? <TenantUnauthorizedState /> : <TenantErrorState message={error} retry={load} />}
      </TenantSurfaceShell>
    );
  }

  if (!data) {
    return (
      <TenantSurfaceShell
        title="Application Completion"
        subtitle="Follow the guided completion engine to see what’s done, what’s missing, and what needs review."
      >
        <TenantEmptyState
          title="No application checklist yet"
          body="We couldn’t find an active tenant-safe application completion view for this workspace yet."
        />
      </TenantSurfaceShell>
    );
  }

  const reuse = buildTenantApplicationReuseView({
    completion: data,
    profile,
    attachments,
    access,
  });
  const flow = buildTenantApplicationFlow({
    search: location.search,
    completion: data,
    reuse,
  });
  const interactionLoop = buildTenantLandlordInteractionLoop({
    audience: "tenant",
    packageCategories: reuse.packageCategories,
  });
  const resolutionView = buildFollowUpResolutionState(reuse.packageCategories);
  const notificationItems = filterStructuredNotificationsByPreferences(
    buildTenantStructuredNotificationTriggers({
      packageCategories: reuse.packageCategories,
      completion: data,
      profile,
      attachments,
      access,
    }),
    notificationPreferences
  );
  const flowTone =
    flow.state === "ready_to_proceed"
      ? { color: "#166534", background: "#dcfce7", label: "Ready to proceed" }
      : flow.state === "ready_to_review"
      ? { color: "#1d4ed8", background: "#dbeafe", label: "Ready to review" }
      : flow.state === "needs_attention"
      ? { color: "#9a3412", background: "#ffedd5", label: "Needs attention" }
      : { color: "#0f766e", background: "#ccfbf1", label: "Readiness" };
  const entryLabel = flow.entry === "invite" ? "Invite entry" : flow.entry === "application" ? "Application link" : "Direct tenant navigation";
  const interactionTone =
    interactionLoop.state === "ready_for_rereview"
      ? { color: "#166534", background: "#dcfce7", label: "Ready for re-review" }
      : interactionLoop.state === "partly_addressed"
      ? { color: "#1d4ed8", background: "#dbeafe", label: "Partly addressed" }
      : { color: "#9a3412", background: "#ffedd5", label: "Follow-up needed" };
  const decisionOutcome = buildLandlordDecisionOutcome({
    followUpOverallState: resolutionView.overallState,
    remainingCategories: resolutionView.remainingCategoriesNeedingAttention,
  });
  const leaseTransition = buildLeaseFlowTransitionState({
    audience: "tenant",
    decisionOutcome,
    lease,
  });
  const leasePreparation = buildLeasePreparationWorkspaceState({
    audience: "tenant",
    decisionOutcome,
    leaseTransition,
    packageCategories: reuse.packageCategories,
    lease,
  });
  const modeView = buildTenantWorkspaceModeView(profile?.context || null);
  const decisionOutcomeTone =
    decisionOutcome.outcomeState === "ready_for_next_step"
      ? { color: "#166534", background: "#dcfce7", label: "Ready for next step" }
      : decisionOutcome.outcomeState === "not_proceeding"
      ? { color: "#7f1d1d", background: "#fee2e2", label: "Not proceeding" }
      : { color: "#1d4ed8", background: "#dbeafe", label: "Hold for later" };
  const leaseTransitionTone =
    leaseTransition.transitionState === "lease_step_started"
      ? { color: "#0f766e", background: "#ccfbf1", label: "Lease step started" }
      : leaseTransition.transitionState === "ready_for_lease_step"
      ? { color: "#166534", background: "#dcfce7", label: "Ready for lease step" }
      : leaseTransition.transitionState === "awaiting_next_action"
      ? { color: "#1d4ed8", background: "#dbeafe", label: "Awaiting next action" }
      : { color: "#9a3412", background: "#ffedd5", label: "Not ready for lease step" };
  const leasePreparationTone =
    leasePreparation.preparationState === "ready_for_execution"
      ? { color: "#166534", background: "#dcfce7", label: "Ready for execution" }
      : leasePreparation.preparationState === "preparing_lease"
      ? { color: "#0f766e", background: "#ccfbf1", label: "Preparing lease" }
      : leasePreparation.preparationState === "awaiting_next_action"
      ? { color: "#1d4ed8", background: "#dbeafe", label: "Awaiting next action" }
      : leasePreparation.preparationState === "needs_attention"
      ? { color: "#9a3412", background: "#ffedd5", label: "Needs attention" }
      : { color: "#64748b", background: "#e2e8f0", label: "Not started" };
  const moveInReadiness = buildMoveInReadinessWorkspaceState({
    audience: "tenant",
    decisionOutcome,
    leaseTransition,
    leasePreparation,
    packageCategories: reuse.packageCategories,
    lease,
  });
  const moveInReadinessTone =
    moveInReadiness.readinessState === "ready_for_move_in"
      ? { color: "#166534", background: "#dcfce7", label: "Ready for move-in" }
      : moveInReadiness.readinessState === "in_progress"
      ? { color: "#0f766e", background: "#ccfbf1", label: "Preparing for move-in" }
      : moveInReadiness.readinessState === "awaiting_next_action"
      ? { color: "#1d4ed8", background: "#dbeafe", label: "Awaiting next action" }
      : moveInReadiness.readinessState === "needs_attention"
      ? { color: "#9a3412", background: "#ffedd5", label: "Needs attention" }
      : { color: "#64748b", background: "#e2e8f0", label: "Not started" };
  const executionWorkspace = buildLeaseExecutionWorkspace({
    audience: "tenant",
    executionReadiness: buildLeaseExecutionReadinessState({
      audience: "tenant",
      decisionOutcome,
      leasePreparation,
      moveInReadiness,
      packageCategories: reuse.packageCategories,
      lease,
    }),
    lease,
  });
  const executionReadinessTone =
    executionWorkspace.executionState === "ready_for_execution"
      ? { color: "#166534", background: "#dcfce7", label: "Ready for execution" }
      : executionWorkspace.executionState === "execution_in_progress"
      ? { color: "#0f766e", background: "#ccfbf1", label: "Execution in progress" }
      : executionWorkspace.executionState === "awaiting_execution_action"
      ? { color: "#1d4ed8", background: "#dbeafe", label: "Preparing to complete your lease" }
      : { color: "#64748b", background: "#e2e8f0", label: "Not ready for execution" };
  const signingWorkspace = buildLeaseSigningWorkspaceState({
    audience: "tenant",
    executionWorkspace,
    lease,
  });
  const signingTone =
    signingWorkspace.signingState === "signed_or_completed"
      ? { color: "#166534", background: "#dcfce7", label: "Signed" }
      : signingWorkspace.signingState === "awaiting_tenant_signature"
      ? { color: "#1d4ed8", background: "#dbeafe", label: "Awaiting your signature" }
      : signingWorkspace.signingState === "awaiting_landlord_signature"
      ? { color: "#7c3aed", background: "#ede9fe", label: "Awaiting landlord signature" }
      : signingWorkspace.signingState === "signing_in_progress"
      ? { color: "#0f766e", background: "#ccfbf1", label: "Signing in progress" }
      : signingWorkspace.signingState === "ready_for_signing"
      ? { color: "#166534", background: "#dcfce7", label: "Ready for signing" }
      : { color: "#64748b", background: "#e2e8f0", label: "Not ready for signing" };
  const paymentWorkspace = buildDepositPaymentFlowState({
    audience: "tenant",
    signingWorkspace,
    lease,
  });
  const paymentTone =
    paymentWorkspace.paymentState === "paid"
      ? { color: "#166534", background: "#dcfce7", label: "Payment completed" }
      : paymentWorkspace.paymentState === "pending"
      ? { color: "#0f766e", background: "#ccfbf1", label: "Payment in progress" }
      : paymentWorkspace.paymentState === "requested"
      ? { color: "#1d4ed8", background: "#dbeafe", label: "Payment requested" }
      : paymentWorkspace.paymentState === "needs_attention"
      ? { color: "#9a3412", background: "#ffedd5", label: "Needs attention" }
      : { color: "#64748b", background: "#e2e8f0", label: "Not requested" };

  return (
    <TenantSurfaceShell
      title="Application Readiness"
      subtitle="Use your saved profile to prepare this application. Review what’s ready to share and add any missing details before you continue."
      action={
        <Link
          to="/tenant/profile"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px 12px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 700,
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          Review your profile
        </Link>
      }
    >
      <CompletionProgressCard progressPercent={data.progressPercent} status={data.status} />

      <TenantWorkspaceModeBanner view={modeView} />

      <TenantInfoCard heading="Flow Status" accent="#0891b2">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, color: textTokens.primary }}>{flow.title}</div>
              <div style={{ color: textTokens.secondary }}>{flow.detail}</div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
                color: flowTone.color,
                background: flowTone.background,
              }}
            >
              {flowTone.label}
            </div>
          </div>

          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.06)",
                color: textTokens.secondary,
                fontWeight: 700,
              }}
            >
              {entryLabel}
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.06)",
                color: textTokens.secondary,
                fontWeight: 700,
              }}
            >
              {flow.readyCount} readiness signal{flow.readyCount === 1 ? "" : "s"} ready
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.06)",
                color: textTokens.secondary,
                fontWeight: 700,
              }}
            >
              {flow.missingCount} missing item{flow.missingCount === 1 ? "" : "s"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: spacing.sm,
            }}
          >
            {flow.steps.map((step) => {
              const tone =
                step.status === "complete"
                  ? { color: "#166534", background: "#dcfce7", label: "Complete" }
                  : step.status === "current"
                  ? { color: "#1d4ed8", background: "#dbeafe", label: "Current" }
                  : { color: "#64748b", background: "#e2e8f0", label: "Up next" };
              return (
                <div
                  key={step.key}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>{step.label}</div>
                  <div
                    style={{
                      width: "fit-content",
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
              );
            })}
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Next step</div>
            <div style={{ color: textTokens.secondary }}>{flow.nextStepDetail}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to={flow.nextStepPath} style={{ fontWeight: 700 }}>
                {flow.nextStepLabel}
              </Link>
              <Link to="/tenant/profile" style={{ fontWeight: 700 }}>
                Profile
              </Link>
              <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
                Documents
              </Link>
              <Link to="/tenant/access" style={{ fontWeight: 700 }}>
                Access
              </Link>
            </div>
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Application Readiness Summary" accent="#0f766e">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: spacing.sm,
          }}
        >
          {reuse.metrics.map((metric) => (
            <div
              key={metric.label}
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: metric.accent }}>{metric.value}</div>
              <div style={{ color: textTokens.secondary, fontWeight: 700 }}>{metric.label}</div>
              <div style={{ color: textTokens.muted, fontSize: 12 }}>{metric.hint}</div>
            </div>
          ))}
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Recent activity / notifications" accent="#0891b2">
        <StructuredNotificationList
          heading="Recent workflow updates"
          emptyLabel="Recent workflow-triggered notifications will appear here once this application starts moving through review and follow-up."
          items={notificationItems}
        />
      </TenantInfoCard>

      <TenantInfoCard heading="Decision outcome" accent="#0f766e">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, color: textTokens.primary }}>{decisionOutcome.label}</div>
              <div style={{ color: textTokens.secondary }}>{decisionOutcome.tenantDescription}</div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
                color: decisionOutcomeTone.color,
                background: decisionOutcomeTone.background,
              }}
            >
              {decisionOutcomeTone.label}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>What this means</div>
            <div style={{ color: textTokens.secondary }}>
              {decisionOutcome.source === "explicit"
                ? "This high-level outcome comes from the current authorized application outcome record."
                : "This high-level outcome is derived from your current follow-up and re-review state."}
            </div>
            {decisionOutcome.blockers.length ? (
              <div style={{ display: "grid", gap: 6 }}>
                {decisionOutcome.blockers.map((item) => (
                  <div key={item} style={{ color: textTokens.secondary }}>
                    {item}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Next steps</div>
            {decisionOutcome.tenantNextSteps.map((step) => (
              <div key={step} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Lease step" accent="#7c3aed">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, color: textTokens.primary }}>{leaseTransition.label}</div>
              <div style={{ color: textTokens.secondary }}>{leaseTransition.explanation}</div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
                color: leaseTransitionTone.color,
                background: leaseTransitionTone.background,
              }}
            >
              {leaseTransitionTone.label}
            </div>
          </div>

          {leaseTransition.blockers.length ? (
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: textTokens.primary }}>What is still blocking this step</div>
              {leaseTransition.blockers.map((item) => (
                <div key={item} style={{ color: textTokens.secondary }}>
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Next step</div>
            {leaseTransition.nextActions.map((step) => (
              <div key={step} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
            {leaseTransition.transitionState === "lease_step_started" ? (
              <Link to="/tenant/lease" style={{ fontWeight: 700 }}>
                Open lease details
              </Link>
            ) : null}
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Lease preparation" accent="#6d28d9">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, color: textTokens.primary }}>{leasePreparation.label}</div>
              <div style={{ color: textTokens.secondary }}>{leasePreparation.explanation}</div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
                color: leasePreparationTone.color,
                background: leasePreparationTone.background,
              }}
            >
              {leasePreparationTone.label}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Completed items</div>
            {leasePreparation.completedItems.length ? (
              leasePreparation.completedItems.map((item) => (
                <div key={item.key} style={{ color: textTokens.secondary }}>
                  <strong style={{ color: textTokens.primary }}>{item.label}:</strong> {item.detail}
                </div>
              ))
            ) : (
              <div style={{ color: textTokens.secondary }}>
                No completed lease-preparation items are visible in your tenant workspace yet.
              </div>
            )}
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Outstanding items</div>
            {leasePreparation.outstandingItems.length ? (
              leasePreparation.outstandingItems.map((item) => (
                <div key={item.key} style={{ color: textTokens.secondary }}>
                  <strong style={{ color: textTokens.primary }}>{item.label}:</strong> {item.detail}
                </div>
              ))
            ) : (
              <div style={{ color: textTokens.secondary }}>
                No outstanding preparation items are currently visible in your tenant workspace.
              </div>
            )}
          </div>

          {leasePreparation.blockers.length ? (
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: textTokens.primary }}>Needs attention</div>
              {leasePreparation.blockers.map((item, index) => (
                <div key={`${item}-${index}`} style={{ color: textTokens.secondary }}>
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Next steps</div>
            {leasePreparation.nextActions.map((step, index) => (
              <div key={`${step}-${index}`} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
            {leaseTransition.transitionState === "lease_step_started" ? (
              <Link to="/tenant/lease" style={{ fontWeight: 700 }}>
                Open lease details
              </Link>
            ) : null}
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Move-in readiness" accent="#0f766e">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, color: textTokens.primary }}>{moveInReadiness.label}</div>
              <div style={{ color: textTokens.secondary }}>{moveInReadiness.explanation}</div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
                color: moveInReadinessTone.color,
                background: moveInReadinessTone.background,
              }}
            >
              {moveInReadinessTone.label}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Completed items</div>
            {moveInReadiness.completedItems.length ? (
              moveInReadiness.completedItems.map((item) => (
                <div key={item.key} style={{ color: textTokens.secondary }}>
                  <strong style={{ color: textTokens.primary }}>{item.label}:</strong> {item.detail}
                </div>
              ))
            ) : (
              <div style={{ color: textTokens.secondary }}>
                No completed move-in readiness items are visible in your tenant workspace yet.
              </div>
            )}
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Outstanding items</div>
            {moveInReadiness.outstandingItems.length ? (
              moveInReadiness.outstandingItems.map((item) => (
                <div key={item.key} style={{ color: textTokens.secondary }}>
                  <strong style={{ color: textTokens.primary }}>{item.label}:</strong> {item.detail}
                </div>
              ))
            ) : (
              <div style={{ color: textTokens.secondary }}>
                No outstanding move-in readiness items are currently visible in your tenant workspace.
              </div>
            )}
          </div>

          {moveInReadiness.blockers.length ? (
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: textTokens.primary }}>Needs attention</div>
              {moveInReadiness.blockers.map((item, index) => (
                <div key={`${item}-${index}`} style={{ color: textTokens.secondary }}>
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Next steps</div>
            {moveInReadiness.nextActions.map((step, index) => (
              <div key={`${step}-${index}`} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/tenant/profile" style={{ fontWeight: 700 }}>
                Review your profile
              </Link>
              <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
                Open documents
              </Link>
              <Link to="/tenant/access" style={{ fontWeight: 700 }}>
                Review access
              </Link>
              <Link to="/tenant/lease" style={{ fontWeight: 700 }}>
                Open lease details
              </Link>
            </div>
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Lease execution" accent="#0f766e">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, color: textTokens.primary }}>{executionWorkspace.label}</div>
              <div style={{ color: textTokens.secondary }}>{executionWorkspace.explanation}</div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
                color: executionReadinessTone.color,
                background: executionReadinessTone.background,
              }}
            >
              {executionReadinessTone.label}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>What happens next</div>
            <div style={{ color: textTokens.secondary }}>
              This handoff view shows whether your file is ready to move into the next lease step without implying signing or completion has already happened.
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Blockers</div>
            {executionWorkspace.blockers.length ? (
              executionWorkspace.blockers.map((item, index) => (
                <div key={`${item}-${index}`} style={{ color: textTokens.secondary }}>
                  {item}
                </div>
              ))
            ) : (
              <div style={{ color: textTokens.secondary }}>
                No current blockers are visible in your tenant workspace for this handoff stage.
              </div>
            )}
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Next steps</div>
            {executionWorkspace.nextSteps.map((step, index) => (
              <div key={`${step}-${index}`} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Lease signing" accent="#7c3aed">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, color: textTokens.primary }}>{signingWorkspace.label}</div>
              <div style={{ color: textTokens.secondary }}>{signingWorkspace.explanation}</div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
                color: signingTone.color,
                background: signingTone.background,
              }}
            >
              {signingTone.label}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Who is expected to act</div>
            <div style={{ color: textTokens.secondary }}>{signingWorkspace.currentActorLabel}</div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Blockers</div>
            {signingWorkspace.blockers.length ? (
              signingWorkspace.blockers.map((item, index) => (
                <div key={`${item}-${index}`} style={{ color: textTokens.secondary }}>
                  {item}
                </div>
              ))
            ) : (
              <div style={{ color: textTokens.secondary }}>
                No current signing blockers are visible in your tenant workspace.
              </div>
            )}
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Next steps</div>
            {signingWorkspace.nextActions.map((step, index) => (
              <div key={`${step}-${index}`} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/tenant/lease" style={{ fontWeight: 700 }}>
                Review lease
              </Link>
              <Link to="/tenant/application" style={{ fontWeight: 700 }}>
                Review application
              </Link>
              <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
                Open documents
              </Link>
            </div>
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Deposit / first payment" accent="#1d4ed8">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, color: textTokens.primary }}>{paymentWorkspace.label}</div>
              <div style={{ color: textTokens.secondary }}>{paymentWorkspace.explanation}</div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
                color: paymentTone.color,
                background: paymentTone.background,
              }}
            >
              {paymentTone.label}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>What this payment covers</div>
            <div style={{ color: textTokens.secondary }}>{paymentWorkspace.paymentLabel}</div>
            {paymentWorkspace.amountLabel ? (
              <div style={{ color: textTokens.secondary }}>
                Requested amount: {paymentWorkspace.amountLabel}
              </div>
            ) : null}
            {paymentWorkspace.paymentMethodLabel ? (
              <div style={{ color: textTokens.secondary }}>
                Expected method: {paymentWorkspace.paymentMethodLabel}
              </div>
            ) : null}
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Who is expected to act</div>
            <div style={{ color: textTokens.secondary }}>{paymentWorkspace.currentActorLabel}</div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Blockers</div>
            {paymentWorkspace.blockers.length ? (
              paymentWorkspace.blockers.map((item, index) => (
                <div key={`${item}-${index}`} style={{ color: textTokens.secondary }}>
                  {item}
                </div>
              ))
            ) : (
              <div style={{ color: textTokens.secondary }}>
                No current payment blockers are visible in your tenant workspace.
              </div>
            )}
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Next steps</div>
            {paymentWorkspace.nextActions.map((step, index) => (
              <div key={`${step}-${index}`} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/tenant/lease" style={{ fontWeight: 700 }}>
                Review lease
              </Link>
              <Link to="/tenant/payments" style={{ fontWeight: 700 }}>
                Open payments
              </Link>
              <Link to="/tenant/application" style={{ fontWeight: 700 }}>
                Review application
              </Link>
            </div>
          </div>
        </div>
      </TenantInfoCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: spacing.md,
        }}
      >
        <TenantInfoCard heading="Share Package" accent="#1d4ed8">
          <div style={{ display: "grid", gap: spacing.sm }}>
            {reuse.packageCategories.map((item) => {
              const tone =
                item.status === "ready"
                  ? { color: "#166534", background: "#dcfce7", label: "Ready" }
                  : item.status === "partial"
                  ? { color: "#1d4ed8", background: "#dbeafe", label: "Partly ready" }
                  : { color: "#9a3412", background: "#ffedd5", label: "Needs attention" };
              return (
                <div
                  key={item.label}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.label}</div>
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
                  <div style={{ color: textTokens.secondary }}>{item.detail}</div>
                </div>
              );
            })}
          </div>
        </TenantInfoCard>

        <TenantInfoCard heading="Structured Follow-up" accent="#166534">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>{interactionLoop.headline}</div>
                  <div style={{ color: textTokens.secondary }}>{interactionLoop.detail}</div>
                </div>
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    color: interactionTone.color,
                    background: interactionTone.background,
                  }}
                >
                  {interactionTone.label}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                <div
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>Still needs attention</div>
                  {resolutionView.openFollowUpCategories.length ? (
                    resolutionView.openFollowUpCategories.map((item) => (
                      <div key={item.key} style={{ color: textTokens.secondary }}>
                        <strong style={{ color: textTokens.primary }}>{item.label}:</strong> {item.detail}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: textTokens.secondary }}>
                      No categories still need attention from the current tenant-safe package.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>Addressed</div>
                  {resolutionView.addressedCategories.length ? (
                    resolutionView.addressedCategories.map((item) => (
                      <div key={item.key} style={{ color: textTokens.secondary }}>
                        <strong style={{ color: textTokens.primary }}>{item.label}:</strong> {item.detail}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: textTokens.secondary }}>
                      Addressed categories will appear here as your package becomes more complete.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700, color: textTokens.primary }}>Next steps</div>
              {interactionLoop.nextSteps.map((step) => (
                <div
                  key={step}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    color: textTokens.secondary,
                  }}
                >
                  {step}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700, color: textTokens.primary }}>Go next</div>
              {interactionLoop.actions.map((action) => (
                <div
                  key={action.path}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>{action.label}</div>
                  <div style={{ color: textTokens.secondary }}>{action.detail}</div>
                  <div style={{ color: textTokens.secondary, fontSize: 12 }}>
                    Covers: {action.categories.join(", ")}
                  </div>
                  <Link to={action.path} style={{ fontWeight: 700 }}>
                    {action.label}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </TenantInfoCard>
      </div>

      <TenantInfoCard heading="Missing Details" accent="#b45309">
        {reuse.missingItems.length ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {reuse.missingItems.slice(0, 8).map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.label}</div>
                <div style={{ color: textTokens.secondary }}>{item.detail}</div>
                {item.actionPath ? (
                  <Link to={item.actionPath} style={{ fontWeight: 700 }}>
                    {item.actionLabel || "Review this step"}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: textTokens.secondary }}>
            No major missing details are surfaced right now. Review the sections below before you continue.
          </div>
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Review Before Sharing" accent="#0891b2">
        <div style={{ display: "grid", gap: spacing.sm }}>
          {reuse.shareInsights.map((item) => (
            <div key={item.label} style={{ color: textTokens.secondary }}>
              <strong style={{ color: textTokens.primary }}>{item.label}:</strong> {item.detail}
            </div>
          ))}
          <div style={{ color: textTokens.secondary }}>
            <strong style={{ color: textTokens.primary }}>Shared package:</strong> Profile details, rental history, documents & records, consent / identity status, and application readiness stay aligned with what a landlord can review today.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/tenant/profile" style={{ fontWeight: 700 }}>
              Review your profile
            </Link>
            <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
              Open documents
            </Link>
            <Link to="/tenant/access" style={{ fontWeight: 700 }}>
              Review access
            </Link>
          </div>
          <div style={{ color: textTokens.muted }}>
            This v1 view does not invent autofill or document-level sharing controls that are not already supported elsewhere in the tenant workspace.
          </div>
        </div>
      </TenantInfoCard>

      {data.nextSteps.length ? (
        <TenantInfoCard heading="Next Steps" accent="#0891b2">
          <div style={{ display: "grid", gap: 8 }}>
            {data.nextSteps.map((step) => (
              <div key={step} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
          </div>
        </TenantInfoCard>
      ) : (
        <TenantInfoCard heading="Next Steps" accent="#0891b2">
          <div style={{ color: textTokens.muted }}>
            No extra actions are required right now. Keep an eye on your feed for updates.
          </div>
        </TenantInfoCard>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: spacing.md,
        }}
      >
        {data.sections.map((section) => {
          const tone = statusTone(section.status);
          return (
            <TenantInfoCard key={section.key} heading={section.label} accent={tone.color}>
              <div style={{ display: "grid", gap: spacing.sm }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ color: textTokens.secondary }}>{sectionSummary(section.status)}</div>
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
                <div style={{ display: "grid", gap: 10 }}>
                  {section.items.map((item) => (
                    <CompletionItemRow key={`${section.key}:${item.key}`} item={item} />
                  ))}
                </div>
              </div>
            </TenantInfoCard>
          );
        })}
      </div>

      <TenantInfoCard heading="Checklist Updated" accent="#7c3aed">
        <div style={{ color: textTokens.secondary }}>
          Last updated: <strong>{formatDate(data.updatedAt)}</strong>
        </div>
        <div style={{ color: textTokens.muted }}>
          Status: <strong>{prettyStatus(data.status)}</strong>
        </div>
        <div style={{ color: textTokens.muted }}>
          Review what’s ready before continuing so this application feels like a guided reuse flow, not a blank restart.
        </div>
      </TenantInfoCard>
    </TenantSurfaceShell>
  );
}
