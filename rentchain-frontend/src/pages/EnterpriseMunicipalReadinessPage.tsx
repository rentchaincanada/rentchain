import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchEnterpriseMunicipalReadinessProfiles,
  type EnterpriseMunicipalOrganizationType,
  type EnterpriseMunicipalReadinessProfile,
  type EnterpriseMunicipalReadinessStatus,
} from "@/api/enterpriseMunicipalReadinessApi";
import { EnterpriseMunicipalReadinessPanel } from "@/components/enterprise/EnterpriseMunicipalReadinessPanel";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const organizationTypes: Array<EnterpriseMunicipalOrganizationType | ""> = ["", "municipality", "affordable_housing_operator", "institutional_landlord", "enterprise_operator", "government_program"];
const statuses: Array<EnterpriseMunicipalReadinessStatus | ""> = ["", "ready_for_review", "partially_ready", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function EnterpriseMunicipalReadinessPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<EnterpriseMunicipalReadinessProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const organizationType = String(searchParams.get("organizationType") || "") as EnterpriseMunicipalOrganizationType | "";
  const status = String(searchParams.get("status") || "") as EnterpriseMunicipalReadinessStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchEnterpriseMunicipalReadinessProfiles({ organizationType, status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load enterprise readiness";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load enterprise readiness", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [organizationType, status, showToast]);

  function updateParam(key: "organizationType" | "status", value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value.trim()) params.set(key, value.trim());
    else params.delete(key);
    setSearchParams(params);
  }

  return (
    <MacShell title="Enterprise and municipal readiness">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Enterprise and municipal readiness</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Enterprise and municipal readiness is operationally scoped and review controlled. No autonomous government or enterprise execution is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Organization type
            <select value={organizationType} onChange={(event) => updateParam("organizationType", event.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 220 }}>
              {organizationTypes.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParam("status", event.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading enterprise readiness...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load enterprise readiness right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No enterprise readiness profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? (
          <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <EnterpriseMunicipalReadinessPanel key={profile.enterpriseMunicipalReadinessId} profile={profile} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
