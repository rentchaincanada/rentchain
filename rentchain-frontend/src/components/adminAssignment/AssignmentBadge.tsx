import React from "react";

export default function AssignmentBadge(props: {
  ownerId?: string | null;
  ownerLabel?: string | null;
}) {
  const assigned = Boolean(props.ownerId);
  const label = props.ownerLabel || props.ownerId || "Unassigned";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: assigned ? "rgba(14, 116, 144, 0.14)" : "rgba(100, 116, 139, 0.14)",
        color: assigned ? "#155e75" : "#475569",
      }}
    >
      {assigned ? "Assigned" : "Unassigned"}: {label}
    </span>
  );
}
