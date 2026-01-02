import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clearTenantToken, getTenantToken } from "../../lib/tenantAuth";
import { tenantLedger, tenantLease, tenantMe, tenantPayments } from "../../api/tenantApi";
import { TenantReputationTimeline } from "../../components/tenant/TenantReputationTimeline";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
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
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function TenantDashboardPageV2() {
  const [me, setMe] = useState<any>(null);
  const [lease, setLease] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function logout() {
    clearTenantToken();
    window.location.href = "/tenant/login";
  }

  useEffect(() => {
    const token = getTenantToken();
    if (!token) {
      window.location.href = "/tenant/login";
      return;
    }

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const meRes = await tenantMe();
        if (!meRes.res.ok || !meRes.data?.ok) throw new Error(meRes.data?.error || "Failed to load profile");
        setMe(meRes.data.tenant || meRes.data.user || meRes.data.me || null);

        const leaseRes = await tenantLease();
        if (leaseRes.res.ok && leaseRes.data?.ok) setLease(leaseRes.data.lease || leaseRes.data.item || leaseRes.data.data || null);

        const payRes = await tenantPayments();
        if (payRes.res.ok && payRes.data?.ok) setPayments(payRes.data.items || payRes.data.payments || []);

        const ledRes = await tenantLedger();
        if (ledRes.res.ok && ledRes.data?.ok) setLedger(ledRes.data.items || ledRes.data.ledger || []);
      } catch (e: any) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 980, margin: "48px auto", padding: 16, opacity: 0.75 }}>
        Loading tenant portal…
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ maxWidth: 640, margin: "48px auto", padding: 16 }}>
        <Card title="Tenant Portal">
          <div style={{ color: "crimson" }}>{err}</div>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={logout}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "black",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Return to login
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "48px auto", padding: 16, display: "grid", gap: 16 }}>
      <Card title="Welcome">
        <div style={{ display: "grid", gap: 6 }}>
          <div><b>Name:</b> {me?.fullName || "-"}</div>
          <div><b>Email:</b> {me?.email || "-"}</div>
          <div><b>Status:</b> {me?.status || "active"}</div>
          <div style={{ marginTop: 8 }}>
            <button
              onClick={logout}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "#f3f4f6",
                color: "#111",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </Card>

      <Card title="Lease Summary">
        {lease ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div><b>Property:</b> {lease.property || lease.propertyId || "-"}</div>
            <div><b>Unit:</b> {lease.unit || lease.unitId || "-"}</div>
            <div><b>Status:</b> {lease.status || "active"}</div>
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>No lease data yet.</div>
        )}
      </Card>

      <Card title="Payments">
        {payments?.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {payments.map((p: any, idx: number) => (
              <li key={p.id || idx}>
                {p.date || p.createdAt || "-"} — {p.amount || p.value || "-"} — {p.status || "-"}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ opacity: 0.75 }}>No payments yet.</div>
        )}
      </Card>

      <Card title="Ledger">
        {ledger?.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {ledger.map((e: any, idx: number) => (
              <li key={e.id || idx}>
                {e.type || e.eventType || "-"} — {e.createdAt || e.occurredAt || "-"}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ opacity: 0.75 }}>No ledger entries yet.</div>
        )}
      </Card>

      <TenantReputationTimeline />

      <div style={{ fontSize: 13, opacity: 0.7 }}>
        Need help? <Link to="mailto:hello@rentchain.ai">Contact support</Link>
      </div>
    </div>
  );
}
