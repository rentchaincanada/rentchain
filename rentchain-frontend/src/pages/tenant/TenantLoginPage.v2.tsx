import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch } from "../../api/apiFetch";

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
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const next = useMemo(() => {
    const raw = new URLSearchParams(location.search).get("next") ?? "";
    return raw.startsWith("/tenant") ? raw : "/tenant";
  }, [location.search]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSending(true);
    setSent(false);
    try {
      await apiFetch("/tenant/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), next }),
        headers: { "Content-Type": "application/json" },
      });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Couldn’t send link. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "48px auto", padding: 16 }}>
      <Card>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Tenant login</h1>
        <p style={{ marginTop: 8, opacity: 0.75 }}>We’ll email you a one-time login link.</p>

        {!sent ? (
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

            {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

            <button
              type="submit"
              disabled={isSending || !email.trim()}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "black",
                color: "white",
                fontWeight: 700,
                cursor: isSending || !email.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isSending ? "Sending…" : "Email me a login link"}
            </button>

            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Have an invite link? Open it to accept your invite. <Link to="/">Back to main</Link>
            </div>
          </form>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div style={{ color: "green", fontWeight: 700 }}>
              If an account exists for that email, we sent a login link.
            </div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Check your spam/junk folder.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={next || "/tenant"}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "#f3f4f6",
                  color: "#111",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Back
              </a>
              <button
                type="button"
                onClick={() => setSent(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  color: "#111",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Resend
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TenantLoginPageV2;
