import React from "react";
import { Button, Card } from "../ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";

type ChecklistStep = {
  key: string;
  title: string;
  description: string;
  isComplete: boolean;
  actionLabel: string;
  onAction: () => void;
  isPrimary?: boolean;
};

type StarterOnboardingPanelProps = {
  steps: ChecklistStep[];
  loading?: boolean;
  onDismiss?: () => void;
};

type ChecklistItemProps = {
  title: string;
  description: string;
  isComplete: boolean;
  loading?: boolean;
  actionLabel: string;
  onAction: () => void;
  isPrimary?: boolean;
};

const ChecklistItem: React.FC<ChecklistItemProps> = ({
  title,
  description,
  isComplete,
  loading = false,
  actionLabel,
  onAction,
  isPrimary = false,
}) => {
  const statusLabel = loading ? "Checking..." : isComplete ? "Complete" : "Next";
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: spacing.sm,
        alignItems: "center",
        justifyContent: "space-between",
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.md,
        background: colors.card,
      }}
    >
      <div style={{ flex: "1 1 240px" }}>
        <div style={{ fontWeight: 700, marginBottom: spacing.xxs }}>
          {title}{" "}
          <span
            style={{
              fontWeight: 600,
              fontSize: "0.85rem",
              color: loading ? text.muted : isComplete ? "#15803d" : text.muted,
            }}
          >
            {statusLabel}
          </span>
        </div>
        <div style={{ color: text.muted, fontSize: "0.9rem" }}>{description}</div>
      </div>
      <Button
        onClick={onAction}
        variant={isPrimary ? "primary" : "secondary"}
        aria-label={actionLabel}
        style={{ minWidth: 160 }}
        disabled={loading}
      >
        {actionLabel}
      </Button>
    </div>
  );
};

export const StarterOnboardingPanel: React.FC<StarterOnboardingPanelProps> = ({
  steps,
  loading = false,
  onDismiss,
}) => {
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: spacing.sm,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>Get started</h2>
          {onDismiss ? (
            <Button variant="ghost" onClick={onDismiss}>
              Hide
            </Button>
          ) : null}
        </div>
        <p style={{ marginTop: spacing.xs, marginBottom: 0, color: text.muted }}>
          Complete these steps to reach your first success.
        </p>

        <div style={{ display: "grid", gap: spacing.sm }}>
          {steps.map((step) => (
            <ChecklistItem
              key={step.key}
              title={step.title}
              description={step.description}
              isComplete={step.isComplete}
              loading={loading}
              actionLabel={step.actionLabel}
              onAction={step.onAction}
              isPrimary={step.isPrimary}
            />
          ))}
        </div>

        <div style={{ color: text.muted, fontSize: "0.9rem" }}>
          Onboarding never blocks core actions — it’s here to guide you.
        </div>
      </div>
    </Card>
  );
};

export default StarterOnboardingPanel;
