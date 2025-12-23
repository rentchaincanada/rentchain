import React, { useEffect, useState } from "react";
import {
  getTenantReportingConsent,
  grantTenantReportingConsent,
  revokeTenantReportingConsent,
} from "../../api/reportingConsentApi";
import { useTenantOutletContext } from "./TenantLayout";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

const cardStyle: React.CSSProperties = {
  background: "rgba(17,24,39,0.85)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16,
  padding: "18px 20px",
  color: "#e5e7eb",
  boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
};

export const ReportingConsentPage: React.FC = () => {
  const { profile } = useTenantOutletContext();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const landlordId = searchParams.get("landlordId") || user?.landlordId || "";

  useEffect(() => {
    getTenantReportingConsent()
      .then((res) => setStatus(res.status))
      .catch((err) => setError(err?.message || "Failed to load consent"));
  }, []);

  const badge = (() => {
    const map: Record<string, { bg: string; color: string }> = {
      pending: { bg: "rgba(234,179,8,0.18)", color: "#fef08a" },
      granted: { bg: "rgba(34,197,94,0.16)", color: "#bbf7d0" },
      revoked: { bg: "rgba(248,113,113,0.18)", color: "#fecaca" },
    };
    return map[status] || map.pending;
  })();

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.08, color: "#9ca3af" }}>
            Reporting Consent
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Credit reporting permission</div>
        </div>
        <span
          style={{
            padding: "6px 10px",
            borderRadius: 12,
            background: badge.bg,
            color: badge.color,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {status}
        </span>
      </div>
      <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 14, lineHeight: 1.5 }}>
        Your landlord is requesting consent to share your rental payment history for credit reporting.
        Data shared: rent charges, payment dates, and late indicators. No credit score is shown here.
      </div>
      {!landlordId ? (
        <div style={{ marginTop: 10, color: "#fca5a5" }}>Missing landlord context.</div>
      ) : null}
      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={async () => {
            if (!landlordId) return;
            try {
              await grantTenantReportingConsent(landlordId);
              setStatus("granted");
              setError(null);
            } catch (err: any) {
              setError(err?.message || "Failed to grant consent");
            }
          }}
          disabled={!landlordId}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(59,130,246,0.35)",
            background: "rgba(59,130,246,0.12)",
            color: "#bfdbfe",
            fontWeight: 700,
            cursor: !landlordId ? "not-allowed" : "pointer",
          }}
        >
          Grant consent
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!landlordId) return;
            try {
              await revokeTenantReportingConsent(landlordId);
              setStatus("revoked");
              setError(null);
            } catch (err: any) {
              setError(err?.message || "Failed to revoke consent");
            }
          }}
          disabled={!landlordId}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(248,113,113,0.35)",
            background: "rgba(248,113,113,0.12)",
            color: "#fecaca",
            fontWeight: 700,
            cursor: !landlordId ? "not-allowed" : "pointer",
          }}
        >
          Revoke consent
        </button>
      </div>
      {error ? <div style={{ marginTop: 8, color: "#fca5a5" }}>{error}</div> : null}
    </div>
  );
};

export default ReportingConsentPage;
