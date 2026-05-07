import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchControlledIntegrationProfiles,
  type ControlledIntegrationProfile,
  type ControlledIntegrationStatus,
  type ControlledIntegrationType,
} from "@/api/controlledIntegrationsApi";
import { ControlledIntegrationsPanel } from "@/components/integrations/ControlledIntegrationsPanel";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const integrationTypes: Array<ControlledIntegrationType | ""> = ["", "registry", "lender", "insurer", "regulator", "accounting", "payment_provider", "operational_partner"];
const statuses: Array<ControlledIntegrationStatus | ""> = ["", "disabled", "sandbox_ready", "review_required", "partially_ready", "blocked"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function ControlledIntegrationsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<ControlledIntegrationProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const integrationType = String(searchParams.get("integrationType") || "") as ControlledIntegrationType | "";
  const status = String(searchParams.get("status") || "") as ControlledIntegrationStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchControlledIntegrationProfiles({ integrationType, status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load controlled integrations";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load controlled integrations", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [integrationType, status, showToast]);

  function updateParam(key: "integrationType" | "status", value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value.trim()) params.set(key, value.trim());
    else params.delete(key);
    setSearchParams(params);
  }

  return (
    <MacShell title="Controlled integrations" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Controlled integrations</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Controlled integrations are operationally scoped and review controlled. No autonomous synchronization or unrestricted external execution is enabled.
              Manual approval remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Integration type
            <select value={integrationType} onChange={(event) => updateParam("integrationType", event.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {integrationTypes.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParam("status", event.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading controlled integrations...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load controlled integrations right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No controlled integration profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? (
          <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <ControlledIntegrationsPanel key={profile.controlledIntegrationId} profile={profile} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
