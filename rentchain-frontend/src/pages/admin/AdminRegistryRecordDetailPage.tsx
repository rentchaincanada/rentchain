import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Input, Pill, Section } from "../../components/ui/Ui";
import { fetchAdminRegistryRecordDetail, overrideAdminRegistryRecord, type RegistryRecordDetail } from "../../api/adminRegistryApi";

export default function AdminRegistryRecordDetailPage() {
  const { normalizedRecordId } = useParams<{ normalizedRecordId: string }>();
  const [detail, setDetail] = useState<RegistryRecordDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [reason, setReason] = useState("Manual registry review");

  const load = async () => {
    if (!normalizedRecordId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdminRegistryRecordDetail(normalizedRecordId);
      setDetail(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load registry record");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [normalizedRecordId]);

  const handleOverride = async (action: "attach" | "ignore") => {
    if (!normalizedRecordId) return;
    try {
      setSaving(true);
      setError(null);
      await overrideAdminRegistryRecord({
        normalizedRecordId,
        action,
        propertyId: action === "attach" ? propertyId : null,
        reason,
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to apply registry override");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MacShell title="Admin · Registry Record">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Registry Record Detail</h1>
                {detail?.match ? <Pill tone={detail.match.matchStatus === "matched" ? "accent" : "muted"}>{detail.match.matchStatus}</Pill> : null}
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Review the raw Halifax row, normalized values, candidate properties, and audit trail before confirming a property link.
              </div>
            </div>
            <Link to="/admin/registry/review">
              <Button variant="secondary">Back to queue</Button>
            </Link>
          </div>
        </Section>

        {loading ? <Card>Loading registry record…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}
        {!loading && detail ? (
          <>
            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Normalized Registry Record</div>
              <div>Record ID: {detail.normalizedRecord?.registryRecordId}</div>
              <div>Address: {detail.normalizedRecord?.addressRaw || "--"}</div>
              <div>Status: {detail.normalizedRecord?.registrationStatusNormalized || "--"}</div>
              <div>Registration number: {detail.normalizedRecord?.registrationNumber || "--"}</div>
              <div>PID: {detail.normalizedRecord?.pid || "--"}</div>
            </Card>

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Manual Review Controls</div>
              <Input placeholder="Property ID for manual attach" value={propertyId} onChange={(event) => setPropertyId(event.target.value)} />
              <Input placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button onClick={() => void handleOverride("attach")} disabled={saving || !propertyId.trim() || !reason.trim()}>
                  {saving ? "Saving..." : "Attach to property"}
                </Button>
                <Button variant="secondary" onClick={() => void handleOverride("ignore")} disabled={saving || !reason.trim()}>
                  Ignore record
                </Button>
              </div>
            </Card>

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Candidate Properties</div>
              {!detail.candidates?.length ? <div style={{ color: "#475569" }}>No likely property candidates were found.</div> : null}
              {detail.candidates?.map((candidate) => (
                <div key={candidate.propertyId} style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>{candidate.propertyName || candidate.propertyId}</div>
                  <div style={{ color: "#475569", fontSize: 14 }}>{[candidate.addressLine1, candidate.city, candidate.province].filter(Boolean).join(", ")}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    Score: {candidate.score} · PID: {candidate.pid || "--"} · Units: {candidate.unitCount ?? "--"}
                  </div>
                </div>
              ))}
            </Card>

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Raw Source Fields</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>{JSON.stringify(detail.rawRecord?.sourcePayload || detail.rawRecord || {}, null, 2)}</pre>
            </Card>

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Audit Trail</div>
              {!detail.auditTrail?.length ? <div style={{ color: "#475569" }}>No audit events yet.</div> : null}
              {detail.auditTrail?.map((event) => (
                <div key={event.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.14)", paddingBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{event.eventType}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{event.createdAt}</div>
                </div>
              ))}
            </Card>
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
