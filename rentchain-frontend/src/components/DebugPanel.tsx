import React, { useEffect, useState } from "react";
import { fetchAccountLimits, type AccountLimits } from "../api/accountApi";

const lastApiError: unknown = null;

function formatApiError(err: unknown) {
  if (typeof err === "object" && err !== null && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return String(err);
}

export const DebugPanel: React.FC = () => {
  const [limits, setLimits] = useState<AccountLimits | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    fetchAccountLimits().then(setLimits).catch(() => setLimits(null));
  }, []);

  if (!import.meta.env.DEV) return null;

  // Normalize data to avoid crashes when limits are missing/shape differs
  const limitsData = limits || null;

  if (!limitsData) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(15,23,42,0.9)",
          color: "#e2e8f0",
          fontSize: 12,
          zIndex: 5000,
          border: "1px solid rgba(148,163,184,0.4)",
          maxWidth: 320,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Debug (dev only)</div>
        <div>Loading limits…</div>
        {lastApiError ? (
          <div style={{ marginTop: 8, color: "#fca5a5" }}>
            Last API error: {formatApiError(lastApiError)}
          </div>
        ) : null}
      </div>
    );
  }

  const usage = limitsData.usage || {};
  const capabilities = limitsData.capabilities || {};
  const plan = limitsData.plan || "starter";
  const integrity = limitsData.integrity;
  const integrityTooltip =
    integrity?.ok === false
      ? `Before: ${integrity.before?.properties ?? "?"} props, ${integrity.before?.units ?? "?"} units, ${
          integrity.before?.screeningsThisMonth ?? "?"
        } screenings → After: ${integrity.after?.properties ?? "?"} props, ${
          integrity.after?.units ?? "?"
        } units, ${integrity.after?.screeningsThisMonth ?? "?"} screenings`
      : integrity?.ok === true
      ? "Usage matches Firestore source-of-truth."
      : "No integrity data.";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        right: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(15,23,42,0.9)",
        color: "#e2e8f0",
        fontSize: 12,
        zIndex: 5000,
        border: "1px solid rgba(148,163,184,0.4)",
        maxWidth: 320,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Debug (dev only)</div>
      <div style={{ display: "grid", gap: 4 }}>
        <div>Plan: {plan}</div>
        <div title={integrityTooltip}>
          {integrity?.ok === false
            ? "Integrity mismatch (auto-corrected)"
            : integrity?.ok === true
            ? "Integrity: OK"
            : "Integrity: unknown"}
        </div>
        <div>Properties: {usage.properties ?? "N/A"}</div>
        <div>Units: {usage.units ?? "N/A"}</div>
        <div>AI: {capabilities["ai.insights"] ? "yes" : "no"}</div>
        <div>Screening: {capabilities["screening"] ? "yes" : "no"}</div>
        <div>Team Invites: {capabilities["team.invites"] ? "yes" : "no"}</div>
      </div>
      {lastApiError ? (
        <div style={{ marginTop: 8, color: "#fca5a5" }}>
          Last API error: {formatApiError(lastApiError)}
        </div>
      ) : null}
    </div>
  );
};
