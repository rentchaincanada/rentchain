import React, { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { colors, radius, shadows, spacing, text } from "../../styles/tokens";
import { useToast } from "../ui/ToastProvider";
import { getAuthToken } from "../../lib/authToken";

type Props = {
  open: boolean;
  tenantId: string;
  onClose: () => void;
  onCreated?: (id?: string) => void;
};

const NOTICE_TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "LATE_RENT", label: "Late rent" },
  { value: "ENTRY_NOTICE", label: "Entry notice" },
  { value: "LEASE_UPDATE", label: "Lease update" },
  { value: "WARNING", label: "Warning" },
];

export const CreateNoticeModal: React.FC<Props> = ({ open, tenantId, onClose, onCreated }) => {
  const { showToast } = useToast();
  const [type, setType] = useState("GENERAL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType("GENERAL");
      setTitle("");
      setBody("");
      setEffectiveAt("");
      setSubmitting(false);
      setCreatedId(null);
      setCreatedLink(null);
      setCopyMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const parseEffectiveAt = () => {
    if (!effectiveAt) return null;
    const d = new Date(effectiveAt);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
  };

  const copyText = async (txt: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(txt);
      } else {
        throw new Error("no-clipboard");
      }
    } catch {
      const ta = document.createElement("textarea");
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    }
    setCopyMsg("Copied");
    setTimeout(() => setCopyMsg(null), 1200);
  };

  const submit = async () => {
    if (!tenantId) {
      showToast({ message: "Tenant required", description: "Select a tenant first.", variant: "error" });
      return;
    }
    if (!title.trim() || !body.trim()) {
      showToast({
        message: "Title and body required",
        description: "Please add a title and body for this notice.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = getAuthToken() ?? undefined;
      const eff = parseEffectiveAt();
      const res: any = await apiFetch("/tenant-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        token,
        body: JSON.stringify({
          tenantId,
          type,
          title: title.trim(),
          body: body.trim(),
          effectiveAt: eff,
        }),
      });
      const noticeId = res?.data?.[0]?.id || res?.data?.id || res?.id || null;
      setCreatedId(noticeId);
      const link = noticeId ? `${window.location.origin}/tenant/notices/${noticeId}` : null;
      setCreatedLink(link);
      const emailed = res?.emailed === true;
      const emailError = res?.emailError;
      if (emailed) {
        showToast({
          message: "Notice created and emailed to tenant.",
          variant: "success",
        });
      } else {
        showToast({
          message: "Notice created. Email not sent.",
          description: emailError ? String(emailError) : undefined,
          variant: "success",
        });
      }
      onCreated?.(noticeId || undefined);
      onClose();
    } catch (err: any) {
      const msg = err?.payload?.error || err?.message || "Failed to create notice.";
      showToast({ message: "Failed to create notice", description: msg, variant: "error" });
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
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          boxShadow: shadows.lg,
          padding: spacing.lg,
          color: text.primary,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Create notice</div>
            <div style={{ fontSize: 12, color: text.muted }}>
              Send an official notice to the tenant. Tenants see notices read-only.
            </div>
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

        <div style={{ marginTop: spacing.md, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: text.muted }}>Type</div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            >
              {NOTICE_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: text.muted }}>Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Late rent notice"
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: text.muted }}>Effective date (optional)</div>
            <input
              type="datetime-local"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: text.muted }}>Body</div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Provide details for the tenant..."
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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
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
                border: `1px solid ${colors.border}`,
                background: colors.accent,
                color: "white",
                padding: "8px 14px",
                cursor: "pointer",
                boxShadow: shadows.sm,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving..." : "Create notice"}
            </button>
          </div>
          {createdId ? (
            <div
              style={{
                marginTop: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                display: "grid",
                gap: 8,
                fontSize: 12,
                color: text.primary,
              }}
            >
              <div style={{ fontWeight: 700 }}>Notice created</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ color: text.muted }}>Notice ID: {createdId}</span>
                <button
                  type="button"
                  onClick={() => copyText(String(createdId))}
                  style={{
                    borderRadius: radius.pill,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                    color: text.primary,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Copy ID
                </button>
              </div>
              {createdLink ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ color: text.muted }}>Tenant link: /tenant/notices/{createdId}</span>
                  <button
                    type="button"
                    onClick={() => copyText(createdLink)}
                    style={{
                      borderRadius: radius.pill,
                      border: `1px solid ${colors.border}`,
                      background: colors.card,
                      color: text.primary,
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Copy link
                  </button>
                </div>
              ) : null}
              {copyMsg ? <div style={{ color: text.muted }}>{copyMsg}</div> : null}
              <div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    marginTop: 6,
                    borderRadius: radius.pill,
                    border: `1px solid ${colors.border}`,
                    background: colors.panel,
                    color: text.primary,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
