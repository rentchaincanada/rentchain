import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { fetchAdminRegistryReview, type RegistryReviewItem } from "../../api/adminRegistryApi";

export default function AdminRegistryReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const matchStatus = searchParams.get("matchStatus") || "all";
  const [items, setItems] = useState<RegistryReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchAdminRegistryReview(matchStatus);
        if (!active) return;
        setItems(result);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load registry review queue");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [matchStatus]);

  return (
    <MacShell title="Admin · Registry Review">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Registry Review Queue</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Review unmatched, fuzzy, and mismatched Halifax rows before landlord-facing status is trusted.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to="/admin/registry/imports">
                <Button variant="secondary">Back to imports</Button>
              </Link>
              {["all", "possible_match", "mismatch", "unmatched", "matched", "ignored"].map((status) => (
                <Button key={status} variant={matchStatus === status ? "primary" : "secondary"} onClick={() => setSearchParams(status === "all" ? {} : { matchStatus: status })}>
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </Section>

        <Card style={{ display: "grid", gap: 12 }}>
          {!loading && items.length ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill tone="muted">Visible items: {items.length}</Pill>
              <Pill tone="muted">Filter: {matchStatus}</Pill>
              {matchStatus === "ignored" ? <Pill tone="muted">Ignored items can be returned to review from record detail.</Pill> : null}
            </div>
          ) : null}
          {loading ? <div>Loading registry review queue…</div> : null}
          {!loading && error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
          {!loading && !items.length ? <div style={{ color: "#475569" }}>No registry records match this review state.</div> : null}
          {items.map((item) => (
            <div key={item.match.id} style={{ border: "1px solid rgba(148,163,184,0.18)", borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.normalizedRecord?.addressRaw || item.match.registryRecordId}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{item.normalizedRecord?.registrationNumber || item.match.registryRecordId}</div>
                </div>
                <Pill tone={item.match.matchStatus === "matched" ? "accent" : "muted"}>{item.match.matchStatus}</Pill>
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>
                Method: {item.match.matchMethod || "--"} · Score: {item.match.matchScore || 0}
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>
                Property: {item.property?.name || item.property?.addressLine1 || item.match.propertyId || "--"}
              </div>
              {item.reasonSummary?.length ? (
                <div style={{ color: "#92400e", fontSize: 14 }}>
                  Review notes: {item.reasonSummary.join(" ")}
                </div>
              ) : null}
              {!item.property && item.topCandidate ? (
                <div style={{ color: "#475569", fontSize: 14 }}>
                  Top candidate: {item.topCandidate.propertyName || item.topCandidate.addressLine1 || item.topCandidate.propertyId} · Score:{" "}
                  {item.topCandidate.score}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link to={`/admin/registry/records/${encodeURIComponent(item.match.normalizedRecordId)}`}>
                  <Button variant="secondary">Open record</Button>
                </Link>
                {item.match.propertyId ? (
                  <Link to={`/admin/registry/properties/${encodeURIComponent(item.match.propertyId)}`}>
                    <Button variant="secondary">Open property review</Button>
                  </Link>
                ) : item.topCandidate ? (
                  <Link
                    to={`/admin/registry/properties/${encodeURIComponent(item.topCandidate.propertyId)}?normalizedRecordId=${encodeURIComponent(
                      item.match.normalizedRecordId
                    )}`}
                  >
                    <Button variant="secondary">Open candidate review</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </MacShell>
  );
}
