import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../../components/ui/Ui";
import {
  createTenantMaintenance,
  deleteTenantMaintenanceImage,
  uploadTenantMaintenanceImage,
} from "../../api/maintenanceWorkflowApi";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";
import { TenantSurfaceShell } from "./TenantWorkspaceShared";

export default function TenantMaintenanceRequestNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("GENERAL");
  const [priority, setPriority] = React.useState<"low" | "normal" | "urgent">("normal");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = React.useState<string | null>(null);
  const [photos, setPhotos] = React.useState<
    Array<{
      key: string;
      file: File;
      previewUrl: string;
      status: "pending" | "uploading" | "uploaded" | "error" | "deleting";
      attachmentId?: string;
    }>
  >([]);

  const selectPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (selected.some((file) => !allowed.has(file.type))) {
      setError("Only JPEG, PNG, and WebP images are supported.");
      return;
    }
    if (selected.some((file) => file.size > 10 * 1024 * 1024)) {
      setError("Each image must be 10 MB or smaller.");
      return;
    }
    if (photos.length + selected.length > 5) {
      setError("You can attach up to 5 images.");
      return;
    }
    if (photos.reduce((total, photo) => total + photo.file.size, 0) + selected.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024) {
      setError("Attachments must total 25 MB or less.");
      return;
    }
    setError(null);
    setPhotos((current) => [
      ...current,
      ...selected.map((file) => ({
        key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "pending" as const,
      })),
    ]);
  };

  const removePhoto = async (key: string) => {
    const photo = photos.find((item) => item.key === key);
    if (!photo || photo.status === "uploading" || photo.status === "deleting") return;
    if (createdRequestId && photo.attachmentId) {
      setPhotos((current) => current.map((item) => item.key === key ? { ...item, status: "deleting" } : item));
      try {
        await deleteTenantMaintenanceImage(createdRequestId, photo.attachmentId);
      } catch (err: any) {
        setPhotos((current) => current.map((item) => item.key === key ? { ...item, status: "error" } : item));
        setError(err?.message || "Unable to remove the photo.");
        return;
      }
    }
    URL.revokeObjectURL(photo.previewUrl);
    setPhotos((current) => current.filter((item) => item.key !== key));
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let requestId = createdRequestId;
      if (!requestId) {
        const res = await createTenantMaintenance({
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          notes: notes.trim(),
        });
        requestId = String(res?.requestId || "").trim();
        if (requestId) setCreatedRequestId(requestId);
      }
      if (requestId) {
        let failed = false;
        for (const photo of photos.filter((item) => item.status !== "uploaded")) {
          setPhotos((current) => current.map((item) => item.key === photo.key ? { ...item, status: "uploading" } : item));
          try {
            const uploaded = await uploadTenantMaintenanceImage(requestId, photo.file);
            setPhotos((current) => current.map((item) => item.key === photo.key
              ? { ...item, status: "uploaded", attachmentId: uploaded.attachmentId }
              : item));
          } catch {
            failed = true;
            setPhotos((current) => current.map((item) => item.key === photo.key ? { ...item, status: "error" } : item));
          }
        }
        if (failed) {
          setError("Your request was saved, but one or more photos could not be uploaded. Retry the failed uploads or remove them.");
          return;
        }
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
    <TenantSurfaceShell
      title="New Maintenance Request"
      subtitle="Submit a tenant-safe maintenance request through the workspace foundation route."
    >
      <div style={{ display: "grid", gap: spacing.md }}>
      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          background: colors.panel,
          padding: "12px 14px",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800, color: textTokens.primary }}>How this works</div>
        <div style={{ color: textTokens.secondary }}>1. Submit the issue with enough detail to help triage the problem.</div>
        <div style={{ color: textTokens.secondary }}>2. Your landlord reviews the request and moves it into the service workflow.</div>
        <div style={{ color: textTokens.secondary }}>3. You can track updates from the maintenance workspace after submission.</div>
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
            onChange={(e) => setPriority(e.target.value as "low" | "normal" | "urgent")}
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
        <span style={{ color: textTokens.muted }}>Optional notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Access instructions, best contact times, or anything else that helps."
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

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ color: textTokens.primary, fontWeight: 700 }}>Add photos</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            selectPhotos(event.target.files);
            event.target.value = "";
          }}
          aria-describedby="maintenance-photo-guidance"
          style={{
            padding: "9px 10px",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            color: textTokens.primary,
          }}
        />
        <span id="maintenance-photo-guidance" style={{ color: textTokens.muted, fontSize: "0.9rem" }}>
          Up to 5 JPEG, PNG, or WebP images, 10 MB each and 25 MB total.
        </span>
      </label>

      {photos.length ? (
        <div aria-label="Selected photos" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: spacing.sm }}>
          {photos.map((photo) => (
            <div key={photo.key} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 8, minWidth: 0 }}>
              <div style={{ width: "100%", aspectRatio: "4 / 3", overflow: "hidden", borderRadius: radius.sm, background: colors.background }}>
                <img
                  src={photo.previewUrl}
                  alt={`Selected maintenance photo preview: ${photo.file.name}`}
                  style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
                />
              </div>
              <div title={photo.file.name} style={{ marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                {photo.file.name}
              </div>
              <div aria-live="polite" style={{ color: textTokens.muted, fontSize: "0.8rem" }}>
                {(photo.file.size / (1024 * 1024)).toFixed(1)} MB · {photo.status}
              </div>
              <button
                type="button"
                onClick={() => void removePhoto(photo.key)}
                disabled={photo.status === "uploading" || photo.status === "deleting"}
                aria-label={`Remove ${photo.file.name}`}
                style={{ marginTop: 6 }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? "Submitting..." : createdRequestId ? "Retry photo uploads" : "Submit request"}
        </Button>
        <Button variant="secondary" onClick={() => navigate("/tenant/maintenance")}>
          Back to requests
        </Button>
      </div>
      </div>
    </TenantSurfaceShell>
  );
}
