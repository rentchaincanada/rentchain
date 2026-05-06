import React from "react";
import { useSearchParams } from "react-router-dom";
import { fetchRegulatoryProfiles, type RegulatoryProfile, type RegulatoryProfileStatus } from "@/api/regulatoryProfileApi";
import { MacShell } from "@/components/layout/MacShell";
import { RegulatoryProfilePanel } from "@/components/regulatory/RegulatoryProfilePanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<RegulatoryProfileStatus | ""> = ["", "ready_for_review", "partially_ready", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function RegulatoryProfilePage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<RegulatoryProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const province = String(searchParams.get("province") || "").trim();
  const municipality = String(searchParams.get("municipality") || "").trim();
  const status = String(searchParams.get("status") || "") as RegulatoryProfileStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchRegulatoryProfiles({ country: "CA", province: province || undefined, municipality: municipality || undefined, status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load regulatory profiles";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load regulatory profiles", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [province, municipality, status, showToast]);

  function updateParams(next: { province?: string; municipality?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Regulatory profiles" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Regulatory profiles</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Regulatory profiles are operational readiness references only. No legal certification or regulator submission is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Province
            <input value={province} onChange={(event) => updateParams({ province: event.target.value })} placeholder="NS" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 160 }} />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Municipality
            <input value={municipality} onChange={(event) => updateParams({ municipality: event.target.value })} placeholder="Halifax" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }} />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading regulatory profiles...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load regulatory profiles right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No regulatory profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <RegulatoryProfilePanel key={profile.regulatoryProfileId} profile={profile} />)}</div> : null}
      </div>
    </MacShell>
  );
}
