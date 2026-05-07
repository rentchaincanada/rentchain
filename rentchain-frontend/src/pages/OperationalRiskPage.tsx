import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchOperationalRiskProfiles,
  type OperationalRiskProfile,
  type OperationalRiskScope,
  type OperationalRiskSeverity,
  type OperationalRiskStatus,
} from "@/api/operationalRiskApi";
import { MacShell } from "@/components/layout/MacShell";
import { OperationalRiskPanel } from "@/components/risk/OperationalRiskPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const riskScopes: Array<OperationalRiskScope | ""> = ["", "property", "lease", "participant", "institution", "workflow", "onboarding", "settlement", "regulatory"];
const statuses: Array<OperationalRiskStatus | ""> = ["", "stable", "attention_required", "elevated", "blocked", "unknown"];
const severities: Array<OperationalRiskSeverity | ""> = ["", "low", "moderate", "elevated", "critical"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function OperationalRiskPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<OperationalRiskProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const riskScope = String(searchParams.get("riskScope") || "") as OperationalRiskScope | "";
  const status = String(searchParams.get("status") || "") as OperationalRiskStatus | "";
  const severity = String(searchParams.get("severity") || "") as OperationalRiskSeverity | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchOperationalRiskProfiles({ riskScope, status, severity });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load operational risk";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load operational risk", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [riskScope, status, severity, showToast]);

  function updateParams(next: { riskScope?: string; status?: string; severity?: string }) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Operational risk" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Operational risk</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Operational risk visibility is operationally scoped and review controlled. No underwriting, autonomous enforcement, or public risk exposure is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Risk scope
            <select value={riskScope} onChange={(event) => updateParams({ riskScope: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {riskScopes.map((scope) => <option key={scope || "all"} value={scope}>{label(scope)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Severity
            <select value={severity} onChange={(event) => updateParams({ severity: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {severities.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading operational risk...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load operational risk right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No operational risk profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? (
          <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <OperationalRiskPanel key={profile.operationalRiskId} profile={profile} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
