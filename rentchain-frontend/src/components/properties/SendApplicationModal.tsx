import React from "react";
import { createApplicationLink } from "../../api/applicationLinksApi";
import { useToast } from "../ui/ToastProvider";

type Props = {
  open: boolean;
  propertyId?: string | null;
  unit?: any | null;
  onClose: () => void;
};

export function SendApplicationModal({ open, propertyId, unit, onClose }: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [link, setLink] = React.useState<string | null>(null);
  const tenantEmail = (unit as any)?.tenantEmail || "";

  React.useEffect(() => {
    if (!open) {
      setLoading(false);
      setError(null);
      setLink(null);
    }
  }, [open]);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!propertyId || !(unit as any)?.id) {
      setError("Missing property or unit id");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await createApplicationLink(String(propertyId), String((unit as any).id));
      const url = (res as any)?.applicationUrl || (res as any)?.link || null;
      if (!url) {
        throw new Error("Missing application link");
      }
      setLink(url);
      showToast({
        message: "Application link ready",
        description: "Share this link with the applicant.",
        variant: "success",
      });
    } catch (e: any) {
      const msg = e?.message || "Failed to create application link";
      setError(msg);
      showToast({ message: "Could not create link", description: msg, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showToast({ message: "Link copied", variant: "success" });
    } catch {
      showToast({ message: "Copy failed", variant: "error" });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1200,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Send application</div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16 }}
            aria-label="Close"
            >
            x
          </button>
        </div>

        <div style={{ fontSize: "0.9rem", color: "#111827" }}>
          Generate a shareable link for unit {(unit as any)?.unitNumber || ""}.
        </div>

        {error ? (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        ) : null}

        {link ? (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Application link</div>
            <input
              readOnly
              value={link}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: "0.9rem",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={copyLink}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Copy link
              </button>
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#0f172a",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Open link
              </a>
            </div>
            {tenantEmail ? (
              <div style={{ fontSize: "0.85rem", color: "#374151" }}>Invite sent to {tenantEmail}</div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Generating..." : "Generate link"}
          </button>
        </div>
      </div>
    </div>
  );
}
