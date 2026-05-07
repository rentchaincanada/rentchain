import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchInteroperabilityAdapterReadiness,
  type InteroperabilityAdapterReadiness,
  type InteroperabilityAdapterStatus,
  type InteroperabilityAdapterType,
} from "@/api/interoperabilityAdaptersApi";
import { InteroperabilityAdapterPanel } from "@/components/interoperability/InteroperabilityAdapterPanel";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const adapterTypes: Array<InteroperabilityAdapterType | ""> = ["", "lender", "insurer", "regulator", "registry", "accounting", "payment_provider", "operational_partner"];
const statuses: Array<InteroperabilityAdapterStatus | ""> = ["", "ready_for_review", "partially_ready", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function InteroperabilityAdapterPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [readiness, setReadiness] = React.useState<InteroperabilityAdapterReadiness[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const adapterType = String(searchParams.get("adapterType") || "") as InteroperabilityAdapterType | "";
  const status = String(searchParams.get("status") || "") as InteroperabilityAdapterStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchInteroperabilityAdapterReadiness({ adapterType, status });
        if (mounted) setReadiness(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load interoperability readiness";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load interoperability readiness", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [adapterType, status, showToast]);

  function updateParams(next: { adapterType?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Interoperability adapters" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Interoperability adapters</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Interoperability adapters are operationally scoped and review controlled. No live integrations or autonomous synchronization is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Adapter type
            <select value={adapterType} onChange={(event) => updateParams({ adapterType: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 210 }}>
              {adapterTypes.map((type) => <option key={type || "all"} value={type}>{label(type)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading interoperability readiness...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load interoperability readiness right now.</Card> : null}
        {!loading && !error && !readiness.length ? <Card style={{ color: "#64748b" }}>No interoperability adapter readiness items match these filters.</Card> : null}
        {!loading && !error && readiness.length ? (
          <div style={{ display: "grid", gap: 16 }}>{readiness.map((item) => <InteroperabilityAdapterPanel key={item.adapterReadinessId} readiness={item} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
