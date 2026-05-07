import React from "react";
import { useSearchParams } from "react-router-dom";
import { fetchReleaseGovernanceProfiles, type ReleaseGovernanceProfile, type ReleaseGovernanceStatus } from "@/api/releaseGovernanceApi";
import { ReleaseGovernancePanel } from "@/components/releaseGovernance/ReleaseGovernancePanel";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<ReleaseGovernanceStatus | ""> = ["", "ready_for_review", "partially_ready", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function ReleaseGovernancePage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<ReleaseGovernanceProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const releaseVersion = String(searchParams.get("releaseVersion") || "v0.9.0-core-foundation");
  const status = String(searchParams.get("status") || "") as ReleaseGovernanceStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchReleaseGovernanceProfiles({ releaseVersion, status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load release governance";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load release governance", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [releaseVersion, status, showToast]);

  function updateParams(next: { releaseVersion?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Release governance" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Release governance</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Release governance is operationally scoped and review controlled. No autonomous deployment, rollback, or public launch execution is enabled.
              Manual approval remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Release version
            <input value={releaseVersion} onChange={(event) => updateParams({ releaseVersion: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 260 }} />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading release governance...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load release governance right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No release governance profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? (
          <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <ReleaseGovernancePanel key={profile.releaseGovernanceId} profile={profile} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
