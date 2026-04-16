import React from "react";
import type { ResolutionStatus } from "../../api/supportConsoleApi";

const TONES: Record<ResolutionStatus, { background: string; color: string }> = {
  open: { background: "rgba(59,130,246,0.12)", color: "#1d4ed8" },
  acknowledged: { background: "rgba(245,158,11,0.16)", color: "#92400e" },
  in_progress: { background: "rgba(14,165,233,0.16)", color: "#0c4a6e" },
  resolved: { background: "rgba(34,197,94,0.14)", color: "#166534" },
  dismissed: { background: "rgba(100,116,139,0.14)", color: "#475569" },
};

export default function ResolutionStatusBadge({ status }: { status: ResolutionStatus }) {
  const tone = TONES[status];
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        background: tone.background,
        color: tone.color,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
