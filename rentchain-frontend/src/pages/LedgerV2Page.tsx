import React, { useEffect, useMemo, useState } from "react";
import { createLedgerNoteV2, getLedgerEventV2, listLedgerV2, LedgerEventV2 } from "../api/ledgerV2";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useUpgrade } from "@/context/UpgradeContext";
import { colors, spacing } from "@/styles/tokens";

type Filters = {
  eventType: string;
  search: string;
  propertyId: string;
  tenantId: string;
};

const EVENT_TYPES = [
  "ALL",
  "PROPERTY_CREATED",
  "UNIT_CREATED",
  "TENANT_CREATED",
  "LEASE_CREATED",
  "PAYMENT_RECORDED",
  "PAYMENT_UPDATED",
  "NOTE_ADDED",
  "STATUS_CHANGED",
] as const;

export default function LedgerV2Page() {
  const { features, loading: capsLoading } = useCapabilities();
  const { openUpgrade } = useUpgrade();
  const ledgerEnabled = features?.ledger !== false;
  const [filters, setFilters] = useState<Filters>({
    eventType: "ALL",
    search: "",
    propertyId: "",
    tenantId: "",
  });
  const [items, setItems] = useState<LedgerEventV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<LedgerEventV2 | null>(null);
  const [adding, setAdding] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteSummary, setNoteSummary] = useState("");

  const filtered = useMemo(() => {
    const term = filters.search.toLowerCase();
    return items.filter((it) => {
      if (filters.eventType !== "ALL" && it.eventType !== filters.eventType) return false;
      if (filters.propertyId && it.propertyId !== filters.propertyId) return false;
      if (filters.tenantId && it.tenantId !== filters.tenantId) return false;
      if (term) {
        const hay = `${it.title} ${it.summary || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [items, filters]);

  async function load() {
    if (!ledgerEnabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listLedgerV2({
        limit: 50,
        propertyId: filters.propertyId || undefined,
        tenantId: filters.tenantId || undefined,
        eventType: filters.eventType !== "ALL" ? filters.eventType : undefined,
      });
      setItems(res.items || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerEnabled]);

  async function openDetail(id: string) {
    try {
      const res = await getLedgerEventV2(id);
      setDetail(res.item);
    } catch (e: any) {
      setError(e?.message || "Failed to load detail");
    }
  }

  async function addNote() {
    if (!noteTitle.trim()) return;
    setAdding(true);
    try {
      await createLedgerNoteV2({ title: noteTitle.trim(), summary: noteSummary.trim() || undefined });
      setNoteTitle("");
      setNoteSummary("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to add note");
    } finally {
      setAdding(false);
    }
  }

  if (!capsLoading && !ledgerEnabled) {
    return (
      <div style={{ padding: 20 }}>
        <div
          style={{
            border: "1px solid rgba(148,163,184,0.35)",
            borderRadius: 16,
            padding: spacing.lg,
            background: "#fff",
            maxWidth: 640,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            Upgrade to manage your rentals
          </div>
          <div style={{ color: "#64748b", fontSize: 14, marginBottom: 12 }}>
            RentChain Screening is free. Rental management starts on Starter.
          </div>
          <button
            type="button"
            onClick={() =>
              openUpgrade({
                reason: "screening",
                plan: "Screening",
                copy: {
                  title: "Upgrade to manage your rentals",
                  body: "RentChain Screening is free. Rental management starts on Starter.",
                },
                ctaLabel: "Upgrade to Starter",
              })
            }
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(59,130,246,0.45)",
              background: "rgba(59,130,246,0.12)",
              color: colors.accent,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Upgrade to Starter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Ledger v2</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Title"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          />
          <input
            placeholder="Summary (optional)"
            value={noteSummary}
            onChange={(e) => setNoteSummary(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", width: 200 }}
          />
          <button onClick={addNote} disabled={adding} style={{ padding: "8px 12px" }}>
            {adding ? "Saving…" : "Add Note"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          placeholder="Search"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <select
          value={filters.eventType}
          onChange={(e) => setFilters((f) => ({ ...f, eventType: e.target.value }))}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          placeholder="PropertyId"
          value={filters.propertyId}
          onChange={(e) => setFilters((f) => ({ ...f, propertyId: e.target.value }))}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <input
          placeholder="TenantId"
          value={filters.tenantId}
          onChange={(e) => setFilters((f) => ({ ...f, tenantId: e.target.value }))}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <button onClick={load} disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? <div style={{ color: "red" }}>{error}</div> : null}
      {loading ? <div>Loading…</div> : null}

      <div style={{ border: "1px solid #eee", borderRadius: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 130px 1fr 150px 100px", padding: 10, fontWeight: 700, borderBottom: "1px solid #eee" }}>
          <div>Date</div>
          <div>Type</div>
          <div>Title</div>
          <div>Property/Tenant</div>
          <div>Amount</div>
        </div>
        {filtered.map((it) => (
          <div
            key={it.id}
            onClick={() => openDetail(it.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "140px 130px 1fr 150px 100px",
              padding: 10,
              borderBottom: "1px solid #f4f4f4",
              cursor: "pointer",
            }}
          >
            <div>{new Date(it.occurredAt).toLocaleString()}</div>
            <div>{it.eventType}</div>
            <div>{it.title}</div>
            <div>
              {it.propertyId || "-"}
              {it.tenantId ? ` / ${it.tenantId}` : ""}
            </div>
            <div>{it.amount ? `${it.amount.toFixed(2)} ${it.currency || ""}` : "-"}</div>
          </div>
        ))}
        {filtered.length === 0 && !loading ? <div style={{ padding: 12 }}>No ledger events</div> : null}
      </div>

      {detail && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: 360,
            height: "100vh",
            background: "#fff",
            boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
            padding: 16,
            overflow: "auto",
          }}
        >
          <button onClick={() => setDetail(null)} style={{ float: "right" }}>
            Close
          </button>
          <h3>{detail.title}</h3>
          <div style={{ opacity: 0.7, fontSize: 13 }}>{detail.eventType}</div>
          <div style={{ marginTop: 8 }}>{detail.summary}</div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            Occurred: {new Date(detail.occurredAt).toLocaleString()}
          </div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            Property: {detail.propertyId || "-"} | Tenant: {detail.tenantId || "-"}
          </div>
          <pre style={{ marginTop: 12, background: "#f9f9f9", padding: 8, borderRadius: 8, fontSize: 12 }}>
            {JSON.stringify(detail.metadata || {}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
