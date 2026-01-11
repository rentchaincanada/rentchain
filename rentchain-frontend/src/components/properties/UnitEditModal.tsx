import React, { useEffect, useState } from "react";
import { updateUnit } from "../../api/unitsApi";
import { Button } from "../ui/Ui";

type Props = {
  open: boolean;
  unit: any | null;
  onClose: () => void;
  onSaved: (unit: any) => void;
};

export function UnitEditModal({ open, unit, onClose, onSaved }: Props) {
  const [unitNumber, setUnitNumber] = useState("");
  const [rent, setRent] = useState<string>("");
  const [beds, setBeds] = useState<string>("");
  const [baths, setBaths] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("vacant");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unit) return;
    setUnitNumber(String(unit.unitNumber || ""));
    setRent(
      unit.rent !== undefined && unit.rent !== null
        ? String(unit.rent)
        : unit.marketRent !== undefined && unit.marketRent !== null
        ? String(unit.marketRent)
        : ""
    );
    setBeds(
      unit.beds !== undefined && unit.beds !== null
        ? String(unit.beds)
        : unit.bedrooms !== undefined && unit.bedrooms !== null
        ? String(unit.bedrooms)
        : ""
    );
    setBaths(
      unit.baths !== undefined && unit.baths !== null
        ? String(unit.baths)
        : unit.bathrooms !== undefined && unit.bathrooms !== null
        ? String(unit.bathrooms)
        : ""
    );
    setNotes(unit.notes || "");
    setStatus(unit.status || "vacant");
    setError(null);
  }, [unit]);

  if (!open || !unit) return null;

  async function save() {
    if (!unit.id) {
      setError("Missing unit id");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: any = {};
      payload.unitNumber = unitNumber;
      payload.rent = rent === "" ? null : Number(rent);
      payload.beds = beds === "" ? null : Number(beds);
      payload.baths = baths === "" ? null : Number(baths);
      payload.notes = notes;
      payload.status = (status || "vacant").toLowerCase();
      const resp: any = await updateUnit(String(unit.id), payload);
      const updated = resp?.unit || { ...unit, ...payload };
      onSaved(updated);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save unit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 4000,
        padding: 16,
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Edit unit</div>
          <Button onClick={onClose} style={{ padding: "6px 10px" }}>
            Close
          </Button>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Unit number
          <input
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Rent
          <input
            value={rent}
            onChange={(e) => setRent(e.target.value)}
            type="number"
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Beds
            <input
              value={beds}
              onChange={(e) => setBeds(e.target.value)}
              type="number"
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Baths
            <input
              value={baths}
              onChange={(e) => setBaths(e.target.value)}
              type="number"
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        {error ? (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #fecdd3",
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose} style={{ padding: "8px 12px" }}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !unitNumber} style={{ padding: "8px 12px" }}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
