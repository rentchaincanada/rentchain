import React, { useEffect, useState } from "react";
import { tenantApiFetch } from "../../api/tenantApiFetch";
import { Card } from "../../components/ui/Ui";
import { colors, spacing, text as textTokens } from "../../styles/tokens";

type ActivityItem = {
  id: string;
  type: "invite" | "lease" | "rent" | "notice" | "system";
  title: string;
  description?: string | null;
  occurredAt: number;
};

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function TenantActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await tenantApiFetch<{ ok: boolean; data: ActivityItem[] }>("/tenant/activity");
        if (!cancelled) setItems(Array.isArray(res?.data) ? res.data : []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Unable to load activity.");
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
        <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.4rem" }}>Activity</h1>
        <div style={{ marginTop: 6, color: textTokens.muted }}>
          Recent events for your tenant account.
        </div>
      </div>

      {error ? (
        <div style={{ color: colors.danger }}>{error}</div>
      ) : loading ? (
        <div style={{ color: textTokens.muted }}>Loading activity…</div>
      ) : items.length === 0 ? (
        <div style={{ color: textTokens.muted }}>No activity available yet.</div>
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
              }}
            >
              <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.title}</div>
              <div style={{ color: textTokens.muted, fontSize: "0.9rem" }}>
                {item.type} • {fmtDate(item.occurredAt)}
              </div>
              {item.description ? (
                <div style={{ marginTop: 6, color: textTokens.secondary }}>{item.description}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
