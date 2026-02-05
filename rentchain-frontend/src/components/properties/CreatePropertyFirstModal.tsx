import React from "react";
import { Button } from "../ui/Ui";
import { spacing, text } from "../../styles/tokens";

export function CreatePropertyFirstModal({
  open,
  onCreate,
  onClose,
}: {
  open: boolean;
  onCreate: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,6,23,0.45)",
          zIndex: 150,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create a property first"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 92vw)",
          background: "#ffffff",
          borderRadius: 18,
          zIndex: 151,
          boxShadow: "0 24px 80px rgba(2,6,23,0.45)",
        }}
      >
        <div style={{ padding: spacing.lg, display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Create a property first</div>
          <div style={{ color: text.muted }}>
            You’ll need at least one property before sending applications. Takes ~30 seconds.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm }}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onCreate}>Create property</Button>
          </div>
        </div>
      </div>
    </>
  );
}
