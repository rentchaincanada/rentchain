import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchSettlementReadiness,
  type SettlementReadiness,
  type SettlementReadinessStatus,
} from "@/api/settlementReadinessApi";
import { MacShell } from "@/components/layout/MacShell";
import { SettlementReadinessPanel } from "@/components/settlement/SettlementReadinessPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<SettlementReadinessStatus | ""> = ["", "ready_for_review", "partially_ready", "blocked", "unknown"];

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load settlement readiness";
}

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function SettlementReadinessPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [readiness, setReadiness] = React.useState<SettlementReadiness[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const propertyId = String(searchParams.get("propertyId") || "").trim();
  const leaseId = String(searchParams.get("leaseId") || "").trim();
  const status = String(searchParams.get("status") || "") as SettlementReadinessStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchSettlementReadiness({
          propertyId: propertyId || undefined,
          leaseId: leaseId || undefined,
          status,
        });
        if (mounted) setReadiness(next);
      } catch (err) {
        const message = errorMessage(err);
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load settlement readiness", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [propertyId, leaseId, status, showToast]);

  function updateParams(next: { propertyId?: string; leaseId?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.propertyId !== undefined) {
      if (next.propertyId.trim()) params.set("propertyId", next.propertyId.trim());
      else params.delete("propertyId");
    }
    if (next.leaseId !== undefined) {
      if (next.leaseId.trim()) params.set("leaseId", next.leaseId.trim());
      else params.delete("leaseId");
    }
    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status);
      else params.delete("status");
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Settlement readiness" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Settlement readiness</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Settlement readiness references are operational and review scoped. No payment execution or banking integration is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Property reference
            <input
              value={propertyId}
              onChange={(event) => updateParams({ propertyId: event.target.value })}
              placeholder="Optional property reference"
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 220 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Lease reference
            <input
              value={leaseId}
              onChange={(event) => updateParams({ leaseId: event.target.value })}
              placeholder="Optional lease reference"
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 220 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select
              value={status}
              onChange={(event) => updateParams({ status: event.target.value })}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}
            >
              {statuses.map((item) => (
                <option key={item || "all"} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading settlement readiness...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load settlement readiness right now.</Card> : null}
        {!loading && !error && !readiness.length ? <Card style={{ color: "#64748b" }}>No settlement-readiness references match these filters.</Card> : null}
        {!loading && !error && readiness.length ? (
          <div style={{ display: "grid", gap: 16 }}>
            {readiness.map((item) => (
              <SettlementReadinessPanel key={item.settlementReadinessId} readiness={item} />
            ))}
          </div>
        ) : null}
      </div>
    </MacShell>
  );
}
