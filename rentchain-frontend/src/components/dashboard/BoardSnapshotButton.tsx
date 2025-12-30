import React from "react";
import { Button } from "../ui/Ui";

export function BoardSnapshotButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        fontSize: 13,
      }}
      onClick={onClick}
    >
      📄 Monthly Ops Snapshot
    </Button>
  );
}
