import React from "react";
import { Link } from "react-router-dom";
import { Card, Button } from "../ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";

type GettingStartedCardProps = {
  propertiesCount: number;
  unitsCount: number;
  tenantsCount: number;
  inviteTenantHref?: string;
  onAddProperty: () => void;
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
  tenantsCount,
  inviteTenantHref,
  onAddProperty,
}) => {
  const propertyDone = propertiesCount > 0;
  const unitDone = unitsCount > 0;
  const tenantDone = tenantsCount > 0;

  return (
    <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
      <div style={{ fontWeight: 700, marginBottom: spacing.xs }}>Getting started</div>
      <div style={{ color: text.muted, marginBottom: spacing.md }}>
        Start your portfolio setup with these three steps.
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
          done={tenantDone}
          title="3. Invite first tenant"
          description="Invite a tenant to start collecting applications and screening consent."
          action={
            inviteTenantHref ? (
              <Link
                to={inviteTenantHref}
                style={{
                  display: "inline-block",
                  color: colors.accent,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Invite first tenant
              </Link>
            ) : (
              <span style={{ color: text.muted, fontSize: 13 }}>Invite route not available.</span>
            )
          }
        />
      </div>
    </Card>
  );
};

