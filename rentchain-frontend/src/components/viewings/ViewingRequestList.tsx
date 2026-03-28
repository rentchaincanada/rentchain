import React from "react";
import type { ViewingRequest } from "@/api/viewingsApi";
import { Button } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";
import { ViewingStatusBadge } from "./ViewingStatusBadge";

type Props = {
  requests: ViewingRequest[];
  selectedId?: string | null;
  onSelect: (viewingRequestId: string) => void;
};

export function ViewingRequestList({ requests, selectedId, onSelect }: Props) {
  if (!requests.length) {
    return <div style={{ color: text.muted, fontSize: 14 }}>No viewing requests yet.</div>;
  }

  return (
    <div data-testid="viewing-request-list" style={{ display: "grid", gap: spacing.sm }}>
      {requests.map((request) => {
        const selected = request.id === selectedId;
        return (
          <button
            key={request.id}
            type="button"
            onClick={() => onSelect(request.id)}
            style={{
              border: `1px solid ${selected ? colors.accent : colors.border}`,
              borderRadius: radius.md,
              padding: spacing.sm,
              background: selected ? "rgba(37,99,235,0.08)" : colors.card,
              textAlign: "left",
              display: "grid",
              gap: 6,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>{request.applicantName || "Unnamed applicant"}</div>
              <ViewingStatusBadge status={request.status} />
            </div>
            <div style={{ color: text.muted, fontSize: 13 }}>{request.applicantEmail || "No email provided"}</div>
            <div style={{ color: text.subtle, fontSize: 12 }}>
              Requested {request.requestedAt ? new Date(request.requestedAt).toLocaleString() : "recently"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
