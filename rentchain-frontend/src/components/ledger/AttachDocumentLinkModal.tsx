import React, { useState } from "react";
import { postLedgerAttachment } from "../../api/ledgerAttachmentsApi";
import { useToast } from "../ui/ToastProvider";
import { colors, radius, spacing, text } from "../../styles/tokens";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  ledgerItemId: string;
  defaultTitle?: string | null;
  defaultPurpose?: string | null;
  defaultPurposeLabel?: string | null;
};

const PURPOSE_OPTIONS = [
  { value: "RENT", label: "Rent" },
  { value: "PARKING", label: "Parking" },
  { value: "SECURITY_DEPOSIT", label: "Security deposit" },
  { value: "DAMAGE", label: "Damage" },
  { value: "LATE_FEE", label: "Late fee" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "OTHER", label: "Other" },
];

export function AttachDocumentLinkModal({
  open,
  onClose,
  tenantId,
  ledgerItemId,
  defaultTitle,
  defaultPurpose,
  defaultPurposeLabel,
}: Props) {
  const { showToast } = useToast();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState(defaultTitle || "");
  const [purpose, setPurpose] = useState(defaultPurpose || "RENT");
  const [purposeLabel, setPurposeLabel] = useState(defaultPurposeLabel || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showDomainWarning = url.includes("rentchain.ai");

  if (!open) return null;

  const submit = async () => {
    const cleanUrl = url.trim();
    if (!tenantId || !ledgerItemId) {
      setError("Missing tenant or ledger item.");
      return;
    }
    if (!cleanUrl || !cleanUrl.startsWith("https://")) {
      setError("Enter a valid https link.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await postLedgerAttachment(ledgerItemId, {
        tenantId,
        url: cleanUrl,
        title: title.trim() || defaultTitle || null,
        purpose,
        purposeLabel: purposeLabel.trim() || undefined,
      });
      showToast({ message: "Document linked", variant: "success" });
      onClose();
      setUrl("");
      setPurposeLabel(defaultPurposeLabel || "");
    } catch (e: any) {
      setError(e?.message || "Failed to attach document");
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
        zIndex: 1200,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 94vw)",
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          boxShadow: "0 20px 50px rgba(15,23,42,0.25)",
          padding: spacing.lg,
          color: text.primary,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Attach document link</div>
            <div style={{ fontSize: 12, color: text.muted }}>Share a receipt or document URL.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              borderRadius: radius.pill,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: spacing.md }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>URL (https)</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              style={{
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
              }}
            />
            {showDomainWarning ? (
              <div style={{ color: "#b45309", fontSize: 12 }}>
                This link may require landlord login for tenants. Prefer a public share link (Drive/Dropbox).
              </div>
            ) : null}
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>Title (optional)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle || "Document title"}
              style={{
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>Purpose</span>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
              }}
            >
              {PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: text.muted }}>Purpose details (optional)</span>
            <input
              value={purposeLabel}
              onChange={(e) => setPurposeLabel(e.target.value)}
              placeholder="e.g., Jan 2026, Spot #12"
              style={{
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
              }}
            />
          </label>

          {error ? (
            <div style={{ color: "#b91c1c", fontSize: 13, paddingTop: 4 }}>{error}</div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                cursor: "pointer",
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              style={{
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: "#111827",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving..." : "Attach"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
