import React, { useEffect, useState } from "react";
import { Button, Input } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";
import type { ProposedViewingSlotPayload, ViewingSlot } from "@/api/viewingsApi";

type SlotDraft = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
};

type Props = {
  initialSlots?: ViewingSlot[];
  submitting?: boolean;
  onSubmit: (payload: ProposedViewingSlotPayload[]) => Promise<void> | void;
};

function toDraft(slot: ViewingSlot, index: number): SlotDraft {
  const start = new Date(slot.startAt);
  const end = new Date(slot.endAt);
  const startIso = !Number.isNaN(start.getTime()) ? start.toISOString() : "";
  const endIso = !Number.isNaN(end.getTime()) ? end.toISOString() : "";
  return {
    id: slot.id || `slot-${index + 1}`,
    date: startIso.slice(0, 10),
    startTime: startIso.slice(11, 16),
    endTime: endIso.slice(11, 16),
    note: slot.note || "",
  };
}

function createEmptyDraft(index: number): SlotDraft {
  return {
    id: `slot-${index + 1}`,
    date: "",
    startTime: "",
    endTime: "",
    note: "",
  };
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function ViewingSlotsEditor({ initialSlots, submitting = false, onSubmit }: Props) {
  const [slots, setSlots] = useState<SlotDraft[]>(
    initialSlots?.length ? initialSlots.map((slot, index) => toDraft(slot, index)) : [createEmptyDraft(0)]
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSlots(
      initialSlots?.length ? initialSlots.map((slot, index) => toDraft(slot, index)) : [createEmptyDraft(0)]
    );
  }, [initialSlots]);

  const updateSlot = (index: number, patch: Partial<SlotDraft>) => {
    setSlots((prev) => prev.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)));
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, createEmptyDraft(prev.length)]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => (prev.length === 1 ? prev : prev.filter((_, slotIndex) => slotIndex !== index)));
  };

  const handleSubmit = async () => {
    try {
      const payload = slots.map((slot, index) => {
        if (!slot.date || !slot.startTime || !slot.endTime) {
          throw new Error(`Slot ${index + 1} needs a date, start time, and end time.`);
        }
        const startAt = toIso(slot.date, slot.startTime);
        const endAt = toIso(slot.date, slot.endTime);
        if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
          throw new Error(`Slot ${index + 1} must end after it starts.`);
        }
        return {
          id: slot.id.trim() || `slot-${index + 1}`,
          startAt,
          endAt,
          note: slot.note.trim() || null,
        };
      });
      setError(null);
      await onSubmit(payload);
    } catch (err: any) {
      setError(err?.message || "Unable to prepare proposed slots.");
    }
  };

  return (
    <div data-testid="viewing-slots-editor" style={{ display: "grid", gap: spacing.sm }}>
      {slots.map((slot, index) => (
        <div
          key={`${slot.id}-${index}`}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            display: "grid",
            gap: spacing.sm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>Slot {index + 1}</div>
            <Button type="button" variant="ghost" onClick={() => removeSlot(index)} disabled={slots.length === 1}>
              Remove
            </Button>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Date</span>
            <Input type="date" value={slot.date} onChange={(e) => updateSlot(index, { date: e.target.value })} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: spacing.sm }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Start time</span>
              <Input type="time" value={slot.startTime} onChange={(e) => updateSlot(index, { startTime: e.target.value })} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>End time</span>
              <Input type="time" value={slot.endTime} onChange={(e) => updateSlot(index, { endTime: e.target.value })} />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Note</span>
            <Input value={slot.note} onChange={(e) => updateSlot(index, { note: e.target.value })} />
          </label>
        </div>
      ))}

      {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}

      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        <Button type="button" variant="secondary" onClick={addSlot} disabled={slots.length >= 10}>
          Add Slot
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? "Saving..." : "Save Proposed Times"}
        </Button>
      </div>
      <div style={{ color: text.muted, fontSize: 12 }}>Add up to 10 proposed viewing windows.</div>
    </div>
  );
}
