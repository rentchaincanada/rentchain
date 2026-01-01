import React, { useState } from "react";
import { joinWaitlist } from "../api/public";

export default function ComingSoonPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const r = await joinWaitlist({ email, name: name || undefined });
      if (!r?.ok) {
        throw new Error("waitlist_failed");
      }
      setStatus({
        ok: true,
        msg: r.emailed
          ? "✅ Check your inbox — you're on the waitlist."
          : "✅ You're on the waitlist. Email may take a moment.",
      });
      setEmail("");
      setName("");
    } catch (_err: any) {
      setStatus({
        ok: false,
        msg: "❌ Waitlist failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          borderRadius: 18,
          padding: 28,
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ fontSize: 38, margin: 0 }}>RentChain.ai</h1>
            <p style={{ marginTop: 8, opacity: 0.85, fontSize: 16 }}>
              Rental ledger, receipts, and compliance — with AI insights rolling out.
            </p>
          </div>
          <a href="/login" style={{ alignSelf: "center", textDecoration: "none" }}>
            <button style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}>
              Landlord Login
            </button>
          </a>
        </div>

        <div style={{ marginTop: 18, opacity: 0.9 }}>
          <ul>
            <li>Unified rent ledger + receipts</li>
            <li>Portfolio KPIs and audit trail</li>
            <li>Automation and tenant tools coming soon</li>
          </ul>
        </div>

        <div style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 8 }}>Get early access</h3>
          <form
            onSubmit={onSubmit}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              style={{ padding: 12, borderRadius: 10 }}
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              required
              style={{ padding: 12, borderRadius: 10 }}
            />
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <button
                disabled={loading}
                type="submit"
                style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
              >
                {loading ? "Submitting…" : "Join Waitlist"}
              </button>
              <span style={{ opacity: 0.7, fontSize: 12 }}>
                By joining, you agree to receive product updates. Unsubscribe anytime.
              </span>
            </div>
          </form>

          {status && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 10,
                background: status.ok
                  ? "rgba(0,200,120,0.12)"
                  : "rgba(220,60,60,0.12)",
              }}
            >
              {status.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
