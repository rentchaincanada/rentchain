import React, { useState } from "react";
import { createTenantEvent } from "@/api/tenantEvents";

type Props = {
  tenantId: string;
  onSuccess?: () => void;
  onClose?: () => void;
};

export function RecordTenantEventModal({ tenantId, onSuccess, onClose }: Props) {
  const [type, setType] = useState("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultTitleFromType = (t: string): string => {
    switch (t) {
      case "rent_payment":
        return "Rent payment";
      case "late_payment":
        return "Late payment";
      case "maintenance":
        return "Maintenance";
      case "notice":
        return "Notice sent";
      case "lease_update":
        return "Lease update";
      case "breach":
        return "Breach";
      default:
        return t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  async function submit() {
    if (!tenantId) {
      setError("Select a tenant first.");
      return;
    }
    const finalTitle = title.trim() || defaultTitleFromType(type);
    setLoading(true);
    setError(null);
    try {
      await createTenantEvent({
        tenantId,
        type,
        title: finalTitle,
        description: description.trim() || undefined,
        occurredAt: Date.now(),
      });
      onSuccess?.();
      onClose?.();
      setTitle("");
      setDescription("");
    } catch (e: any) {
      setError(e?.message || "Failed to record event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        <span>Type</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        >
          <option value="rent_payment">Rent Payment</option>
          <option value="late_payment">Late Payment</option>
          <option value="maintenance">Maintenance</option>
          <option value="notice">Notice</option>
          <option value="lease_update">Lease Update</option>
          <option value="breach">Breach</option>
          <option value="note">Note</option>
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        <span>Event title</span>
        <input
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        <span>Details (optional)</span>
        <textarea
          placeholder="Details"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        />
      </label>

      {error ? (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
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
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={loading || !title.trim()}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#111827",
            color: "#fff",
            fontWeight: 700,
            opacity: loading || !title.trim() ? 0.6 : 1,
          }}
        >
          {loading ? "Recording..." : "Record Event"}
        </button>
      </div>
    </div>
  );
}
