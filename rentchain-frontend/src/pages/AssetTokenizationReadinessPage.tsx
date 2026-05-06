import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchAssetTokenizationReadiness,
  type AssetTokenizationAssetType,
  type AssetTokenizationReadiness,
  type AssetTokenizationReadinessStatus,
} from "@/api/assetTokenizationReadinessApi";
import { MacShell } from "@/components/layout/MacShell";
import { AssetTokenizationReadinessPanel } from "@/components/tokenization/AssetTokenizationReadinessPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const statuses: Array<AssetTokenizationReadinessStatus | ""> = ["", "eligible_for_review", "partially_ready", "blocked", "unknown"];
const assetTypes: Array<AssetTokenizationAssetType | ""> = ["", "property", "lease_cashflow", "operational_asset"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function AssetTokenizationReadinessPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [readiness, setReadiness] = React.useState<AssetTokenizationReadiness[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const propertyId = String(searchParams.get("propertyId") || "").trim();
  const assetType = String(searchParams.get("assetType") || "") as AssetTokenizationAssetType | "";
  const status = String(searchParams.get("status") || "") as AssetTokenizationReadinessStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchAssetTokenizationReadiness({
          propertyId: propertyId || undefined,
          assetType,
          status,
        });
        if (mounted) setReadiness(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load asset tokenization readiness";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load asset tokenization readiness", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [propertyId, assetType, status, showToast]);

  function updateParams(next: { propertyId?: string; assetType?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Asset tokenization readiness" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Asset tokenization readiness</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Asset tokenization readiness is operational and review scoped. No token issuance, blockchain integration, or public marketplace is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Property reference
            <input value={propertyId} onChange={(event) => updateParams({ propertyId: event.target.value })} placeholder="Optional property reference" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 220 }} />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Asset type
            <select value={assetType} onChange={(event) => updateParams({ assetType: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {assetTypes.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading asset tokenization readiness...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load asset tokenization readiness right now.</Card> : null}
        {!loading && !error && !readiness.length ? <Card style={{ color: "#64748b" }}>No asset-tokenization readiness references match these filters.</Card> : null}
        {!loading && !error && readiness.length ? (
          <div style={{ display: "grid", gap: 16 }}>{readiness.map((item) => <AssetTokenizationReadinessPanel key={item.assetReadinessId} readiness={item} />)}</div>
        ) : null}
      </div>
    </MacShell>
  );
}
