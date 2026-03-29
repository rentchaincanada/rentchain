import React from "react";
import { useNavigate } from "react-router-dom";
import type { LandlordActivationStep } from "@/api/activationApi";
import { Button, Pill } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";

type Props = {
  step: LandlordActivationStep;
  isNextStep?: boolean;
};

const STATUS_COPY: Record<LandlordActivationStep["status"], string> = {
  not_started: "Not started",
  in_progress: "Let's finish setup",
  completed: "Completed",
  blocked: "Next step required",
};

function statusTone(status: LandlordActivationStep["status"]): React.CSSProperties {
  if (status === "completed") {
    return { background: "#dcfce7", color: "#166534", borderColor: "#86efac" };
  }
  if (status === "in_progress") {
    return { background: "#dbeafe", color: "#1d4ed8", borderColor: "#93c5fd" };
  }
  if (status === "blocked") {
    return { background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" };
  }
  return { background: "#f8fafc", color: text.muted, borderColor: colors.border };
}

export function ActivationStepRow({ step, isNextStep = false }: Props) {
  const navigate = useNavigate();
  const helperText =
    step.status === "blocked"
      ? "Complete this step to continue."
      : isNextStep
      ? "Let's finish setup and keep your first review moving."
      : null;

  return (
    <div
      data-testid={`activation-step-${step.key}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: spacing.md,
        alignItems: "center",
        padding: spacing.md,
        borderRadius: radius.lg,
        border: `1px solid ${isNextStep ? colors.accent : colors.border}`,
        background: isNextStep ? "rgba(59,130,246,0.06)" : colors.card,
      }}
    >
      <div style={{ display: "grid", gap: spacing.xs }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>{step.title}</div>
          <Pill style={statusTone(step.status)}>{STATUS_COPY[step.status]}</Pill>
        </div>
        <div style={{ color: text.muted, lineHeight: 1.5 }}>{step.description}</div>
        {helperText ? (
          <div
            style={{
              color: step.status === "blocked" ? "#92400e" : text.subtle,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {helperText}
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant={isNextStep ? "primary" : "secondary"}
        onClick={() => navigate(step.actionPath)}
      >
        {step.actionLabel}
      </Button>
    </div>
  );
}
