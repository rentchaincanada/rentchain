import React from "react";
import type { TransUnionIntegration } from "@/api/integrationsApi";
import { Button, Card } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";
import { TransUnionStatusBadge } from "./TransUnionStatusBadge";

type Props = {
  integration: TransUnionIntegration;
  loading?: boolean;
  onGetAccess: () => void;
  onConnectExisting: () => void;
  onEnterDetails: () => void;
  onViewInstructions: () => void;
  onUpdateCredentials: () => void;
  onDisconnect: () => void;
  onStartScreening?: () => void;
  onChooseApplicant?: () => void;
  selectedApplicationLabel?: string | null;
  readyToScreen?: boolean;
  screeningsCompletedCount?: number | null;
  lastScreeningDate?: string | number | null;
};

function safeLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") return null;
  return raw;
}

function ActionRow({
  actions,
}: {
  actions: Array<{ label: string; onClick: () => void; variant?: "primary" | "secondary" | "ghost" }>;
}) {
  return (
    <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
      {actions.map((action) => (
        <Button key={action.label} type="button" variant={action.variant || "secondary"} onClick={action.onClick}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function TransUnionConnectionCard({
  integration,
  loading = false,
  onGetAccess,
  onConnectExisting,
  onEnterDetails,
  onViewInstructions,
  onUpdateCredentials,
  onDisconnect,
  onStartScreening,
  onChooseApplicant,
  selectedApplicationLabel,
  readyToScreen = false,
  screeningsCompletedCount,
  lastScreeningDate,
}: Props) {
  const status = integration.status;
  const updatedAt = integration.updatedAt || integration.lastValidatedAt || integration.connectedAt;
  const progressState =
    status === "connected"
      ? "ready"
      : status === "pending_credentialing"
        ? "get_access"
        : "not_connected";
  const completedCount = Number.isFinite(Number(screeningsCompletedCount))
    ? Number(screeningsCompletedCount)
    : null;
  const safeSelectedApplicationLabel = safeLabel(selectedApplicationLabel);
  const formattedLastScreeningDate =
    lastScreeningDate == null
      ? null
      : Number.isNaN(new Date(lastScreeningDate).getTime())
      ? null
      : new Date(lastScreeningDate).toLocaleDateString();

  let body = "";
  let helper = "";
  let nextStep = "";
  let actions: Array<{ label: string; onClick: () => void; variant?: "primary" | "secondary" | "ghost" }> = [];

  if (status === "pending_credentialing") {
    body =
      "Your TransUnion credentialing is in progress. Once TransUnion issues your member code and passcode, return to RentChain to complete setup.";
    helper = "This path is for landlords who still need external TransUnion approval before they can screen inside RentChain.";
    nextStep = "Next step: finish credentialing, then enter your issued membership details here.";
    actions = [
      { label: "Enter Membership Details", onClick: onEnterDetails, variant: "primary" },
      { label: "View Instructions", onClick: onViewInstructions },
    ];
  } else if (status === "connected") {
    body = readyToScreen
      ? "Your TransUnion membership is connected and you are ready to screen an applicant inside RentChain."
      : "Your TransUnion membership is connected. Your next step is to choose an applicant so you can start the first screening.";
    helper = readyToScreen
      ? "You already have an application in context, so you can move straight into screening."
      : "Choose an applicant from Applications first, then start screening from that application context.";
    nextStep = readyToScreen
      ? `Next step: start screening${safeSelectedApplicationLabel ? ` for ${safeSelectedApplicationLabel}` : ""}.`
      : "Next step: choose an applicant below, then start your first screening.";
    actions = [
      { label: "Update Credentials", onClick: onUpdateCredentials },
      { label: "Disconnect", onClick: onDisconnect, variant: "ghost" },
      ...(readyToScreen && onStartScreening
        ? [{ label: completedCount && completedCount > 0 ? "Start Next Screening" : "Start Your First Screening", onClick: onStartScreening, variant: "primary" as const }]
        : onChooseApplicant
          ? [{ label: "Choose an Applicant", onClick: onChooseApplicant, variant: "primary" as const }]
          : []),
    ];
  } else if (status === "connection_error") {
    body =
      "We could not verify your TransUnion connection details. Please review and try again.";
    helper = "The workflow is still intact. Update the membership details and reconnect when ready.";
    nextStep = "Next step: retry your credentials or update them if anything changed.";
    actions = [
      { label: "Retry", onClick: onConnectExisting, variant: "primary" },
      { label: "Update Credentials", onClick: onUpdateCredentials },
    ];
  } else {
    body =
      "Use your TransUnion membership to enable tenant screening in RentChain. If you are not credentialed yet, RentChain will guide you through that first.";
    helper = "Choose the path that matches your current state so you can reach screening with fewer setup loops.";
    nextStep = "Next step: either start TransUnion credentialing or connect your existing membership.";
    actions = [
      { label: "Get TransUnion Access", onClick: onGetAccess, variant: "primary" },
      { label: "Connect Existing Membership", onClick: onConnectExisting },
    ];
  }

  return (
    <Card elevated data-testid="transunion-connection-card" style={{ display: "grid", gap: spacing.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: spacing.xs }}>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>TransUnion Connection</div>
          <div style={{ color: text.muted, lineHeight: 1.6 }}>{loading ? "Loading connection status..." : body}</div>
          {!loading && helper ? (
            <div style={{ color: text.subtle, fontSize: "0.92rem", lineHeight: 1.5 }}>{helper}</div>
          ) : null}
        </div>
        <TransUnionStatusBadge status={status} />
      </div>

      {!loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: spacing.sm,
          }}
        >
          {[
            {
              key: "not_connected",
              label: "Not connected",
              active: progressState === "not_connected",
              complete: progressState !== "not_connected",
            },
            {
              key: "get_access",
              label: "Connect or get access",
              active: progressState === "get_access",
              complete: progressState === "ready",
            },
            {
              key: "ready",
              label: "Ready to screen",
              active: progressState === "ready",
              complete: progressState === "ready",
            },
          ].map((step) => (
            <div
              key={step.key}
              style={{
                border: `1px solid ${step.active || step.complete ? colors.accent : colors.border}`,
                background: step.active || step.complete ? colors.accentSoft : colors.bg,
                color: step.active || step.complete ? text.primary : text.muted,
                borderRadius: radius.md,
                padding: spacing.sm,
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{step.label}</div>
              <div style={{ fontSize: "0.82rem" }}>
                {step.active ? "Current step" : step.complete ? "Completed" : "Upcoming"}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {status === "connected" ? (
        <div
          style={{
            display: "grid",
            gap: spacing.xs,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: colors.bg,
            fontSize: "0.94rem",
          }}
        >
          <div>Status: Connected</div>
          <div>Member code: {integration.memberCodeMasked || "Not available"}</div>
          <div>
            Last updated date: {updatedAt ? new Date(updatedAt).toLocaleDateString() : "Not available"}
          </div>
          <div>Connection type: Membership credentials</div>
          <div>Passcode: Stored securely and never shown again</div>
          {completedCount != null ? <div>Screenings completed: {completedCount}</div> : null}
          {formattedLastScreeningDate ? <div>Last screening date: {formattedLastScreeningDate}</div> : null}
          <div>{nextStep}</div>
        </div>
      ) : !loading ? (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: colors.bg,
            fontSize: "0.94rem",
            color: text.primary,
          }}
        >
          {nextStep}
        </div>
      ) : null}

      <ActionRow actions={actions} />
    </Card>
  );
}
