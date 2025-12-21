import React from "react";
import { Card } from "../ui/Ui";
import { spacing, text, colors, radius } from "../../styles/tokens";

type ChecklistProps = {
  hasProperty?: boolean;
  hasApplication?: boolean;
  phoneVerified?: boolean;
  referencesContacted?: boolean;
  screeningRun?: boolean;
  pdfDownloaded?: boolean;
  billingViewed?: boolean;
};

const Item: React.FC<{ label: string; done?: boolean }> = ({ label, done }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 0",
      color: done ? text.primary : text.muted,
    }}
  >
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: done ? "rgba(34,197,94,0.18)" : "rgba(148,163,184,0.25)",
        color: done ? "#15803d" : colors.border,
        fontSize: 11,
        border: done ? "1px solid rgba(34,197,94,0.5)" : `1px solid ${colors.border}`,
      }}
    >
      {done ? "✓" : "•"}
    </span>
    <span>{label}</span>
  </div>
);

export const SoftLaunchChecklist: React.FC<ChecklistProps> = ({
  hasProperty,
  hasApplication,
  phoneVerified,
  referencesContacted,
  screeningRun,
  pdfDownloaded,
  billingViewed,
}) => {
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
        <div style={{ fontWeight: 700, fontSize: "1rem" }}>Soft launch checklist</div>
        <div style={{ fontSize: 12, color: text.muted }}>
          Quick steps to invite landlords and start screening.
        </div>
        <div style={{ marginTop: spacing.xs }}>
          <Item label="Add a property with units" done={hasProperty} />
          <Item label="Add an application" done={hasApplication} />
          <Item label="Verify applicant phone" done={phoneVerified} />
          <Item label="Mark references contacted" done={referencesContacted} />
          <Item label="Run credit screening" done={screeningRun} />
          <Item label="Download screening PDF" done={pdfDownloaded} />
          <Item label="View billing receipt" done={billingViewed} />
        </div>
        <div
          style={{
            marginTop: spacing.xs,
            padding: "6px 8px",
            borderRadius: radius.sm,
            background: "rgba(148,163,184,0.12)",
            color: text.muted,
            fontSize: 12,
          }}
        >
          Tip: use this checklist when inviting landlords during soft launch.
        </div>
      </div>
    </Card>
  );
};
