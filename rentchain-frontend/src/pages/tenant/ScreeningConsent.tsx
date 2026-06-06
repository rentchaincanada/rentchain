import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { grantScreeningConsent, listScreeningConsents, revokeScreeningConsent, type ScreeningConsentProjection } from "../../api/providerNeutralScreeningApi";
import { useAuth } from "../../context/useAuth";

export default function ScreeningConsentPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const tenantId = user?.tenantId || user?.id || params.get("tenantId") || "";
  const landlordId = params.get("landlordId") || "";
  const unitId = params.get("unitId") || "";
  const [consents, setConsents] = useState<ScreeningConsentProjection[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    if (!tenantId) return;
    const data = await listScreeningConsents(tenantId);
    setConsents(data.consents || []);
  }

  useEffect(() => {
    void refresh().catch(() => setMessage("Unable to load screening consents."));
  }, [tenantId]);

  async function onGrant() {
    setMessage("");
    const data = await grantScreeningConsent({ tenantId, landlordId, unitId });
    setMessage(`Consent granted: ${data.consent.consentId}`);
    await refresh();
  }

  async function onRevoke(consentId: string) {
    setMessage("");
    await revokeScreeningConsent(tenantId, consentId);
    setMessage("Consent revoked.");
    await refresh();
  }

  const canGrant = Boolean(tenantId && landlordId && unitId);

  return (
    <main style={pageStyle}>
      <section style={surfaceStyle}>
        <h1 style={titleStyle}>Screening consent</h1>
        <p style={copyStyle}>
          Grant consent only when you authorize a landlord to start a screening workflow for the selected unit. Consent can be revoked before a request is initiated.
        </p>
        <button type="button" onClick={onGrant} disabled={!canGrant} style={primaryButtonStyle}>
          Grant consent
        </button>
        {!canGrant && <p style={mutedStyle}>A tenant, landlord, and unit reference are required.</p>}
        {message && <p role="status" style={statusStyle}>{message}</p>}
      </section>

      <section style={surfaceStyle}>
        <h2 style={sectionTitleStyle}>Active consents</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {consents.length === 0 ? (
            <p style={mutedStyle}>No active consents.</p>
          ) : (
            consents.map((consent) => (
              <div key={consent.consentId} style={itemStyle}>
                <div>
                  <strong>{consent.unitId}</strong>
                  <div style={mutedStyle}>Granted {consent.grantedAt}</div>
                </div>
                <button type="button" onClick={() => onRevoke(consent.consentId)} style={secondaryButtonStyle}>
                  Revoke
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = { padding: 24, display: "grid", gap: 16, maxWidth: 880, margin: "0 auto" };
const surfaceStyle: React.CSSProperties = { border: "1px solid #dbe3ef", borderRadius: 8, background: "#fff", padding: 18, display: "grid", gap: 12 };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 24, color: "#0f172a" };
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 18, color: "#0f172a" };
const copyStyle: React.CSSProperties = { margin: 0, color: "#475569", lineHeight: 1.6 };
const mutedStyle: React.CSSProperties = { margin: 0, color: "#64748b", fontSize: 13 };
const statusStyle: React.CSSProperties = { margin: 0, color: "#047857", fontWeight: 700 };
const itemStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" };
const primaryButtonStyle: React.CSSProperties = { justifySelf: "start", border: 0, borderRadius: 8, background: "#2563eb", color: "#fff", padding: "10px 14px", fontWeight: 800 };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#0f172a", padding: "8px 12px", fontWeight: 700 };
