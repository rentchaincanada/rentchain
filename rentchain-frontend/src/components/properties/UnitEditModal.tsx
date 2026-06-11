import React, { useEffect, useState } from "react";
import { updateUnit, uploadUnitLeaseDocument } from "../../api/unitsApi";
import { Button } from "../ui/Ui";

type Props = {
  open: boolean;
  unit: any | null;
  onClose: () => void;
  onSaved: (unit: any) => void;
};

function isPersistedUnitId(unit: any) {
  const id = String(unit?.id || unit?.unitId || unit?.uid || "").trim();
  return Boolean(id) && !/^placeholder-/i.test(id);
}

export function UnitEditModal({ open, unit, onClose, onSaved }: Props) {
  const [unitNumber, setUnitNumber] = useState("");
  const [rent, setRent] = useState<string>("");
  const [beds, setBeds] = useState<string>("");
  const [baths, setBaths] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("vacant");
  const [occupantName, setOccupantName] = useState("");
  const [leaseEndDate, setLeaseEndDate] = useState("");
  const [leaseDocumentFile, setLeaseDocumentFile] = useState<File | null>(null);
  const [existingLeaseDocument, setExistingLeaseDocument] = useState<any | null>(null);
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
    setOccupantName(String(unit.occupantName || ""));
    setLeaseEndDate(String(unit.leaseEndDate || ""));
    setLeaseDocumentFile(null);
    setExistingLeaseDocument(unit.leaseDocument || null);
    setError(null);
  }, [unit]);

  if (!open || !unit) return null;

  async function save() {
    if (!isPersistedUnitId(unit)) {
      setError("This unit is not ready for occupancy updates yet. Refresh the property after saving units, then try again.");
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
      payload.occupantName = payload.status === "occupied" ? occupantName.trim() || null : null;
      payload.leaseEndDate = payload.status === "occupied" ? leaseEndDate || null : null;
      const unitId = String(unit.id || unit.unitId || unit.uid);
      const resp: any = await updateUnit(unitId, payload);
      let updated = resp?.unit || { ...unit, ...payload };
      if (payload.status === "occupied" && leaseDocumentFile) {
        const uploadedResp: any = await uploadUnitLeaseDocument(unitId, leaseDocumentFile);
        updated = uploadedResp?.unit || { ...updated, leaseDocument: uploadedResp?.leaseDocument || null };
      }
      onSaved(updated);
      onClose();
    } catch (e: any) {
      const message = String(e?.message || "");
      setError(
        message === "UNIT_NOT_FOUND"
          ? "This unit could not be found. Refresh the property after saving units, then try again."
          : message || "Failed to save unit"
      );
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
          Monthly rent
          <input
            value={rent}
            onChange={(e) => setRent(e.target.value)}
            onFocus={() => {
              if (
                typeof window !== "undefined" &&
                window.matchMedia("(max-width: 768px)").matches &&
                String(rent ?? "") === "0"
              ) {
                setRent("");
              }
            }}
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

        {status === "occupied" ? (
          <>
            <div
              style={{
                display: "grid",
                gap: 6,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(37,99,235,0.18)",
                background: "rgba(37,99,235,0.06)",
                fontSize: 13,
                color: "#334155",
              }}
            >
              <div style={{ fontWeight: 700, color: "#0f172a" }}>Current occupancy setup</div>
              <div>
                Add the current occupant details so occupancy and rent roll views reflect reality now.
              </div>
              <div>
                Upgrade to create full lease records, tenant history, and verified reporting when you&apos;re ready.
              </div>
            </div>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Current tenant name
              <input
                value={occupantName}
                onChange={(e) => setOccupantName(e.target.value)}
                placeholder="Jane Doe"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Lease end date (optional)
              <input
                value={leaseEndDate}
                onChange={(e) => setLeaseEndDate(e.target.value)}
                type="date"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Lease document (optional)
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                onChange={(e) => setLeaseDocumentFile(e.target.files?.[0] || null)}
                style={{ padding: "8px 0", fontSize: 13 }}
              />
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Attach the current lease file for reference while you finish full lease setup later.
              </div>
              {leaseDocumentFile ? (
                <div style={{ color: "#0f172a", fontSize: 12, fontWeight: 600 }}>
                  Selected: {leaseDocumentFile.name}
                </div>
              ) : existingLeaseDocument?.fileName ? (
                <div style={{ color: "#0f172a", fontSize: 12 }}>
                  Attached:{" "}
                  {existingLeaseDocument?.url ? (
                    <a href={existingLeaseDocument.url} target="_blank" rel="noreferrer">
                      {existingLeaseDocument.fileName}
                    </a>
                  ) : (
                    existingLeaseDocument.fileName
                  )}
                </div>
              ) : null}
            </label>
          </>
        ) : null}

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
