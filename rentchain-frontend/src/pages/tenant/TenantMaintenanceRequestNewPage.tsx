import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input } from "../../components/ui/Ui";
import { createTenantMaintenance } from "../../api/maintenanceWorkflowApi";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";

export default function TenantMaintenanceRequestNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("GENERAL");
  const [priority, setPriority] = React.useState<"low" | "normal" | "urgent">("normal");
  const [photoUploadPending, setPhotoUploadPending] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await createTenantMaintenance({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        photoUploadPending,
      });
      const requestId = String(res?.requestId || "").trim();
      if (requestId) {
        navigate(`/tenant/maintenance/${requestId}`);
      } else {
        navigate("/tenant/maintenance");
      }
    } catch (err: any) {
      setError(err?.message || "Unable to submit maintenance request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card elevated style={{ padding: spacing.lg, display: "grid", gap: spacing.md }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.4rem", color: textTokens.primary }}>New Maintenance Request</h1>
        <div style={{ color: textTokens.muted, marginTop: 6 }}>
          Submit an issue for your landlord and contractor workflow.
        </div>
      </div>

      {error ? (
        <div
          style={{
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: radius.md,
            background: "#fff7ed",
            color: "#9a3412",
            padding: "10px 12px",
          }}
        >
          {error}
        </div>
      ) : null}

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ color: textTokens.muted }}>Title</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leaking kitchen faucet" />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ color: textTokens.muted }}>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Describe the issue and any urgency details."
          style={{
            padding: "10px",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            color: textTokens.primary,
            resize: "vertical",
          }}
        />
      </label>

      <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: textTokens.muted }}>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: "9px 10px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
            }}
          >
            {["GENERAL", "PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "PEST", "CLEANING", "OTHER"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: textTokens.muted }}>Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            style={{
              padding: "9px 10px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
            }}
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="urgent">urgent</option>
          </select>
        </label>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ color: textTokens.muted }}>Attachments</span>
        <input
          type="file"
          disabled
          aria-disabled="true"
          style={{
            padding: "9px 10px",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: "#f8fafc",
            color: textTokens.muted,
            cursor: "not-allowed",
          }}
        />
        <span style={{ color: textTokens.muted, fontSize: "0.9rem" }}>Attachments coming soon.</span>
      </label>

      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit request"}
        </Button>
        <Button variant="secondary" onClick={() => navigate("/tenant/maintenance")}>
          Back to requests
        </Button>
      </div>
    </Card>
  );
}
