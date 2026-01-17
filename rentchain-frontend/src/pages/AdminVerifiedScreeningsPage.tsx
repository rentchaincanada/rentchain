import React, { useEffect, useMemo, useState } from "react";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button, Pill, Input } from "../components/ui/Ui";
import { useToast } from "../components/ui/ToastProvider";
import { useAuth } from "../context/useAuth";
import {
  listVerifiedScreenings,
  fetchVerifiedScreening,
  updateVerifiedScreening,
  type VerifiedScreeningQueueItem,
} from "../api/adminVerifiedScreeningsApi";
import { colors, spacing, text, radius } from "../styles/tokens";

const statusOptions = ["QUEUED", "IN_PROGRESS", "COMPLETE", "CANCELLED"] as const;
const recommendationOptions = ["APPROVE", "DECLINE", "CONDITIONAL"] as const;

const AdminVerifiedScreeningsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<VerifiedScreeningQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VerifiedScreeningQueueItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const load = async () => {
    try {
      setLoading(true);
      const list = await listVerifiedScreenings();
      setItems(list);
      if (!selectedId && list.length) {
        setSelectedId(list[0].id);
      }
    } catch (err: any) {
      showToast({ message: "Failed to load queue", description: err?.message || "", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedId) {
        setDetail(null);
        return;
      }
      try {
        const data = await fetchVerifiedScreening(selectedId);
        setDetail(data);
      } catch (err: any) {
        showToast({ message: "Failed to load detail", description: err?.message || "", variant: "error" });
      }
    };
    if (isAdmin) void loadDetail();
  }, [selectedId, isAdmin]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => {
      const name = (i.applicant?.name || "").toLowerCase();
      const email = (i.applicant?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q) || i.applicationId?.toLowerCase().includes(q);
    });
  }, [items, search]);

  const handleSave = async () => {
    if (!detail) return;
    try {
      setSaving(true);
      const updated = await updateVerifiedScreening(detail.id, {
        status: detail.status,
        notesInternal: detail.notesInternal ?? null,
        resultSummary: detail.resultSummary ?? null,
        recommendation: detail.recommendation ?? null,
      });
      setDetail(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      showToast({ message: "Queue item updated", variant: "success" });
    } catch (err: any) {
      showToast({ message: "Save failed", description: err?.message || "", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <MacShell title="Admin · Verified Screenings">
        <Section>
          <Card elevated>
            <div style={{ color: text.muted, fontSize: 14 }}>Not available.</div>
          </Card>
        </Section>
      </MacShell>
    );
  }

  return (
    <MacShell title="Admin · Verified Screenings">
      <Section style={{ display: "grid", gap: spacing.md }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Verified Screening Queue</h1>
          <div style={{ display: "flex", gap: spacing.sm }}>
            <Button type="button" variant="secondary" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card
          elevated
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1fr) minmax(0, 2fr)",
            gap: spacing.lg,
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search applicant or application ID"
              style={{ width: "100%" }}
            />
            {loading ? (
              <div style={{ color: text.muted }}>Loading queue...</div>
            ) : filtered.length === 0 ? (
              <div style={{ color: text.muted }}>No verified screenings.</div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    textAlign: "left",
                    border: `1px solid ${item.id === selectedId ? colors.accent : colors.border}`,
                    background: item.id === selectedId ? "rgba(37,99,235,0.08)" : colors.card,
                    borderRadius: radius.md,
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 700, color: text.primary }}>{item.applicant?.name || "Applicant"}</div>
                  <div style={{ color: text.muted, fontSize: 12 }}>{item.applicant?.email || "No email"}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Pill>{item.status}</Pill>
                    <Pill>{item.serviceLevel}</Pill>
                  </div>
                  <div style={{ fontSize: 12, color: text.muted }}>
                    ${(item.totalAmountCents / 100).toFixed(2)} {item.currency}
                  </div>
                </button>
              ))
            )}
          </div>

          <Card>
            {!detail ? (
              <div style={{ color: text.muted }}>Select a queue item.</div>
            ) : (
              <div style={{ display: "grid", gap: spacing.md }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{detail.applicant?.name || "Applicant"}</div>
                    <div style={{ color: text.muted }}>{detail.applicant?.email || "No email"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Pill>{detail.serviceLevel}</Pill>
                    <Pill>{detail.status}</Pill>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
                  <div>Order ID: {detail.orderId}</div>
                  <div>Application ID: {detail.applicationId}</div>
                  <div>Property ID: {detail.propertyId}</div>
                  <div>Unit ID: {detail.unitId || "n/a"}</div>
                  <div>Paid: ${(detail.totalAmountCents / 100).toFixed(2)} {detail.currency}</div>
                  <div>Created: {detail.createdAt ? new Date(detail.createdAt).toLocaleString() : "-"}</div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Status</label>
                  <select
                    value={detail.status}
                    onChange={(e) => setDetail({ ...detail, status: e.target.value as any })}
                    style={{ padding: "8px 10px", borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Recommendation</label>
                  <select
                    value={detail.recommendation || ""}
                    onChange={(e) =>
                      setDetail({ ...detail, recommendation: (e.target.value as any) || null })
                    }
                    style={{ padding: "8px 10px", borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                  >
                    <option value="">Select</option>
                    {recommendationOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Internal notes</label>
                  <textarea
                    value={detail.notesInternal || ""}
                    onChange={(e) => setDetail({ ...detail, notesInternal: e.target.value })}
                    rows={4}
                    style={{ padding: "8px 10px", borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Result summary</label>
                  <textarea
                    value={detail.resultSummary || ""}
                    onChange={(e) => setDetail({ ...detail, resultSummary: e.target.value })}
                    rows={4}
                    style={{ padding: "8px 10px", borderRadius: radius.md, border: `1px solid ${colors.border}` }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </Card>
      </Section>
    </MacShell>
  );
};

export default AdminVerifiedScreeningsPage;
