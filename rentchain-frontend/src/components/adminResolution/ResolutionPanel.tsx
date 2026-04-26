import React from "react";
import { addResolutionNote, createResolution, updateResolutionStatus } from "../../api/adminResolutionApi";
import type { ResolutionRecordV1, ResolutionStatus } from "../../api/supportConsoleApi";
import ResolutionHistoryList from "./ResolutionHistoryList";
import ResolutionNotesList from "./ResolutionNotesList";
import ResolutionStatusBadge from "./ResolutionStatusBadge";

type Props = {
  resourceType: string;
  resourceId: string;
  triageCategory?: string | null;
  triageSeverity?: string | null;
  reasonCode?: string | null;
  resolution: ResolutionRecordV1 | null;
  onChange: (resolution: ResolutionRecordV1) => void;
};

const TRANSITIONS: Record<ResolutionStatus, Array<{ status: Exclude<ResolutionStatus, "open">; label: string }>> = {
  open: [
    { status: "acknowledged", label: "Acknowledge" },
    { status: "dismissed", label: "Dismiss" },
  ],
  acknowledged: [
    { status: "in_progress", label: "Mark in progress" },
    { status: "resolved", label: "Resolve" },
    { status: "dismissed", label: "Dismiss" },
  ],
  in_progress: [
    { status: "resolved", label: "Resolve" },
    { status: "dismissed", label: "Dismiss" },
  ],
  resolved: [],
  dismissed: [],
};

export default function ResolutionPanel({
  resourceType,
  resourceId,
  triageCategory,
  triageSeverity,
  reasonCode,
  resolution,
  onChange,
}: Props) {
  const [note, setNote] = React.useState("");
  const [statusReason, setStatusReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await createResolution({
        resourceType,
        resourceId,
        triageCategory: triageCategory || null,
        triageSeverity: triageSeverity || null,
        reasonCode: reasonCode || null,
        note: note || null,
      });
      onChange(response.resolution);
      setNote("");
    } catch (err: any) {
      setError(err?.message || "Failed to create resolution");
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (status: Exclude<ResolutionStatus, "open">) => {
    if (!resolution) return;
    try {
      setSaving(true);
      setError(null);
      const response = await updateResolutionStatus(resolution.id, {
        status,
        reason: statusReason || null,
      });
      onChange(response.resolution);
      setStatusReason("");
    } catch (err: any) {
      setError(err?.message || "Failed to update resolution");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!resolution || !note.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const response = await addResolutionNote(resolution.id, {
        message: note,
      });
      onChange(response.resolution);
      setNote("");
    } catch (err: any) {
      setError(err?.message || "Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {resolution ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <ResolutionStatusBadge status={resolution.status} />
            <span style={{ color: "#64748b", fontSize: 13 }}>
              Updated {new Date(resolution.updatedAt).toLocaleString()}
            </span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>Status reason</span>
              <input
                aria-label="Resolution status reason"
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
                placeholder="Add a short operational reason"
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TRANSITIONS[resolution.status].map((action) => (
                <button key={action.status} type="button" onClick={() => void handleStatus(action.status)} disabled={saving}>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "#64748b" }}>No resolution record exists yet for this resource.</div>
          <button type="button" onClick={() => void handleCreate()} disabled={saving}>
            {saving ? "Creating..." : "Create resolution"}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>Resolution note</span>
          <textarea
            aria-label="Resolution note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Add an operational note"
          />
        </label>
        <div>
          <button type="button" onClick={() => void (resolution ? handleAddNote() : handleCreate())} disabled={saving || !note.trim()}>
            {resolution ? "Add note" : "Create with note"}
          </button>
        </div>
      </div>

      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Notes</strong>
        <ResolutionNotesList notes={resolution?.notes || []} />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>History</strong>
        <ResolutionHistoryList history={resolution?.history || []} />
      </div>
    </div>
  );
}
