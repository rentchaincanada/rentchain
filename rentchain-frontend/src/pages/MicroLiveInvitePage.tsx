import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { acceptInvite, fetchInvite, type InviteInfo } from "../api/invites";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function MicroLiveInvitePage() {
  const q = useQuery();
  const navigate = useNavigate();
  const inviteId = q.get("invite") || "";

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        setLoading(true);
        setErr(null);
        if (!inviteId) throw new Error("Missing invite token");
        const j = await fetchInvite(inviteId);
        if (!mounted) return;
        setInfo(j);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load invite");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [inviteId]);

  async function onAccept() {
    try {
      setAccepting(true);
      setErr(null);
      if (!inviteId) throw new Error("Missing invite token");
      await acceptInvite(inviteId);
      navigate("/login?from=micro-live");
    } catch (e: any) {
      setErr(e?.message || "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "var(--rc-accent, #2f80ed)",
          }}
        />
        <div style={{ fontWeight: 700, fontSize: 18 }}>RentChain Micro-Live</div>
      </div>

      {loading ? (
        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>Loading invite…</div>
      ) : err ? (
        <div style={{ padding: 16, border: "1px solid #f3c", borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Invite issue</div>
          <div style={{ opacity: 0.9 }}>{err}</div>
          <div style={{ marginTop: 12 }}>
            <a href="/pricing">Join the waitlist</a>
          </div>
        </div>
      ) : (
        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>✅ Invite confirmed</div>
          <div style={{ opacity: 0.9, marginBottom: 12 }}>
            {info?.name ? `Welcome, ${info.name}. ` : ""}
            Your Micro-Live invite is ready.
          </div>

          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              Campaign: <b>{info?.campaign}</b>
            </div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              Status: <b>{info?.inviteStatus}</b>
            </div>
          </div>

          <button
            onClick={onAccept}
            disabled={accepting}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontWeight: 700,
              cursor: accepting ? "not-allowed" : "pointer",
            }}
          >
            {accepting ? "Activating…" : "Continue to login"}
          </button>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
            During Micro-Live, some features remain read-only to keep data safe.
          </div>
        </div>
      )}
    </div>
  );
}
