import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchPublicExposureHardeningProfiles,
  type PublicExposureHardeningProfile,
  type PublicExposureHardeningStatus,
} from "@/api/publicExposureHardeningApi";
import { PublicExposureHardeningPanel } from "@/components/publicExposure/PublicExposureHardeningPanel";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<PublicExposureHardeningStatus | ""> = ["", "ready_for_review", "partially_ready", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function PublicExposureHardeningPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<PublicExposureHardeningProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const status = String(searchParams.get("status") || "") as PublicExposureHardeningStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchPublicExposureHardeningProfiles({ status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load public exposure hardening";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load public exposure hardening", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [status, showToast]);

  function updateStatus(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value.trim()) params.set("status", value.trim());
    else params.delete("status");
    setSearchParams(params);
  }

  return (
    <MacShell title="Public exposure hardening" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Public exposure hardening</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Public exposure hardening is operationally scoped and review controlled. No autonomous deployment, rollback, or public launch execution is enabled.
              Manual approval remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateStatus(event.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading public exposure hardening...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load public exposure hardening right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No public exposure hardening profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? (
          <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <PublicExposureHardeningPanel key={profile.publicExposureHardeningId} profile={profile} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
