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
    pidPrompt: {
      propertyPid: string | null;
      propertyPidMissing: boolean;
      registryPid: string | null;
      registryPidAvailable: boolean;
      pidPromptEligible: boolean;
      pidPromptMessage: string | null;
      sourceLabel: string;
      actionable: boolean;
    };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

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

  const handleCopyPid = async () => {
    const pid = data?.pidPrompt.registryPid;
    if (!pid) return;
    try {
      await navigator.clipboard.writeText(pid);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  };

  const canOpenAdminReview =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin") && Boolean(property?.id);

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
      {!loading && data?.pidPrompt.pidPromptEligible ? (
        <div
          style={{
            display: "grid",
            gap: 8,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(37,99,235,0.18)",
            background: "rgba(37,99,235,0.06)",
          }}
        >
          <div style={{ fontWeight: 700, color: "#0f172a" }}>Property PID missing</div>
          <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
            {data.pidPrompt.pidPromptMessage}
          </div>
          <div style={{ color: "#334155", fontSize: 13 }}>
            Registry PID available from {data.pidPrompt.sourceLabel}: <strong>{data.pidPrompt.registryPid}</strong>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                void handleCopyPid();
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(37,99,235,0.3)",
                background: "#fff",
                color: "#1d4ed8",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {copyState === "copied" ? "PID copied" : "Copy PID"}
            </button>
            {canOpenAdminReview ? (
              <button
                type="button"
                onClick={() => {
                  window.location.assign(`/admin/registry/properties/${encodeURIComponent(String(property?.id || ""))}`);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "#fff",
                  color: "#0f172a",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Open registry review
              </button>
            ) : null}
          </div>
          {copyState === "failed" ? (
            <div style={{ color: "#b91c1c", fontSize: 13 }}>
              Could not copy automatically. You can still copy the PID manually.
            </div>
          ) : null}
        </div>
      ) : null}
      {!loading && data?.status ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "#475569" }}>{data.status.summary}</div>
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div>
              <strong>Property PID:</strong> {data.pidPrompt.propertyPid || "--"}
            </div>
            <div>
              <strong>Registry PID:</strong> {data.status.pid || "--"}
            </div>
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
