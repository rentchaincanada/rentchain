import React, { useMemo, useState } from "react";
import type { ProposedViewingSlotPayload, ViewingRequest } from "@/api/viewingsApi";
import { Button, Card } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";
import { ViewingSlotsEditor } from "./ViewingSlotsEditor";
import { ViewingStatusBadge } from "./ViewingStatusBadge";

type Props = {
  request: ViewingRequest | null;
  actionLoading?: boolean;
  onProposeSlots: (proposedSlots: ProposedViewingSlotPayload[]) => Promise<void> | void;
  onSelectSlot: (slotId: string) => Promise<void> | void;
  onComplete: () => Promise<void> | void;
  onCancel: (cancelledReason: string | null) => Promise<void> | void;
};

export function ViewingRequestDetail({
  request,
  actionLoading = false,
  onProposeSlots,
  onSelectSlot,
  onComplete,
  onCancel,
}: Props) {
  const [cancelledReason, setCancelledReason] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  const selectedSlotLabel = useMemo(() => {
    if (!request?.selectedSlot) return null;
    const start = new Date(request.selectedSlot.startAt);
    const end = new Date(request.selectedSlot.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return `${start.toLocaleString()} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }, [request?.selectedSlot]);

  if (!request) {
    return <div style={{ color: text.muted, fontSize: 14 }}>Select a viewing request to review details.</div>;
  }

  return (
    <Card data-testid="viewing-request-detail" style={{ display: "grid", gap: spacing.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{request.applicantName || "Viewing request"}</div>
          <div style={{ color: text.muted }}>{request.applicantEmail || "No email provided"}</div>
          {request.applicantPhone ? <div style={{ color: text.subtle }}>{request.applicantPhone}</div> : null}
        </div>
        <ViewingStatusBadge status={request.status} />
      </div>

      {request.requestedMessage ? (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: colors.bg,
          }}
        >
          {request.requestedMessage}
        </div>
      ) : null}

      {request.selectedSlot && selectedSlotLabel ? (
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 600 }}>Scheduled time</div>
          <div>{selectedSlotLabel}</div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ fontWeight: 600 }}>Proposed slots</div>
        {request.proposedSlots.length ? (
          request.proposedSlots.map((slot) => (
            <div
              key={slot.id}
              style={{
                border: `1px solid ${slot.isSelected ? colors.accent : colors.border}`,
                borderRadius: radius.md,
                padding: spacing.sm,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {new Date(slot.startAt).toLocaleString()} -{" "}
                {new Date(slot.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              {slot.note ? <div style={{ color: text.muted }}>{slot.note}</div> : null}
              {request.status === "slots_proposed" ? (
                <div>
                  <Button type="button" variant="secondary" onClick={() => void onSelectSlot(slot.id)} disabled={actionLoading}>
                    Select This Slot
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div style={{ color: text.muted, fontSize: 14 }}>No times proposed yet.</div>
        )}
      </div>

      {(request.status === "requested" || request.status === "slots_proposed") ? (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600 }}>Propose times</div>
            <Button type="button" variant="ghost" onClick={() => setEditorOpen((value) => !value)}>
              {editorOpen ? "Hide Editor" : "Edit Proposed Times"}
            </Button>
          </div>
          {editorOpen ? (
            <ViewingSlotsEditor
              initialSlots={request.proposedSlots}
              submitting={actionLoading}
              onSubmit={async (proposedSlots) => {
                await onProposeSlots(proposedSlots);
                setEditorOpen(false);
              }}
            />
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        {request.status === "scheduled" ? (
          <Button type="button" onClick={() => void onComplete()} disabled={actionLoading}>
            Mark Complete
          </Button>
        ) : null}
      </div>

      {request.status !== "completed" && request.status !== "cancelled" ? (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Cancellation reason</span>
            <input
              value={cancelledReason}
              onChange={(e) => setCancelledReason(e.target.value)}
              style={{
                minHeight: 42,
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
              }}
            />
          </label>
          <div>
            <Button type="button" variant="ghost" onClick={() => void onCancel(cancelledReason.trim() || null)} disabled={actionLoading}>
              Cancel Viewing
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
