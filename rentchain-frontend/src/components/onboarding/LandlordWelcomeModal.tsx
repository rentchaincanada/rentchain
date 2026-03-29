import React from "react";
import { Button, Card } from "../ui/Ui";
import { colors, spacing, text } from "@/styles/tokens";

type Props = {
  open: boolean;
  onStartSetup: () => void;
  onExploreDashboard: () => void;
};

export function LandlordWelcomeModal({ open, onStartSetup, onExploreDashboard }: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 5000,
      }}
    >
      <Card
        elevated
        style={{
          width: "min(560px, 96vw)",
          display: "grid",
          gap: spacing.md,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ display: "grid", gap: spacing.xs }}>
          <div style={{ fontWeight: 800, fontSize: "1.3rem" }}>Welcome to RentChain</div>
          <div style={{ color: text.muted, lineHeight: 1.6 }}>
            Start by adding your first property and unit, then follow the activation flow to reach your first applicant review and screening decision.
          </div>
          <div style={{ color: text.subtle, fontSize: 13, lineHeight: 1.6 }}>
            Already have occupied units? You can set current occupancy first so your dashboard reflects reality before you invite or screen anyone new.
          </div>
        </div>

        <div style={{ display: "grid", gap: 6, color: text.muted, fontSize: 14 }}>
          <div>1. Add your property and unit details</div>
          <div>2. Set up any current occupancy if tenants are already in place</div>
          <div>3. Continue to applicants, viewings, and screening</div>
        </div>

        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Button type="button" variant="secondary" onClick={onExploreDashboard}>
            Explore dashboard
          </Button>
          <Button type="button" onClick={onStartSetup}>
            Start setup
          </Button>
        </div>
      </Card>
    </div>
  );
}
