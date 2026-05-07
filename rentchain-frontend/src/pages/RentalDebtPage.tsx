import React from "react";
import { useSearchParams } from "react-router-dom";
import { fetchRentalDebtProfiles, type RentalDebtProfile, type RentalDebtStatus } from "@/api/rentalDebtApi";
import { MacShell } from "@/components/layout/MacShell";
import { RentalDebtPanel } from "@/components/debt/RentalDebtPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<RentalDebtStatus | ""> = ["", "verified", "partially_verified", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function RentalDebtPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = React.useState<RentalDebtProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const tenantId = String(searchParams.get("tenantId") || "").trim();
  const status = String(searchParams.get("status") || "") as RentalDebtStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchRentalDebtProfiles({ tenantId: tenantId || undefined, status });
        if (mounted) setProfiles(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load rental debt accountability";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load rental debt accountability", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tenantId, status, showToast]);

  function updateParams(next: { tenantId?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.tenantId !== undefined) {
      if (next.tenantId.trim()) params.set("tenantId", next.tenantId.trim());
      else params.delete("tenantId");
    }
    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status);
      else params.delete("status");
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Rental debt accountability" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Rental debt accountability</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Rental debt accountability is operationally scoped and review controlled. No collections execution, bureau reporting, or public debt exposure is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Tenant reference
            <input
              value={tenantId}
              onChange={(event) => updateParams({ tenantId: event.target.value })}
              placeholder="Optional tenant reference"
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 240 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading rental debt accountability...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load rental debt accountability right now.</Card> : null}
        {!loading && !error && !profiles.length ? <Card style={{ color: "#64748b" }}>No rental debt accountability profiles match these filters.</Card> : null}
        {!loading && !error && profiles.length ? (
          <div style={{ display: "grid", gap: 16 }}>{profiles.map((profile) => <RentalDebtPanel key={profile.rentalDebtId} profile={profile} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
