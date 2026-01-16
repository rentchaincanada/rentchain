import React, { useEffect, useState } from "react";
import { createTenantMaintenanceRequest } from "../../api/tenantMaintenanceApi";
import { colors, radius, spacing, text, shadows } from "../../styles/tokens";
import { useToast } from "../ui/ToastProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

const categories = [
  { value: "PLUMBING", label: "Plumbing" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "HVAC", label: "HVAC" },
  { value: "APPLIANCE", label: "Appliance" },
  { value: "PEST", label: "Pest" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "GENERAL", label: "General" },
  { value: "OTHER", label: "Other" },
];

const priorities = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export const CreateMaintenanceRequestModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { showToast } = useToast();
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("NORMAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preferredTimes, setPreferredTimes] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory("GENERAL");
      setPriority("NORMAL");
      setTitle("");
      setDescription("");
      setPreferredTimes("");
      setPhone("");
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      showToast({
        message: "Title and description are required",
        variant: "error",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await createTenantMaintenanceRequest({
        category,
        priority,
        title: title.trim(),
        description: description.trim(),
        tenantContact: {
          phone: phone.trim() || undefined,
          preferredTimes: preferredTimes.trim() || undefined,
        },
      });
      const emailed = Boolean(res?.emailed);
      showToast({
        message: emailed ? "Request submitted and landlord notified." : "Request submitted.",
        variant: "success",
      });
      onCreated?.();
      onClose();
    } catch (err: any) {
      const msg = err?.payload?.error || err?.message || "Failed to submit request";
      showToast({ message: "Failed to submit", description: msg, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 96vw)",
          background: "#fff",
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          boxShadow: shadows.lg,
          padding: spacing.lg,
          color: text.primary,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>New maintenance request</div>
            <div style={{ fontSize: 12, color: text.muted }}>Describe the issue so your landlord can assist.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: radius.pill,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              color: text.primary,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: spacing.md, display: "grid", gap: spacing.sm }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            >
              {priorities.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary"
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe the issue"
              style={{
                padding: "10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
                resize: "vertical",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>Preferred contact times (optional)</span>
            <input
              value={preferredTimes}
              onChange={(e) => setPreferredTimes(e.target.value)}
              placeholder="e.g., Weekdays after 5pm"
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>Phone (optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 555-123-4567"
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: text.primary,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.accent}`,
                background: colors.accent,
                color: "white",
                padding: "8px 14px",
                cursor: "pointer",
                boxShadow: shadows.sm,
                opacity: submitting ? 0.75 : 1,
              }}
            >
              {submitting ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
