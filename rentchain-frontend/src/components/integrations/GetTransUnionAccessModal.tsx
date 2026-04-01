import React from "react";
import { Button, Card } from "../ui/Ui";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onMarkInProgress: () => Promise<void> | void;
  onEnterCredentials?: () => void;
};

export function GetTransUnionAccessModal({
  open,
  submitting = false,
  onClose,
  onMarkInProgress,
  onEnterCredentials,
}: Props) {
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
            by TransUnion. Once approved, you’ll receive a member code and passcode to enter in
            RentChain.
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
          <div style={{ fontWeight: 700, color: text.primary, marginBottom: 8 }}>How credentialing works</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Request TransUnion credentialing for your business.</li>
            <li>Wait for your member code and passcode to be issued.</li>
            <li>Return to RentChain and connect your account.</li>
          </ol>
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: "rgba(15,118,110,0.06)",
            color: text.muted,
            fontSize: "0.92rem",
            lineHeight: 1.6,
          }}
        >
          RentChain remains your screening workflow home. Once you receive your credentials, come
          back here to connect and continue screening applicants.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, flexWrap: "wrap" }}>
          {onEnterCredentials ? (
            <Button type="button" variant="secondary" onClick={onEnterCredentials} disabled={submitting}>
              Already Credentialed?
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          <Button type="button" onClick={() => void onMarkInProgress()} disabled={submitting}>
            {submitting ? "Saving..." : "Get TransUnion Access"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
