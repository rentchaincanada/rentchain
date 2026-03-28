import React from "react";
import type { ViewingRequestStatus } from "@/api/viewingsApi";
import { Pill } from "../ui/Ui";

const LABELS: Record<ViewingRequestStatus, string> = {
  requested: "Viewing requested",
  slots_proposed: "Times proposed",
  scheduled: "Viewing scheduled",
  completed: "Viewing completed",
  cancelled: "Viewing cancelled",
};

export function ViewingStatusBadge({ status }: { status: ViewingRequestStatus }) {
  return <Pill tone={status === "scheduled" || status === "completed" ? "accent" : "muted"}>{LABELS[status]}</Pill>;
}
