import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { initiateScreeningRequest, listScreeningRequests, uploadManualScreeningReport, type ScreeningRequestProjection } from "../../api/providerNeutralScreeningApi";
import { ScreeningStatus } from "../../components/ScreeningStatus";

export default function ScreeningRequestPage() {
  const { unitId = "" } = useParams();
  const [params] = useSearchParams();
  const [tenantId, setTenantId] = useState(params.get("tenantId") || "");
  const [consentId, setConsentId] = useState(params.get("consentId") || "");
  const [requests, setRequests] = useState<ScreeningRequestProjection[]>([]);
  const [selected, setSelected] = useState<ScreeningRequestProjection | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    if (!unitId) return;
    const data = await listScreeningRequests(unitId);
    setRequests(data.requests || []);
    setSelected(data.requests?.[0] || null);
  }

  useEffect(() => {
    void refresh().catch(() => setMessage("Unable to load screening requests."));
  }, [unitId]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const data = await initiateScreeningRequest({ unitId, tenantId, consentId });
    setMessage(`Screening request created: ${data.requestId}`);
    await refresh();
  }

  async function onManualReport(event: React.ChangeEvent<HTMLInputElement>, requestId: string) {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = await uploadManualScreeningReport({ unitId, requestId, file });
    setMessage(`Manual report uploaded: ${data.uploadedAt}`);
    await refresh();
  }

  return (
    <main style={pageStyle}>
      <section style={surfaceStyle}>
        <h1 style={titleStyle}>Screening request</h1>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={labelStyle}>
            Tenant reference
            <input value={tenantId} onChange={(event) => setTenantId(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Consent reference
            <input value={consentId} onChange={(event) => setConsentId(event.target.value)} style={inputStyle} />
          </label>
          <button type="submit" disabled={!unitId || !tenantId || !consentId} style={primaryButtonStyle}>
            Initiate screening
          </button>
        </form>
        {message && <p role="status" style={statusStyle}>{message}</p>}
      </section>

      <ScreeningStatus request={selected} />

      <section style={surfaceStyle}>
        <h2 style={sectionTitleStyle}>Requests for unit {unitId}</h2>
        {requests.length === 0 ? (
          <p style={mutedStyle}>No requests yet.</p>
        ) : (
          requests.map((request) => (
            <div key={request.requestId} style={itemStyle}>
              <button type="button" onClick={() => setSelected(request)} style={linkButtonStyle}>
                {request.requestId}
              </button>
              <span>{request.status}</span>
              <label style={uploadLabelStyle}>
                Manual report
                <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => onManualReport(event, request.requestId)} />
              </label>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = { padding: 24, display: "grid", gap: 16, maxWidth: 960, margin: "0 auto" };
const surfaceStyle: React.CSSProperties = { border: "1px solid #dbe3ef", borderRadius: 8, background: "#fff", padding: 18, display: "grid", gap: 12 };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 24, color: "#0f172a" };
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 18, color: "#0f172a" };
const mutedStyle: React.CSSProperties = { margin: 0, color: "#64748b", fontSize: 13 };
const statusStyle: React.CSSProperties = { margin: 0, color: "#047857", fontWeight: 700 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, color: "#334155", fontWeight: 700 };
const inputStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px" };
const primaryButtonStyle: React.CSSProperties = { justifySelf: "start", border: 0, borderRadius: 8, background: "#2563eb", color: "#fff", padding: "10px 14px", fontWeight: 800 };
const itemStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 12, alignItems: "center" };
const linkButtonStyle: React.CSSProperties = { border: 0, background: "transparent", color: "#1d4ed8", fontWeight: 800, textAlign: "left" };
const uploadLabelStyle: React.CSSProperties = { display: "grid", gap: 4, color: "#334155", fontSize: 12, fontWeight: 700 };
