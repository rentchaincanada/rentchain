import React, { useEffect, useState } from "react";
import { Card, Pill } from "../ui/Ui";
import { fetchPropertyRegistryStatus, type Property, type PropertyRegistryStatus } from "../../api/propertiesApi";

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function statusLabel(status: PropertyRegistryStatus["registryStatus"]) {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending_review":
      return "Pending municipal review";
    case "possible_mismatch":
      return "Possible mismatch detected";
    case "manual_review":
      return "Manual review in progress";
    case "not_found":
    default:
      return "No public match found";
  }
}

type Props = {
  property: Property | null;
};

export const PropertyRegistryStatusCard: React.FC<Props> = ({ property }) => {
  const [data, setData] = useState<{
    status: PropertyRegistryStatus | null;
    source: { sourceLabel: string };
    coverage: { available: boolean; message: string | null };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const propertyId = property?.id;
    if (!propertyId) {
      setData(null);
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchPropertyRegistryStatus(propertyId);
        if (!active) return;
        setData(result);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load registry status");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [property?.id]);

  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Compliance / Registry
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Registry Intelligence</div>
        </div>
        {data?.status ? <Pill tone={data.status.registryStatus === "verified" || data.status.registryStatus === "pending_review" ? "accent" : "muted"}>{statusLabel(data.status.registryStatus)}</Pill> : null}
      </div>
      {loading ? <div style={{ color: "#475569" }}>Checking Halifax registry status…</div> : null}
      {!loading && error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
      {!loading && data && !data.coverage.available ? <div style={{ color: "#475569" }}>{data.coverage.message}</div> : null}
      {!loading && data?.status ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "#475569" }}>{data.status.summary}</div>
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div>
              <strong>Source:</strong> {data.source.sourceLabel}
            </div>
            <div>
              <strong>Last checked:</strong> {formatDate(data.status.lastEvaluatedAt)}
            </div>
            <div>
              <strong>Registration number:</strong> {data.status.registrationNumber || "--"}
            </div>
            <div>
              <strong>Recommended action:</strong> {data.status.recommendedAction}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
};
