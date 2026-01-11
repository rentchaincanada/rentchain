import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { setTenantToken } from "./tenantAuth";
import { apiFetch } from "../lib/apiClient";

export default function TenantInviteRedeem() {
  const { token } = useParams();
  const nav = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setStatus("loading");
        const res: any = await apiFetch("/tenant-invites/redeem", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        if (!res?.tenantToken) throw new Error("No tenant token returned");
        setTenantToken(res.tenantToken);
        setStatus("ok");
        nav("/tenant", { replace: true });
      } catch (e: any) {
        setStatus("error");
        setErr(e?.message || "Failed to redeem invite");
      }
    })();
  }, [token, nav]);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Joining RentChain</h1>
      {status === "loading" && (
        <p style={{ color: "#6b7280", fontSize: 14 }}>Redeeming invite…</p>
      )}
      {status === "idle" && (
        <p style={{ color: "#6b7280", fontSize: 14 }}>Preparing…</p>
      )}
      {status === "ok" && (
        <div style={{ padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: 14 }}>Invite redeemed. Redirecting…</p>
        </div>
      )}
      {status === "error" && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #fecdd3",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Couldn’t redeem invite</div>
          <div style={{ color: "#b91c1c" }}>{err}</div>
          <button
            onClick={() => nav("/", { replace: true })}
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              cursor: "pointer",
            }}
          >
            Back to Home
          </button>
        </div>
      )}
    </div>
  );
}
