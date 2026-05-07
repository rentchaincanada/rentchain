import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchCommercialReadinessProfiles,
  type CommercialReadinessProfile,
  type CommercialReadinessStatus,
} from "@/api/commercialReadinessApi";
import { CommercialReadinessPanel } from "@/components/commercial/CommercialReadinessPanel";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<CommercialReadinessStatus | ""> = ["", "ready_for_review", "partially_ready", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function CommercialReadinessPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<CommercialReadinessProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const status = String(searchParams.get("status") || "") as CommercialReadinessStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchCommercialReadinessProfiles({ status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load commercial readiness";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load commercial readiness", description: message, variant: "error" });
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
    <MacShell title="Commercial readiness" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Commercial readiness</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Commercial readiness is operationally scoped and review controlled. No autonomous billing, charging, or commercialization execution is enabled.
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

        {loading ? <Card>Loading commercial readiness...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load commercial readiness right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No commercial readiness profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? (
          <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <CommercialReadinessPanel key={profile.commercialReadinessId} profile={profile} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
