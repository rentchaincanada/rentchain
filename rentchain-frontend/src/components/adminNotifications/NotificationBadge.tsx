import React from "react";
import { Pill } from "../ui/Ui";

export default function NotificationBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "critical" | "high" | "medium" | "low" | "default";
}) {
  const style =
    tone === "critical"
      ? { background: "#fee2e2", color: "#991b1b", borderColor: "transparent" }
      : tone === "high"
      ? { background: "#ffedd5", color: "#9a3412", borderColor: "transparent" }
      : tone === "medium"
      ? { background: "#fef3c7", color: "#92400e", borderColor: "transparent" }
      : tone === "low"
      ? { background: "#e0f2fe", color: "#075985", borderColor: "transparent" }
      : undefined;

  return <Pill style={style}>{children}</Pill>;
}
