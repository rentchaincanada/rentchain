import React from "react";
import { Link } from "react-router-dom";
import { spacing, text as textTokens } from "../../styles/tokens";
import { TenantInfoCard } from "./TenantWorkspaceShared";
import {
  type TenantProfileCompletionItemStatus,
  type TenantProfileCompletionSummary,
} from "./tenantProfileCompletion";

function toneForStatus(status: TenantProfileCompletionItemStatus) {
  switch (status) {
    case "complete":
      return { label: "Complete", color: "#166534", background: "#dcfce7", accent: "#166534" };
    case "needs_attention":
      return { label: "Needs attention", color: "#9a3412", background: "#ffedd5", accent: "#9a3412" };
    case "pending":
      return { label: "In progress", color: "#1d4ed8", background: "#dbeafe", accent: "#1d4ed8" };
    default:
      return { label: "Missing details", color: "#991b1b", background: "#fee2e2", accent: "#991b1b" };
  }
}

type Props = {
  completion: TenantProfileCompletionSummary;
  actionLabel?: string;
  actionPath?: string;
  onAction?: (() => void) | null;
  compact?: boolean;
};

export default function TenantProfileCompletionCard({
  completion,
  actionLabel = "View your profile",
  actionPath = "/tenant/profile",
  onAction = null,
  compact = false,
}: Props) {
  const tone = toneForStatus(completion.overallStatus);
  const missingPreview = completion.missingItems.slice(0, compact ? 2 : 4);

  return (
    <TenantInfoCard heading="Profile completion" accent={tone.accent}>
      <div style={{ display: "grid", gap: spacing.sm }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: compact ? "2.1rem" : "2.4rem",
                fontWeight: 900,
                color: textTokens.primary,
                lineHeight: 1,
              }}
            >
              {completion.progressPercent}%
            </div>
            <div style={{ color: textTokens.secondary }}>
              {completion.completedCount} of {completion.totalCount} profile areas are in place.
            </div>
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
              width: `${Math.max(0, Math.min(completion.progressPercent, 100))}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #1d4ed8, #0f766e)",
            }}
          />
        </div>

        {missingPreview.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: textTokens.primary, fontWeight: 700 }}>
              Add missing details to keep your rental profile organized.
            </div>
            {missingPreview.map((item) => (
              <div key={item} style={{ color: textTokens.secondary }}>
                {item}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: textTokens.secondary }}>
            Your current tenant-safe profile view looks complete.
          </div>
        )}

        {onAction ? (
          <div>
            <button
              type="button"
              onClick={onAction}
              style={{
                fontWeight: 700,
                color: "#1d4ed8",
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
              }}
            >
              {actionLabel}
            </button>
          </div>
        ) : actionPath ? (
          <div>
            <Link to={actionPath} style={{ fontWeight: 700 }}>
              {actionLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </TenantInfoCard>
  );
}
