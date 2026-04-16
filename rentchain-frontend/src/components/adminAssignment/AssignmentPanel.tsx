import React from "react";
import { createAssignment, updateAssignment } from "../../api/adminAssignmentApi";
import type { AssignmentRecordV1 } from "../../api/supportConsoleApi";
import AssignmentBadge from "./AssignmentBadge";
import AssignmentHistoryList from "./AssignmentHistoryList";
import AssignmentOwnerForm from "./AssignmentOwnerForm";

export default function AssignmentPanel(props: {
  resourceType: string;
  resourceId: string;
  assignment: AssignmentRecordV1 | null;
  onChange: (assignment: AssignmentRecordV1) => void;
}) {
  const [ownerId, setOwnerId] = React.useState("");
  const [ownerLabel, setOwnerLabel] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setOwnerId(props.assignment?.currentOwner.ownerId || "");
    setOwnerLabel(props.assignment?.currentOwner.ownerLabel || "");
  }, [props.assignment]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await createAssignment({
        resourceType: props.resourceType,
        resourceId: props.resourceId,
        ownerId: ownerId || null,
        ownerLabel: ownerLabel || null,
        note: note || null,
      });
      props.onChange(response.assignment);
      setNote("");
    } catch (err: any) {
      setError(err?.message || "Failed to create assignment");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (nextOwnerId?: string | null, nextOwnerLabel?: string | null) => {
    if (!props.assignment) return;
    try {
      setSaving(true);
      setError(null);
      const response = await updateAssignment(props.assignment.id, {
        ownerId: nextOwnerId ?? null,
        ownerLabel: nextOwnerLabel ?? null,
        note: note || null,
      });
      props.onChange(response.assignment);
      setOwnerId(response.assignment.currentOwner.ownerId || "");
      setOwnerLabel(response.assignment.currentOwner.ownerLabel || "");
      setNote("");
    } catch (err: any) {
      setError(err?.message || "Failed to update assignment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {props.assignment ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <AssignmentBadge
              ownerId={props.assignment.currentOwner.ownerId}
              ownerLabel={props.assignment.currentOwner.ownerLabel}
            />
            <span style={{ color: "#64748b", fontSize: 13 }}>
              Updated {new Date(props.assignment.updatedAt).toLocaleString()}
            </span>
          </div>
          <AssignmentOwnerForm
            ownerId={ownerId}
            ownerLabel={ownerLabel}
            note={note}
            saving={saving}
            submitLabel="Change owner"
            onOwnerIdChange={setOwnerId}
            onOwnerLabelChange={setOwnerLabel}
            onNoteChange={setNote}
            onSubmit={() => void handleUpdate(ownerId || null, ownerLabel || null)}
          />
          <div>
            <button type="button" onClick={() => void handleUpdate(null, null)} disabled={saving}>
              Clear owner
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "#64748b" }}>No assignment exists yet for this resource.</div>
          <AssignmentOwnerForm
            ownerId={ownerId}
            ownerLabel={ownerLabel}
            note={note}
            saving={saving}
            submitLabel="Assign owner"
            onOwnerIdChange={setOwnerId}
            onOwnerLabelChange={setOwnerLabel}
            onNoteChange={setNote}
            onSubmit={() => void handleCreate()}
          />
        </div>
      )}

      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Assignment history</strong>
        <AssignmentHistoryList history={props.assignment?.history || []} />
      </div>
    </div>
  );
}
