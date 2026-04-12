import React from "react";
import { Link } from "react-router-dom";
import { TenantInfoCard } from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";
import type { TenantWorkspaceModeView } from "./tenantWorkspaceMode";

const accentByMode: Record<TenantWorkspaceModeView["mode"], string> = {
  invite_mode: "#0f766e",
  applicant_mode: "#1d4ed8",
  active_tenant_mode: "#7c3aed",
};

export default function TenantWorkspaceModeBanner({
  view,
}: {
  view: TenantWorkspaceModeView;
}) {
  return (
    <TenantInfoCard
      heading="Workspace guidance"
      accent={accentByMode[view.mode]}
    >
      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              fontSize: "0.78rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: textTokens.muted,
            }}
          >
            {view.eyebrow}
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 800, color: textTokens.primary }}>
            {view.title}
          </div>
          <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
            {view.description}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700, color: textTokens.primary }}>What to do next</div>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {view.nextSteps.map((step) => (
              <Link key={`${view.mode}-${step.to}-${step.label}`} to={step.to} style={{ fontWeight: 700 }}>
                {step.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </TenantInfoCard>
  );
}
