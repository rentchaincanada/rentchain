import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { setTenantToken } from "./tenantAuth";
import { DEBUG_AUTH_KEY, JUST_LOGGED_IN_KEY } from "../lib/authKeys";
import { apiFetch } from "../lib/apiClient";
import { clearAuthToken } from "../lib/authToken";
import {
  tenantEntryBodyStyle,
  tenantEntryCardStyle,
  tenantEntryGhostButtonStyle,
  tenantEntryPalette,
  tenantEntryShellStyle,
} from "../pages/tenant/tenantEntryStyles";

export default function TenantInviteRedeem() {
  const { token } = useParams();
  const nav = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [err, setErr] = useState<string>("");
  const nextParam = (() => {
    const p = new URLSearchParams(window.location.search).get("next") || "";
    try {
      const decoded = decodeURIComponent(p);
      if (decoded.startsWith("/tenant")) return decoded;
    } catch {
      return "";
    }
    return "";
  })();

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
        try {
          clearAuthToken();
        } catch {
          // ignore
        }
        const dbg = localStorage.getItem(DEBUG_AUTH_KEY) === "1";
        try {
          localStorage.setItem(JUST_LOGGED_IN_KEY, String(Date.now()));
          sessionStorage.setItem(JUST_LOGGED_IN_KEY, String(Date.now()));
        } catch {
          // ignore
        }
        if (dbg) {
          const sLen = (sessionStorage.getItem("rentchain_tenant_token") || "").length;
          const lLen = (localStorage.getItem("rentchain_tenant_token") || "").length;
          // eslint-disable-next-line no-console
          if (import.meta.env.DEV || dbg) console.log("[tenant-invite-redeem] stored token lengths", { sLen, lLen });
        }
        setStatus("ok");
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 150));
        nav(nextParam || "/tenant", { replace: true });
      } catch (e: any) {
        setStatus("error");
        setErr(e?.message || "Failed to redeem invite");
      }
    })();
  }, [token, nav]);

  return (
    <div style={tenantEntryShellStyle}>
      <div style={tenantEntryCardStyle()}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: tenantEntryPalette.ink }}>
          Joining RentChain
        </h1>
        {status === "loading" && (
          <p style={{ ...tenantEntryBodyStyle, marginTop: 8 }}>Redeeming invite...</p>
        )}
        {status === "idle" && (
          <p style={{ ...tenantEntryBodyStyle, marginTop: 8 }}>Preparing...</p>
        )}
        {status === "ok" && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${tenantEntryPalette.sageBorder}`,
              background: tenantEntryPalette.sage,
              color: tenantEntryPalette.ink,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Invite redeemed. Redirecting...</p>
          </div>
        )}
        {status === "error" && (
          <div
            role="alert"
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(180, 35, 24, 0.24)",
              background: "rgba(254, 242, 242, 0.92)",
              color: tenantEntryPalette.danger,
              fontSize: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Couldn’t redeem invite</div>
            <div style={{ color: tenantEntryPalette.danger }}>{err}</div>
            <button
              onClick={() => nav("/", { replace: true })}
              style={{
                ...tenantEntryGhostButtonStyle,
                marginTop: 10,
              }}
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
