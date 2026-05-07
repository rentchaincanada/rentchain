import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchTenantParticipationProfiles,
  type TenantParticipationProfile,
  type TenantParticipationStatus,
} from "@/api/tenantParticipationApi";
import { MacShell } from "@/components/layout/MacShell";
import { TenantParticipationPanel } from "@/components/participation/TenantParticipationPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<TenantParticipationStatus | ""> = ["", "verified", "partially_verified", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function TenantParticipationPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<TenantParticipationProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const status = String(searchParams.get("status") || "") as TenantParticipationStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchTenantParticipationProfiles({ status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load tenant participation";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load tenant participation", description: message, variant: "error" });
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
    <MacShell title="Tenant participation" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Tenant participation</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Participation references are operationally scoped and review controlled. No public tenant scoring or autonomous incentives are enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateStatus(event.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => (
                <option key={item || "all"} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading tenant participation...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load tenant participation right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No tenant participation profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? (
          <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <TenantParticipationPanel key={profile.tenantParticipationId} profile={profile} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
