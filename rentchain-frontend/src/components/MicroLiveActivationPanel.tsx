import React, { useEffect, useState } from "react";
import { completeMicroLiveStep, fetchMicroLiveStatus, type MicroLiveStatus } from "../api/microLive";

export default function MicroLiveActivationPanel() {
  const [status, setStatus] = useState<MicroLiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const s = await fetchMicroLiveStatus();
      setStatus(s);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onMark(stepKey: string) {
    try {
      setBusyKey(stepKey);
      await completeMicroLiveStep(stepKey);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to update");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
        Loading Micro-Live checklist…
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ border: "1px solid #f3c", borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Micro-Live checklist</div>
        <div style={{ opacity: 0.9 }}>{err}</div>
      </div>
    );
  }

  const completed = status?.completed || {};
  const pct = status ? Math.round((status.completedCount / Math.max(status.total, 1)) * 100) : 0;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Micro-Live Activation</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          {status?.completedCount}/{status?.total} • {pct}%
        </div>
      </div>

      <div style={{ height: 8 }} />

      <div style={{ display: "grid", gap: 10 }}>
        {status?.steps?.map((s) => {
          const done = Boolean(completed[s.key]);
          return (
            <div
              key={s.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                border: "1px solid #eee",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: done ? "#16a34a" : "#e5e7eb",
                  }}
                />
                <div style={{ fontWeight: 700 }}>{s.label}</div>
              </div>

              {done ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>Done</div>
              ) : (
                <button
                  onClick={() => onMark(s.key)}
                  disabled={busyKey === s.key}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    fontWeight: 800,
                    cursor: busyKey === s.key ? "not-allowed" : "pointer",
                  }}
                >
                  {busyKey === s.key ? "Saving…" : "Mark complete"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
        Tip: Complete these steps to unlock priority support and faster feature access.
      </div>
    </div>
  );
}
