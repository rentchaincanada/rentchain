import React from "react";
import { Button, Card } from "../ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";

type StarterOnboardingPanelProps = {
  planName?: string;
  propertiesCount: number;
  applicationsCount: number;
  screeningStartedCount: number;
  onAddProperty: () => void;
  onCreateApplication: () => void;
  onStartScreening: () => void;
  onUpgrade?: () => void;
};

type ChecklistItemProps = {
  title: string;
  description: string;
  isComplete: boolean;
  actionLabel: string;
  onAction: () => void;
  isPrimary?: boolean;
};

const ChecklistItem: React.FC<ChecklistItemProps> = ({
  title,
  description,
  isComplete,
  actionLabel,
  onAction,
  isPrimary = false,
}) => {
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
              color: isComplete ? "#15803d" : text.muted,
            }}
          >
            {isComplete ? "Complete" : "Next"}
          </span>
        </div>
        <div style={{ color: text.muted, fontSize: "0.9rem" }}>{description}</div>
      </div>
      <Button
        onClick={onAction}
        variant={isPrimary ? "primary" : "secondary"}
        aria-label={actionLabel}
        style={{ minWidth: 160 }}
      >
        {actionLabel}
      </Button>
    </div>
  );
};

export const StarterOnboardingPanel: React.FC<StarterOnboardingPanelProps> = ({
  planName = "Starter",
  propertiesCount,
  applicationsCount,
  screeningStartedCount,
  onAddProperty,
  onCreateApplication,
  onStartScreening,
  onUpgrade,
}) => {
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <div>
          <h2 style={{ margin: 0 }}>Get started</h2>
          <p style={{ marginTop: spacing.xs, marginBottom: 0, color: text.muted }}>
            Complete these steps to screen your first tenant.
          </p>
        </div>

        <div style={{ display: "grid", gap: spacing.sm }}>
          <ChecklistItem
            title="Add a property"
            description="Set up your first unit to begin."
            isComplete={propertiesCount > 0}
            actionLabel="Add property"
            onAction={onAddProperty}
          />
          <ChecklistItem
            title="Create an application"
            description="Invite a tenant or start an application."
            isComplete={applicationsCount > 0}
            actionLabel="Go to applications"
            onAction={onCreateApplication}
          />
          <ChecklistItem
            title="Order screening"
            description="Run screening to verify your applicant."
            isComplete={screeningStartedCount > 0}
            actionLabel="Start screening"
            onAction={onStartScreening}
            isPrimary
          />
        </div>

        <div style={{ color: text.muted, fontSize: "0.9rem" }}>
          Screening and records are handled securely. No hidden scoring.
        </div>

        {onUpgrade ? (
          <div style={{ color: text.subtle, fontSize: "0.85rem" }}>
            Upgrade to unlock advanced property management, automation, and portfolio tools.
            <Button
              variant="ghost"
              onClick={onUpgrade}
              style={{ marginLeft: spacing.sm, padding: "6px 10px" }}
              aria-label="See upgrades"
            >
              See upgrades
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
};

export default StarterOnboardingPanel;
