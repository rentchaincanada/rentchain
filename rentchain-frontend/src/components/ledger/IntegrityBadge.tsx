import React from "react";

type Status = "verified" | "unverified" | "broken";

export function IntegrityBadge({ status }: { status: Status }) {
  let label = "• Unverified";
  let background = "rgba(148,163,184,0.2)";
  let color = "#475569";

  if (status === "verified") {
    label = "✔ Verified";
    background = "rgba(16,185,129,0.15)";
    color = "#0f766e";
  } else if (status === "broken") {
    label = "⚠ Broken";
    background = "rgba(248,113,113,0.15)";
    color = "#b91c1c";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background,
        color,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}
