import React from "react";
import { Pill } from "../ui/Ui";
import type { TransUnionIntegrationStatus } from "@/api/integrationsApi";

const LABELS: Record<TransUnionIntegrationStatus, string> = {
  not_connected: "Not connected",
  pending_credentialing: "Pending credentialing",
  connected: "Connected",
  connection_error: "Connection error",
  disconnected: "Disconnected",
};

export function TransUnionStatusBadge({
  status,
}: {
  status: TransUnionIntegrationStatus;
}) {
  const tone = status === "connected" ? "accent" : "muted";
  return <Pill tone={tone}>{LABELS[status]}</Pill>;
}
