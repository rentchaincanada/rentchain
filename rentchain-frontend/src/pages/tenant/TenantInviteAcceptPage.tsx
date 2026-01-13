import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { setTenantToken } from "../../lib/tenantAuth";
import { DEBUG_AUTH_KEY, JUST_LOGGED_IN_KEY } from "../../lib/authKeys";

type InvitePreview = {
  ok: boolean;
  token?: string;
  email?: string | null;
  fullName?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  error?: string;
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        background: "white",
      }}
    >
      {children}
    </div>
  );
}

export default function TenantInviteAcceptPage() {
  const { token } = useParams();
  const inviteToken = useMemo(() => String(token || "").trim(), [token]);
  const navigate = useNavigate();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!inviteToken) return;
      try {
        const res = await fetch(`/api/tenant/invites/${inviteToken}`);
        const data = (await res.json().catch(() => ({}))) as InvitePreview;
        if (!cancelled) {
          if (res.ok && data?.ok) {
            setPreview(data);
            setFullName(String(data.fullName || ""));
          } else {
            setPreview({ ok: true, token: inviteToken });
          }
        }
      } catch {
        if (!cancelled) setPreview({ ok: true, token: inviteToken });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);

    if (!inviteToken) {
      setErr("Missing invite token.");
      return;
    }
    if (!password || password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      let res = await fetch(`/api/tenant/invites/${inviteToken}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, fullName }),
      });

      if (res.status === 404) {
        res = await fetch(`/api/tenant-invites/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken, password, fullName }),
        });
      }

      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to redeem invite.");
      }

      const jwt = data?.tenantToken || data?.token || data?.jwt;
      if (!jwt) {
        throw new Error("Redeem succeeded but no tenant token returned.");
      }

      // store tenant token for portal access
      setTenantToken(jwt);
      try {
        sessionStorage.removeItem("rentchain_token");
        localStorage.removeItem("rentchain_token");
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
        if (import.meta.env.DEV || dbg) console.log("[tenant-invite] stored token lengths", { sLen, lLen });
      }
      await Promise.resolve(); // allow storage write to settle before SPA nav
      await new Promise((resolve) => setTimeout(resolve, 150));
      setOkMsg("Invite accepted. Redirecting to tenant portal...");
      navigate("/tenant", { replace: true });
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "48px auto", padding: 16 }}>
      <Card>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Accept your Tenant Invite</h1>
        <p style={{ marginTop: 8, opacity: 0.75 }}>
          Set a password to access your lease, payments, and ledger.
        </p>

        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.03)" }}>
          <div>
            <b>Invite token:</b> {inviteToken || "-"}
          </div>
          {preview?.email ? (
            <div>
              <b>Email:</b> {preview.email}
            </div>
          ) : null}
          {preview?.propertyId || preview?.unitId ? (
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              {preview.propertyId ? (
                <span>
                  <b>Property:</b> {preview.propertyId}{" "}
                </span>
              ) : null}
              {preview.unitId ? (
                <span style={{ marginLeft: 10 }}>
                  <b>Unit:</b> {preview.unitId}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <form onSubmit={redeem} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.75 }}>Full name (optional)</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Tenant"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.75 }}>Password (min 8 chars)</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              type="password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}
            />
          </label>

          {err ? <div style={{ color: "crimson" }}>{err}</div> : null}
          {okMsg ? <div style={{ color: "green" }}>{okMsg}</div> : null}

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "black",
              color: "white",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Accepting..." : "Accept Invite"}
          </button>

          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Already have access? <Link to="/tenant/login">Tenant login</Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
