import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { fetchAdminPropertyRegistryReview, reEvaluateAdminPropertyRegistry, type AdminPropertyRegistryReview } from "../../api/adminRegistryApi";

export default function AdminRegistryPropertyReviewPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [detail, setDetail] = useState<AdminPropertyRegistryReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!propertyId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdminPropertyRegistryReview(propertyId);
      setDetail(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load property registry review");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [propertyId]);

  const handleReEvaluate = async () => {
    if (!propertyId) return;
    try {
      setReEvaluating(true);
      await reEvaluateAdminPropertyRegistry(propertyId);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to re-evaluate property registry status");
    } finally {
      setReEvaluating(false);
    }
  };

  return (
    <MacShell title="Admin · Property Registry Review">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Property Registry Review</h1>
                {detail?.projection ? <Pill tone="accent">{detail.projection.registryStatus}</Pill> : null}
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Inspect the current projected landlord-facing status and re-run evaluation when property details change.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button onClick={handleReEvaluate} disabled={reEvaluating}>
                {reEvaluating ? "Re-evaluating..." : "Re-evaluate"}
              </Button>
              <Link to="/admin/registry/review">
                <Button variant="secondary">Back to queue</Button>
              </Link>
            </div>
          </div>
        </Section>

        {loading ? <Card>Loading property review…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}
        {!loading && detail ? (
          <>
            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{detail.property?.name || detail.property?.addressLine1 || detail.property?.id}</div>
              <div style={{ color: "#475569" }}>
                {[detail.property?.addressLine1, detail.property?.city, detail.property?.province, detail.property?.postalCode].filter(Boolean).join(", ")}
              </div>
              <div style={{ color: "#475569" }}>Projected summary: {detail.projection?.summary || "--"}</div>
              <div style={{ color: "#475569" }}>Recommended action: {detail.projection?.recommendedAction || "--"}</div>
            </Card>

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Matched Registry Records</div>
              {!detail.matches?.length ? <div style={{ color: "#475569" }}>No registry matches are currently linked to this property.</div> : null}
              {detail.matches?.map((match) => (
                <div key={match.id} style={{ border: "1px solid rgba(148,163,184,0.18)", borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{match.registryRecordId}</div>
                    <Pill tone={match.matchStatus === "matched" ? "accent" : "muted"}>{match.matchStatus}</Pill>
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Method: {match.matchMethod || "--"} · Score: {match.matchScore}
                  </div>
                  {match.normalizedRecordId ? (
                    <Link to={`/admin/registry/records/${encodeURIComponent(match.normalizedRecordId)}`}>
                      <Button variant="secondary">Open record</Button>
                    </Link>
                  ) : null}
                </div>
              ))}
            </Card>
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
