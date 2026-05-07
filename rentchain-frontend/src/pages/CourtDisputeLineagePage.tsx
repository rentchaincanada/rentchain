import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchCourtDisputeLineageProfiles,
  type CourtDisputeLineageProfile,
  type CourtDisputeLineageStatus,
} from "@/api/courtDisputeLineageApi";
import { MacShell } from "@/components/layout/MacShell";
import { CourtDisputeLineagePanel } from "@/components/disputes/CourtDisputeLineagePanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<CourtDisputeLineageStatus | ""> = ["", "verified", "partially_verified", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function CourtDisputeLineagePage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<CourtDisputeLineageProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const tenantId = String(searchParams.get("tenantId") || "").trim();
  const disputeId = String(searchParams.get("disputeId") || "").trim();
  const status = String(searchParams.get("status") || "") as CourtDisputeLineageStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchCourtDisputeLineageProfiles({ tenantId: tenantId || undefined, disputeId: disputeId || undefined, status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load court and dispute lineage";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load court and dispute lineage", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tenantId, disputeId, status, showToast]);

  function updateParams(next: { tenantId?: string; disputeId?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.tenantId !== undefined) {
      if (next.tenantId.trim()) params.set("tenantId", next.tenantId.trim());
      else params.delete("tenantId");
    }
    if (next.disputeId !== undefined) {
      if (next.disputeId.trim()) params.set("disputeId", next.disputeId.trim());
      else params.delete("disputeId");
    }
    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status);
      else params.delete("status");
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Court and dispute lineage" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Court and dispute lineage</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Court and dispute lineage is operationally scoped and review controlled. No legal filing, collections execution, bureau reporting, or public court-record exposure is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Tenant reference
            <input
              value={tenantId}
              onChange={(event) => updateParams({ tenantId: event.target.value })}
              placeholder="Optional tenant reference"
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 220 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Dispute reference
            <input
              value={disputeId}
              onChange={(event) => updateParams({ disputeId: event.target.value })}
              placeholder="Optional dispute reference"
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 220 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading court and dispute lineage...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load court and dispute lineage right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No court and dispute lineage profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? (
          <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <CourtDisputeLineagePanel key={profile.courtDisputeLineageId} profile={profile} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
