import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchInstitutionOnboardingReadiness,
  type InstitutionOnboardingReadiness,
  type InstitutionOnboardingStatus,
  type InstitutionType,
} from "@/api/institutionOnboardingApi";
import { MacShell } from "@/components/layout/MacShell";
import { InstitutionOnboardingPanel } from "@/components/onboarding/InstitutionOnboardingPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const institutionTypes: Array<InstitutionType | ""> = ["", "lender", "insurer", "auditor", "regulator", "municipality", "institutional_landlord", "operational_partner"];
const statuses: Array<InstitutionOnboardingStatus | ""> = ["", "ready_for_review", "partially_ready", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function InstitutionOnboardingReadinessPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [readiness, setReadiness] = React.useState<InstitutionOnboardingReadiness[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const institutionType = String(searchParams.get("institutionType") || "") as InstitutionType | "";
  const status = String(searchParams.get("status") || "") as InstitutionOnboardingStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchInstitutionOnboardingReadiness({ institutionType, status });
        if (mounted) setReadiness(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load institution onboarding readiness";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load institution onboarding readiness", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [institutionType, status, showToast]);

  function updateParams(next: { institutionType?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Institution onboarding readiness" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Institution onboarding readiness</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Institution onboarding readiness is operationally scoped and review controlled. No live institution integration or autonomous onboarding is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Institution type
            <select value={institutionType} onChange={(event) => updateParams({ institutionType: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 210 }}>
              {institutionTypes.map((type) => <option key={type || "all"} value={type}>{label(type)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading institution onboarding readiness...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load institution onboarding readiness right now.</Card> : null}
        {!loading && !error && !readiness.length ? <Card style={{ color: "#64748b" }}>No institution onboarding readiness items match these filters.</Card> : null}
        {!loading && !error && readiness.length ? (
          <div style={{ display: "grid", gap: 16 }}>{readiness.map((item) => <InstitutionOnboardingPanel key={item.onboardingReadinessId} readiness={item} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
