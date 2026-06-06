import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getScreeningRequest, getScreeningResult, recordScreeningDecision, type ScreeningRequestProjection, type ScreeningResultProjection } from "../../api/providerNeutralScreeningApi";
import { ScreeningStatus } from "../../components/ScreeningStatus";

export default function ScreeningDecisionPage() {
  const { unitId = "", requestId = "" } = useParams();
  const [request, setRequest] = useState<ScreeningRequestProjection | null>(null);
  const [result, setResult] = useState<ScreeningResultProjection | null>(null);
  const [decision, setDecision] = useState<"approve" | "deny" | "review_needed">("review_needed");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    if (!unitId || !requestId) return;
    const requestData = await getScreeningRequest(unitId, requestId);
    setRequest(requestData.request);
    const resultData = await getScreeningResult(unitId, requestId);
    setResult(resultData?.result || null);
  }

  useEffect(() => {
    void refresh().catch(() => setMessage("Unable to load screening decision context."));
  }, [unitId, requestId]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const data = await recordScreeningDecision({ unitId, requestId, decision, reason, notes });
    setMessage(`Decision recorded: ${data.decisionStatus}`);
    await refresh();
  }

  return (
    <main style={pageStyle}>
      <ScreeningStatus request={request} />
      <section style={surfaceStyle}>
        <h1 style={titleStyle}>Screening decision</h1>
        <div style={resultStyle}>
          <strong>Result summary</strong>
          <span>{result?.summary || "No result summary available."}</span>
          <span>Risk score: {result?.riskScore ?? "Not available"}</span>
          <span>Recommendation: {result?.decisionRecommendation || "Not available"}</span>
        </div>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <fieldset style={fieldsetStyle}>
            <legend style={{ fontWeight: 800 }}>Decision</legend>
            <label><input type="radio" checked={decision === "approve"} onChange={() => setDecision("approve")} /> Approve</label>
            <label><input type="radio" checked={decision === "deny"} onChange={() => setDecision("deny")} /> Deny</label>
            <label><input type="radio" checked={decision === "review_needed"} onChange={() => setDecision("review_needed")} /> Review needed</label>
          </fieldset>
          <label style={labelStyle}>
            Reason
            <input value={reason} onChange={(event) => setReason(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...inputStyle, minHeight: 100 }} />
          </label>
          <button type="submit" disabled={!reason.trim()} style={primaryButtonStyle}>Record decision</button>
        </form>
        {message && <p role="status" style={statusStyle}>{message}</p>}
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = { padding: 24, display: "grid", gap: 16, maxWidth: 960, margin: "0 auto" };
const surfaceStyle: React.CSSProperties = { border: "1px solid #dbe3ef", borderRadius: 8, background: "#fff", padding: 18, display: "grid", gap: 12 };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 24, color: "#0f172a" };
const resultStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "grid", gap: 6, color: "#475569" };
const fieldsetStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "grid", gap: 8 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, color: "#334155", fontWeight: 700 };
const inputStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px" };
const primaryButtonStyle: React.CSSProperties = { justifySelf: "start", border: 0, borderRadius: 8, background: "#2563eb", color: "#fff", padding: "10px 14px", fontWeight: 800 };
const statusStyle: React.CSSProperties = { margin: 0, color: "#047857", fontWeight: 700 };
