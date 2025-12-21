import React, { useEffect, useState } from "react";
import { getAuthToken } from "../../lib/apiClient";

export function DashboardPortfolioAiSummary() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAiSummary = async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(
          "http://localhost:3000/dashboard/portfolio-ai",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              note: "Executive summary for landlord dashboard.",
            }),
          }
        );

        const data = await res.json();

        if (!data.success) {
          setError(data.errorMessage || "AI summary failed.");
        } else {
          setSummary(data.ai?.text ?? null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load AI summary.");
      } finally {
        setLoading(false);
      }
    };

    fetchAiSummary();
  }, []);

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        marginBottom: "24px",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "12px" }}>
        AI Executive Portfolio Summary
      </h2>

      {loading && <p>Generating AI insights…</p>}

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
    </div>
  );
}
