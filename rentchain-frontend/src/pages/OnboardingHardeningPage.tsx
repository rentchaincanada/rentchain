import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchLandlordOnboardingHardeningProfiles,
  fetchTenantOnboardingHardeningProfiles,
  type OnboardingHardeningProfile,
  type OnboardingHardeningStatus,
  type OnboardingParticipantType,
} from "@/api/onboardingHardeningApi";
import { MacShell } from "@/components/layout/MacShell";
import { OnboardingHardeningPanel } from "@/components/onboarding/OnboardingHardeningPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<OnboardingHardeningStatus | ""> = ["", "ready_for_review", "partially_ready", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function OnboardingHardeningPage({ participantType = "landlord" }: { participantType?: OnboardingParticipantType }) {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<OnboardingHardeningProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const status = String(searchParams.get("status") || "") as OnboardingHardeningStatus | "";
  const isTenant = participantType === "tenant";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const fetcher = isTenant ? fetchTenantOnboardingHardeningProfiles : fetchLandlordOnboardingHardeningProfiles;
        const next = await fetcher({ participantType, status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load onboarding hardening";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load onboarding hardening", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isTenant, participantType, status, showToast]);

  function updateStatus(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value.trim()) params.set("status", value.trim());
    else params.delete("status");
    setSearchParams(params);
  }

  const content = (
    <div style={{ display: "grid", gap: 16 }}>
      <Section>
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{label(participantType)} onboarding hardening</h1>
          <div style={{ color: "#475569", maxWidth: 900 }}>
            Onboarding readiness is operationally scoped and review controlled. No autonomous onboarding or screening activation is enabled.
            Manual review remains required.
          </div>
        </div>
      </Section>

      <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
          Status
          <select value={status} onChange={(event) => updateStatus(event.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
            {statuses.map((item) => (
              <option key={item || "all"} value={item}>{label(item)}</option>
            ))}
          </select>
        </label>
      </Section>

      {loading ? <Card>Loading onboarding hardening...</Card> : null}
      {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load onboarding hardening right now.</Card> : null}
      {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No onboarding hardening profiles match these filters.</Card> : null}
      {!loading && !error && profiles.length ? (
        <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <OnboardingHardeningPanel key={profile.onboardingHardeningId} profile={profile} />)}</div>
      ) : null}
    </div>
  );

  if (isTenant) return content;
  return (
    <MacShell title="Onboarding hardening" showTopNav={false}>
      {content}
    </MacShell>
  );
}
