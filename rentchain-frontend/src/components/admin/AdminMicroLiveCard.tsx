import React, { useEffect, useState } from "react";
import { fetchAdminMicroLiveMetrics, type AdminMicroLiveMetrics } from "../../api/adminMicroLive";

export default function AdminMicroLiveCard() {
  const [m, setM] = useState<AdminMicroLiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        setLoading(true);
        const j = await fetchAdminMicroLiveMetrics(7);
        if (!mounted) return;
        setM(j);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>Micro-Live (Admin)</div>

      {loading ? (
        <div style={{ opacity: 0.8 }}>Loading metrics…</div>
      ) : err ? (
        <div style={{ opacity: 0.9 }}>{err}</div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <div>
              Enabled landlords (sample): <b>{m?.enabledLandlordsInSample ?? 0}</b>
            </div>
            <div>
              Invites sent: <b>{m?.counters?.waitlist_invite_sent ?? 0}</b>
            </div>
            <div>
              Invites accepted: <b>{m?.counters?.waitlist_invite_accept ?? 0}</b>{" "}
              <span style={{ opacity: 0.6 }}>(accepted invites)</span>
            </div>
            <div>
              Status views: <b>{m?.counters?.micro_live_status_view ?? 0}</b>
            </div>
            <div>
              Steps completed: <b>{m?.counters?.micro_live_step_complete ?? 0}</b>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
            Window: last {m?.days ?? 7} days • Add more counters as needed.
          </div>
        </>
      )}
    </div>
  );
}
