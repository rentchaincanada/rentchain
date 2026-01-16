import React, { useEffect, useState } from "react";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text, colors, radius, shadows } from "../styles/tokens";
import { apiFetch } from "@/api/http";

type MaintItem = {
  id: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  category?: string;
  priority?: string;
  status?: string;
  title?: string;
  updatedAt?: number;
  description?: string;
  landlordNote?: string | null;
};

const statuses = ["NEW", "IN_PROGRESS", "WAITING_ON_TENANT", "SCHEDULED", "RESOLVED", "CLOSED"];

const MaintenanceRequestsPage: React.FC = () => {
  const [items, setItems] = useState<MaintItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MaintItem | null>(null);
  const [status, setStatus] = useState<string>("NEW");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await apiFetch("/maintenance-requests");
      const list = Array.isArray(res?.data) ? res.data : [];
      setItems(list);
      if (list.length && !selected) {
        const first = list[0];
        setSelected(first);
        setStatus(first.status || "NEW");
        setNote(first.landlordNote || "");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectRow = (item: MaintItem) => {
    setSelected(item);
    setStatus(item.status || "NEW");
    setNote(item.landlordNote || "");
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch(`/maintenance-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, landlordNote: note }),
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <Card elevated>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: text.primary }}>Maintenance</h1>
            <div style={{ fontSize: "0.95rem", color: text.muted }}>Track and update tenant maintenance requests.</div>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </Card>

      <Card
        elevated
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 2fr)",
          gap: spacing.lg,
          minHeight: 0,
        }}
      >
        <div style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {loading ? (
            <div style={{ color: text.muted }}>Loading requests...</div>
          ) : error ? (
            <div style={{ color: colors.danger }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ color: text.muted }}>No maintenance requests yet.</div>
          ) : (
            <div style={{ overflowY: "auto", display: "grid", gap: spacing.xs }}>
              {items.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectRow(item)}
                    style={{
                      textAlign: "left",
                      border: `1px solid ${active ? colors.accent : colors.border}`,
                      background: active ? "rgba(37,99,235,0.08)" : colors.card,
                      borderRadius: radius.md,
                      padding: "10px 12px",
                      cursor: "pointer",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: text.primary }}>{item.title || "Untitled"}</div>
                    <div style={{ fontSize: 12, color: text.muted }}>
                      {item.status} • {item.priority} • {item.category}
                    </div>
                    <div style={{ fontSize: 12, color: text.secondary }}>
                      Tenant: {item.tenantId || "-"} | Property: {item.propertyId || "-"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Section style={{ minHeight: 0 }}>
          {!selected ? (
            <div style={{ color: text.muted }}>Select a request to view details.</div>
          ) : (
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: text.primary }}>{selected.title}</div>
                  <div style={{ fontSize: 12, color: text.muted }}>
                    {selected.status} • {selected.priority} • {selected.category}
                  </div>
                </div>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: text.muted }}>Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.panel,
                    color: text.primary,
                  }}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: text.muted }}>Landlord note</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
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

              <div style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: text.muted }}>Description</span>
                <div
                  style={{
                    padding: "10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                    color: text.primary,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selected.description || "No description"}
                </div>
              </div>
            </div>
          )}
        </Section>
      </Card>
    </div>
  );
};

export default MaintenanceRequestsPage;
