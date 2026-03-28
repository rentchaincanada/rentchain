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
};

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
}: Props) {
  const status = integration.status;
  const updatedAt = integration.updatedAt || integration.lastValidatedAt || integration.connectedAt;

  let body = "";
  let actions: Array<{ label: string; onClick: () => void; variant?: "primary" | "secondary" | "ghost" }> = [];

  if (status === "pending_credentialing") {
    body =
      "We’re waiting for your TransUnion membership details. Once you receive your member code and passcode, return here to complete setup.";
    actions = [
      { label: "Enter Membership Details", onClick: onEnterDetails, variant: "primary" },
      { label: "View Instructions", onClick: onViewInstructions },
    ];
  } else if (status === "connected") {
    body = "Your TransUnion membership is connected and ready for screening.";
    actions = [
      { label: "Update Credentials", onClick: onUpdateCredentials },
      { label: "Disconnect", onClick: onDisconnect, variant: "ghost" },
      ...(onStartScreening
        ? [{ label: "Start Screening", onClick: onStartScreening, variant: "primary" as const }]
        : []),
    ];
  } else if (status === "connection_error") {
    body =
      "We could not verify your TransUnion connection details. Please review and try again.";
    actions = [
      { label: "Retry", onClick: onConnectExisting, variant: "primary" },
      { label: "Update Credentials", onClick: onUpdateCredentials },
    ];
  } else {
    body =
      "Use your TransUnion membership to enable tenant screening in RentChain. New to TransUnion? We’ll help you get credentialed first.";
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
        </div>
        <TransUnionStatusBadge status={status} />
      </div>

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
        </div>
      ) : null}

      <ActionRow actions={actions} />
    </Card>
  );
}
