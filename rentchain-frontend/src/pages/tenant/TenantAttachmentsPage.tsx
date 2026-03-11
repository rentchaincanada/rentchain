import React, { useEffect, useState } from "react";
import { getTenantAttachments, TenantAttachment } from "../../api/tenantAttachmentsApi";
import { Card } from "../../components/ui/Ui";
import { colors, spacing, text as textTokens } from "../../styles/tokens";

function fmtDate(ts?: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function labelForAttachment(item: TenantAttachment): string {
  const purpose = String(item.purpose || "").trim();
  const custom = String(item.purposeLabel || "").trim();
  if (purpose && custom) return `${purpose} — ${custom}`;
  if (custom) return custom;
  if (purpose) return purpose;
  return "Document";
}

export default function TenantAttachmentsPage() {
  const [items, setItems] = useState<TenantAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTenantAttachments();
        if (!cancelled) setItems(Array.isArray(res?.data) ? res.data : []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Unable to load documents.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card elevated style={{ padding: spacing.lg }}>
      <div style={{ marginBottom: spacing.md }}>
        <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.4rem" }}>Documents</h1>
        <div style={{ marginTop: 6, color: textTokens.muted }}>
          Files and receipts shared with your tenancy record.
        </div>
      </div>

      {error ? (
        <div style={{ color: colors.danger }}>{error}</div>
      ) : loading ? (
        <div style={{ color: textTokens.muted }}>Loading documents…</div>
      ) : items.length === 0 ? (
        <div style={{ color: textTokens.muted }}>No documents available yet.</div>
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                background: colors.card,
                padding: spacing.sm,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.sm,
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 700, color: textTokens.primary }}>{labelForAttachment(item)}</div>
                <div style={{ fontSize: "0.9rem", color: textTokens.muted }}>
                  {item.fileName || item.title || "Attachment"} • {fmtDate(item.createdAt)}
                </div>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: colors.accent, textDecoration: "none", fontWeight: 700 }}
              >
                Open
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
