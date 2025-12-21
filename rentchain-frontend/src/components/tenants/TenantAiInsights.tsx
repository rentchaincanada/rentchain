import React, { useEffect, useState } from "react";
import api from "../../api/client";

interface TenantAiInsightsProps {
  tenantId: string | null;
  tenantName?: string;
  propertyName?: string;
  unit?: string;
  currentBalance?: number;
  paymentHistory?: any[];
  notes?: string;
}

export const TenantAiInsights: React.FC<TenantAiInsightsProps> = ({
  tenantId,
  tenantName,
  propertyName,
  unit,
  currentBalance,
  paymentHistory,
  notes,
}) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no tenant selected, reset
    if (!tenantId) {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setSummary(null);

        const res = await api.post(`/tenants/${tenantId}/ai-insights`, {
          tenantName,
          propertyName,
          unit,
          currentBalance,
          paymentHistory,
          notes,
        });

        const data = res.data;

        if (!data.success) {
          setError(data.errorMessage || "AI tenant insights failed.");
        } else {
          setSummary(data.ai?.text ?? null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load AI tenant insights.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [
    tenantId,
    tenantName,
    propertyName,
    unit,
    currentBalance,
    paymentHistory,
    notes,
  ]);

  if (!tenantId) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>AI Tenant Insights</h3>
        <p>Select a tenant to view AI insights.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        marginTop: "16px",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        AI Tenant Insights {tenantName ? `– ${tenantName}` : ""}
      </h3>

      {loading && <p>Analyzing tenant profile…</p>}

      {error && (
        <p style={{ color: "red", fontWeight: 500 }}>
          {error}
        </p>
      )}

      {!loading && !error && summary && (
        <div
          style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}
          dangerouslySetInnerHTML={{
            __html: summary.replace(/\n/g, "<br />"),
          }}
        />
      )}

      {!loading && !error && !summary && (
        <p>No AI insights available yet for this tenant.</p>
      )}
    </div>
  );
};
