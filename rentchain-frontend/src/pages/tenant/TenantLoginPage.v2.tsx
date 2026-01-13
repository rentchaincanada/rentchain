import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setTenantToken } from "../../lib/tenantAuth";
import { DEBUG_AUTH_KEY, JUST_LOGGED_IN_KEY } from "../../lib/authKeys";

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

const TenantLoginPageV2: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/tenant/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Login failed");

      const jwt = data?.token || data?.jwt || data?.tenantToken;
      if (!jwt) throw new Error("Login succeeded but token missing");
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
        if (import.meta.env.DEV || dbg) console.log("[tenant-login] stored token lengths", { sLen, lLen });
      }

      await Promise.resolve(); // allow storage flush on iOS before navigation
      await new Promise((resolve) => setTimeout(resolve, 150));
      navigate("/tenant", { replace: true });
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "48px auto", padding: 16 }}>
      <Card>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Tenant Login</h1>
        <p style={{ marginTop: 8, opacity: 0.75 }}>Sign in to view your lease, payments, and ledger.</p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.75 }}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenant@email.com"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.75 }}>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}
            />
          </label>

          {err ? <div style={{ color: "crimson" }}>{err}</div> : null}

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
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Have an invite link? Open it to accept your invite.{" "}
            <Link to="/">Back to main</Link>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default TenantLoginPageV2;
