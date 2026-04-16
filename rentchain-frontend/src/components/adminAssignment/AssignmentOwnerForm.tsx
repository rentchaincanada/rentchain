import React from "react";

export default function AssignmentOwnerForm(props: {
  ownerId: string;
  ownerLabel: string;
  note: string;
  saving: boolean;
  submitLabel: string;
  onOwnerIdChange: (value: string) => void;
  onOwnerLabelChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ color: "#64748b", fontSize: 12 }}>Owner ID</span>
        <input
          aria-label="Assignment owner ID"
          value={props.ownerId}
          onChange={(event) => props.onOwnerIdChange(event.target.value)}
          placeholder="admin-1"
        />
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ color: "#64748b", fontSize: 12 }}>Owner label</span>
        <input
          aria-label="Assignment owner label"
          value={props.ownerLabel}
          onChange={(event) => props.onOwnerLabelChange(event.target.value)}
          placeholder="Operations lead"
        />
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ color: "#64748b", fontSize: 12 }}>Assignment note</span>
        <textarea
          aria-label="Assignment note"
          value={props.note}
          onChange={(event) => props.onNoteChange(event.target.value)}
          rows={3}
          placeholder="Add context for this ownership change"
        />
      </label>
      <div>
        <button type="button" onClick={props.onSubmit} disabled={props.saving || !props.ownerId.trim()}>
          {props.saving ? "Saving..." : props.submitLabel}
        </button>
      </div>
    </div>
  );
}
