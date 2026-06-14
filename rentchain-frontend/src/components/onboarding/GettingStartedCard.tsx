import React from "react";
import { Card, Button } from "../ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";

type GettingStartedCardProps = {
  propertiesCount: number;
  unitsCount: number;
  applicationsCount?: number;
  screeningsCount?: number;
  onAddProperty: () => void;
  onAddApplicant?: () => void;
  applicantActionLabel?: string;
};

type StepRowProps = {
  done: boolean;
  title: string;
  description: string;
  action?: React.ReactNode;
};

function StepRow({ done, title, description, action }: StepRowProps) {
  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: spacing.sm,
        background: colors.panel,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: done ? "#22c55e" : "#94a3b8",
            display: "inline-block",
          }}
        />
        <strong style={{ fontSize: 14 }}>{title}</strong>
      </div>
      <div style={{ color: text.muted, fontSize: 13 }}>{description}</div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export const GettingStartedCard: React.FC<GettingStartedCardProps> = ({
  propertiesCount,
  unitsCount,
  applicationsCount = 0,
  screeningsCount = 0,
  onAddProperty,
  onAddApplicant,
  applicantActionLabel = "Add first applicant",
}) => {
  const propertyDone = propertiesCount > 0;
  const unitDone = unitsCount > 0;
  const applicantDone = applicationsCount > 0;
  const screeningDone = screeningsCount > 0;

  return (
    <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
      <div style={{ fontWeight: 700, marginBottom: spacing.xs }}>Getting started</div>
      <div style={{ color: text.muted, marginBottom: spacing.md }}>
        Start your portfolio setup in the order landlords validated during onboarding.
      </div>

      <div style={{ display: "grid", gap: spacing.sm }}>
        <StepRow
          done={propertyDone}
          title="1. Add first property"
          description="Create your first property to unlock unit setup, tenant records, and applications."
          action={
            <Button onClick={onAddProperty} aria-label="Add first property">
              Add first property
            </Button>
          }
        />

        <StepRow
          done={unitDone}
          title="2. Add first unit"
          description={
            propertyDone
              ? "Open your property and add the first unit so applications can be attached correctly."
              : "Add a property first, then add your first unit from the property details view."
          }
        />

        <StepRow
          done={applicantDone}
          title="3. Add first applicant"
          description={
            !propertyDone
              ? "Add a property first so applicant records have a home."
              : !unitDone
              ? "Add at least one unit before starting applicant intake."
              : "Send an application link or start the applicant record for the unit."
          }
          action={
            propertyDone && unitDone && onAddApplicant ? (
              <Button onClick={onAddApplicant} aria-label={applicantActionLabel}>
                {applicantActionLabel}
              </Button>
            ) : (
              <span style={{ color: text.muted, fontSize: 13 }}>Complete the prior step to continue.</span>
            )
          }
        />

        <StepRow
          done={screeningDone}
          title="4. Run screening"
          description={
            applicantDone
              ? "Open the screening workflow once applicant context exists."
              : "Add an applicant before screening becomes the next step."
          }
        />

        <StepRow
          done={false}
          title="5. Create lease"
          description={
            applicantDone
              ? "Prepare lease documents after applicant and screening context exists."
              : "Applicant context comes before lease preparation."
          }
        />
      </div>
    </Card>
  );
};
