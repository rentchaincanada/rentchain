import React from "react";
import { Pill } from "../ui/Ui";

type Props = {
  status: "available" | "archived" | "not_stored" | "retrieval_required" | "pending" | "failed";
};

const LABELS: Record<Props["status"], string> = {
  available: "Report available",
  archived: "Report archived",
  not_stored: "Summary only",
  retrieval_required: "Retrieval required",
  pending: "Pending",
  failed: "Report failed",
};

export function ReportStatusBadge({ status }: Props) {
  const tone = status === "available" ? "accent" : "muted";
  return <Pill tone={tone}>{LABELS[status]}</Pill>;
}

export default ReportStatusBadge;
