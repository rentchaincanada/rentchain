import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchRentalHistoryLedgers,
  type RentalHistoryLedgerStatus,
  type VerifiedRentalHistoryLedger,
} from "@/api/rentalHistoryLedgerApi";
import { MacShell } from "@/components/layout/MacShell";
import { VerifiedRentalHistoryPanel } from "@/components/rentalHistory/VerifiedRentalHistoryPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<RentalHistoryLedgerStatus | ""> = ["", "verified", "partially_verified", "review_required", "blocked", "unknown"];

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load verified rental history";
}

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function VerifiedRentalHistoryPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ledgers, setLedgers] = React.useState<VerifiedRentalHistoryLedger[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const identityId = String(searchParams.get("identityId") || "").trim();
  const status = String(searchParams.get("status") || "") as RentalHistoryLedgerStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchRentalHistoryLedgers({ identityId: identityId || undefined, status });
        if (mounted) setLedgers(next);
      } catch (err) {
        const message = errorMessage(err);
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load verified rental history", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [identityId, status, showToast]);

  function updateParams(next: { identityId?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.identityId !== undefined) {
      if (next.identityId.trim()) params.set("identityId", next.identityId.trim());
      else params.delete("identityId");
    }
    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status);
      else params.delete("status");
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Verified rental history" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Verified rental history</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Rental history references are permissioned and operationally scoped. Manual review remains required. No public sharing,
              bureau reporting, or tokenization is enabled.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Identity reference
            <input
              value={identityId}
              onChange={(event) => updateParams({ identityId: event.target.value })}
              placeholder="Optional tenant reference"
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 240 }}
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

        {loading ? <Card>Loading verified rental history...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load verified rental history right now.</Card> : null}
        {!loading && !error && !ledgers.length ? <Card style={{ color: "#64748b" }}>No rental-history references match these filters.</Card> : null}
        {!loading && !error && ledgers.length ? (
          <div style={{ display: "grid", gap: 16 }}>
            {ledgers.map((ledger) => (
              <VerifiedRentalHistoryPanel key={ledger.ledgerId} ledger={ledger} />
            ))}
          </div>
        ) : null}
      </div>
    </MacShell>
  );
}
