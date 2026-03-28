import React from "react";
import { Button, Card } from "../ui/Ui";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onMarkInProgress: () => Promise<void> | void;
};

export function GetTransUnionAccessModal({ open, submitting = false, onClose, onMarkInProgress }: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Get TransUnion Access"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.md,
        zIndex: 1000,
      }}
    >
      <Card
        elevated
        style={{
          width: "min(560px, 100%)",
          borderRadius: radius.lg,
          boxShadow: shadows.pop,
          display: "grid",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "grid", gap: spacing.sm }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Get TransUnion Access</h2>
          <p style={{ margin: 0, color: text.muted, lineHeight: 1.6 }}>
            To use TransUnion screening through RentChain, your business must first be credentialed
            by TransUnion. Contact the TransUnion representative you were provided. Once approved,
            you’ll receive a member code and passcode to enter in RentChain.
          </p>
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: colors.bg,
            color: text.subtle,
            fontSize: "0.92rem",
          }}
        >
          Return here once your TransUnion membership details are issued.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, flexWrap: "wrap" }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          <Button type="button" onClick={() => void onMarkInProgress()} disabled={submitting}>
            {submitting ? "Saving..." : "Mark In Progress"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
