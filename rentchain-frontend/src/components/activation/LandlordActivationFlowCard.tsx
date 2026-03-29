import React from "react";
import type { LandlordActivationSummary } from "@/api/activationApi";
import { Card, Button } from "../ui/Ui";
import { colors, spacing, text } from "@/styles/tokens";
import { ActivationProgressBar } from "./ActivationProgressBar";
import { ActivationStepRow } from "./ActivationStepRow";

type Props = {
  summary: LandlordActivationSummary | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export function LandlordActivationFlowCard({
  summary,
  loading = false,
  error = null,
  onRetry,
}: Props) {
  return (
    <Card elevated style={{ display: "grid", gap: spacing.md }} data-testid="landlord-activation-card">
      <div style={{ display: "grid", gap: spacing.xs }}>
        <div style={{ fontWeight: 800, fontSize: "1.08rem" }}>Get your first tenant screened</div>
        <div style={{ color: text.muted }}>
          Follow these steps to complete setup and review your first applicant.
        </div>
        <div style={{ color: text.subtle, fontSize: 13 }}>
          Core setup stays available on every plan. Paid upgrades are labeled separately when they unlock extra workflow or reporting.
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ height: 10, borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
          <div style={{ height: 76, borderRadius: 16, background: "rgba(15,23,42,0.06)" }} />
          <div style={{ height: 76, borderRadius: 16, background: "rgba(15,23,42,0.06)" }} />
        </div>
      ) : null}

      {!loading && error ? (
        <div
          style={{
            display: "grid",
            gap: spacing.sm,
            padding: spacing.md,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            background: "#fff7ed",
          }}
        >
          <div style={{ fontWeight: 700 }}>Activation flow unavailable</div>
          <div style={{ color: text.muted }}>{error}</div>
          {onRetry ? (
            <div>
              <Button type="button" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && summary ? (
        <>
          <ActivationProgressBar
            completedCount={summary.completedCount}
            totalCount={summary.totalCount}
          />
          <div style={{ display: "grid", gap: spacing.sm }}>
            {summary.steps.map((step) => (
              <ActivationStepRow
                key={step.key}
                step={step}
                isNextStep={summary.nextStepKey === step.key}
              />
            ))}
          </div>
        </>
      ) : null}
    </Card>
  );
}
