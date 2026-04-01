import React from "react";
import { Pill } from "../ui/Ui";

export const IntegrityBadge: React.FC<{
  integrity: { hasIssues: boolean; orphaned: boolean; missingOwner: boolean };
}> = ({ integrity }) => {
  if (integrity.orphaned) {
    return <Pill style={{ background: "rgba(239,68,68,0.12)", color: "#b91c1c" }}>Orphaned</Pill>;
  }
  if (integrity.missingOwner) {
    return <Pill style={{ background: "rgba(245,158,11,0.14)", color: "#b45309" }}>Missing owner</Pill>;
  }
  return <Pill style={{ background: "rgba(34,197,94,0.12)", color: "#166534" }}>Healthy</Pill>;
};
