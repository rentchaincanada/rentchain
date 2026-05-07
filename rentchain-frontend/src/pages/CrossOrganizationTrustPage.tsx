import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchCrossOrganizationTrustRelationships,
  type CrossOrganizationTrustRelationship,
  type CrossOrganizationTrustRelationshipType,
  type CrossOrganizationTrustStatus,
} from "@/api/crossOrganizationTrustApi";
import { MacShell } from "@/components/layout/MacShell";
import { CrossOrganizationTrustPanel } from "@/components/trust/CrossOrganizationTrustPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const relationshipTypes: Array<CrossOrganizationTrustRelationshipType | ""> = [
  "",
  "operational_trust",
  "evidence_trust",
  "review_trust",
  "settlement_trust",
  "regulatory_trust",
  "sharing_trust",
];
const statuses: Array<CrossOrganizationTrustStatus | ""> = ["", "verified", "partially_verified", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function CrossOrganizationTrustPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trustRelationships, setTrustRelationships] = React.useState<CrossOrganizationTrustRelationship[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const relationshipType = String(searchParams.get("relationshipType") || "") as CrossOrganizationTrustRelationshipType | "";
  const status = String(searchParams.get("status") || "") as CrossOrganizationTrustStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchCrossOrganizationTrustRelationships({ relationshipType, status });
        if (mounted) setTrustRelationships(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load cross-organization trust";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load cross-organization trust", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [relationshipType, status, showToast]);

  function updateParams(next: { relationshipType?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Cross-organization trust" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Cross-organization trust</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Trust relationships are operationally scoped and review controlled. No public trust exposure or autonomous trust approval is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Relationship type
            <select value={relationshipType} onChange={(event) => updateParams({ relationshipType: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 190 }}>
              {relationshipTypes.map((type) => <option key={type || "all"} value={type}>{label(type)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading cross-organization trust...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load cross-organization trust right now.</Card> : null}
        {!loading && !error && !trustRelationships.length ? <Card style={{ color: "#64748b" }}>No cross-organization trust relationships match these filters.</Card> : null}
        {!loading && !error && trustRelationships.length ? (
          <div style={{ display: "grid", gap: 16 }}>{trustRelationships.map((trustRelationship) => <CrossOrganizationTrustPanel key={trustRelationship.trustRelationshipId} trustRelationship={trustRelationship} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
