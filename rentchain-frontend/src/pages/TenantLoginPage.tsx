import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { tenantLogin } from "../api/tenantAuthApi";
import { setAuthToken } from "../lib/apiClient";

const TenantLoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") || "/tenant/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await tenantLogin(email, password);
      if (res?.token) {
        setAuthToken(res.token);
        navigate(returnTo, { replace: true });
      } else {
        setError("Invalid response from server");
      }
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at top left, #111827 0, #020617 45%, #000000 100%)",
        color: "#e5e7eb",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "rgba(17,24,39,0.8)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "24px 28px",
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Tenant Login</div>
        <label style={{ display: "block", fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(0,0,0,0.2)",
            color: "#e5e7eb",
            marginBottom: 12,
          }}
        />
        <label style={{ display: "block", fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(0,0,0,0.2)",
            color: "#e5e7eb",
            marginBottom: 16,
          }}
        />
        {error ? (
          <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>{error}</div>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(59,130,246,0.35)",
            background: "rgba(59,130,246,0.12)",
            color: "#bfdbfe",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
};

export default TenantLoginPage;
