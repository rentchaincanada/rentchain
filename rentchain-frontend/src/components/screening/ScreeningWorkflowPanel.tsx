import React from "react";
import { Button } from "@/components/ui/Ui";
import {
  getScreeningProviderOptions,
  normalizeScreeningWorkflowState,
  screeningProviderAvailabilityLabel,
  screeningWorkflowStateLabel,
  type ScreeningProviderAvailability,
  type ScreeningProviderKey,
} from "@/lib/screeningWorkflowProviders";
import { colors, radius, spacing, text } from "@/styles/tokens";

type ScreeningWorkflowPanelProps = {
  screeningEnabled?: boolean;
  transUnionConnected?: boolean;
  workflowStatus?: string | null;
  compact?: boolean;
  onTransUnionSetup?: () => void;
  onTransUnionStart?: () => void;
  onManualReview?: () => void;
};

function availabilityTone(value: ScreeningProviderAvailability): React.CSSProperties {
  switch (value) {
    case "available":
      return { background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.35)", color: "#047857" };
    case "manual":
      return { background: "rgba(37,99,235,0.12)", borderColor: "rgba(37,99,235,0.35)", color: colors.accent };
    case "requires_setup":
      return { background: "rgba(234,179,8,0.14)", borderColor: "rgba(234,179,8,0.38)", color: "#92400e" };
    default:
      return { background: "rgba(148,163,184,0.14)", borderColor: "rgba(148,163,184,0.32)", color: text.muted };
  }
}

function actionForProvider(
  key: ScreeningProviderKey,
  availability: ScreeningProviderAvailability,
  props: ScreeningWorkflowPanelProps,
) {
  if (key === "transunion" && availability === "available" && props.onTransUnionStart) {
    return { label: "Use TransUnion", onClick: props.onTransUnionStart, disabled: false };
  }
  if (key === "transunion" && availability === "requires_setup" && props.onTransUnionSetup) {
    return { label: "Set up provider", onClick: props.onTransUnionSetup, disabled: false };
  }
  if (key === "manual_offline" && availability === "manual" && props.onManualReview) {
    return { label: "Use manual review", onClick: props.onManualReview, disabled: false };
  }
  return {
    label: availability === "coming_soon" ? "Not live yet" : screeningProviderAvailabilityLabel(availability),
    onClick: undefined,
    disabled: true,
  };
}

export function ScreeningWorkflowPanel(props: ScreeningWorkflowPanelProps) {
  const options = getScreeningProviderOptions({
    screeningEnabled: props.screeningEnabled,
    transUnionConnected: props.transUnionConnected,
  });
  const workflowState = normalizeScreeningWorkflowState(props.workflowStatus);
  const cardPadding = props.compact ? spacing.md : spacing.lg;

  return (
    <section
      data-testid="screening-workflow-panel"
      style={{
        display: "grid",
        gap: spacing.md,
        padding: cardPadding,
        border: `1px solid ${colors.border}`,
        background: props.compact ? colors.panel : colors.card,
        borderRadius: radius.lg,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800, fontSize: props.compact ? 14 : 16 }}>Screening workflow</div>
          <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.55 }}>
            Choose a provider path, confirm consent, then review results or manual evidence inside the applicant workflow.
          </div>
        </div>
        <span
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            padding: "5px 10px",
            borderRadius: radius.pill,
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            color: text.secondary,
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Workflow state: {screeningWorkflowStateLabel(workflowState)}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: spacing.sm,
          gridTemplateColumns: props.compact ? "1fr" : "repeat(auto-fit, minmax(210px, 1fr))",
        }}
      >
        {options.map((option) => {
          const tone = availabilityTone(option.availability);
          const action = actionForProvider(option.key, option.availability, props);
          return (
            <div
              key={option.key}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                background: colors.card,
                padding: spacing.sm,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: text.primary, fontWeight: 800, fontSize: 14 }}>{option.label}</div>
                  <div style={{ color: text.subtle, fontSize: 12, marginTop: 2 }}>{option.capability}</div>
                </div>
                <span
                  style={{
                    border: `1px solid ${tone.borderColor}`,
                    borderRadius: radius.pill,
                    background: tone.background,
                    color: tone.color,
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {screeningProviderAvailabilityLabel(option.availability)}
                </span>
              </div>
              <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.5 }}>{option.description}</div>
              <div>
                <Button
                  type="button"
                  variant={action.disabled ? "ghost" : option.availability === "manual" ? "secondary" : "primary"}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  aria-disabled={action.disabled}
                  style={{ padding: "7px 10px", fontSize: 12 }}
                >
                  {action.label}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          background: colors.bg,
          padding: spacing.sm,
          color: text.muted,
          fontSize: 12,
          lineHeight: 1.55,
          display: "grid",
          gap: 4,
        }}
      >
        <div>
          Consent required: confirm applicant authorization and provider requirements before ordering or recording screening.
        </div>
        <div>Screening provider availability may vary. Verify consent and provider requirements before ordering reports.</div>
        <div>RentChain stores workflow metadata and review summaries only; do not upload or store raw bureau reports here.</div>
      </div>
    </section>
  );
}
