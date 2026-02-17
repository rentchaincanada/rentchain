import React, { useEffect, useState } from "react";
import { fetchAccountLimits, type AccountLimits } from "../api/accountApi";

let lastApiError: any = null;
export function setLastApiError(err: any) {
  lastApiError = err;
}

export const DebugPanel: React.FC = () => {
  const [limits, setLimits] = useState<AccountLimits | null>(null);

  useEffect(() => {
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
            Last API error: {String(lastApiError?.message || lastApiError)}
          </div>
        ) : null}
      </div>
    );
  }

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
        Debug (dev): Loading limits…
      </div>
    );
  }

  const normalizedLimits: any = (limitsData as any).limits ? (limitsData as any).limits : limitsData;
  const usage = (limitsData as any).usage || {};
  const capabilities = (limitsData as any).capabilities || (limitsData as any).entitlements || {};
  const plan = (limitsData as any).plan || "starter";
  const integrity = (limitsData as any)?.integrity;
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
          Last API error: {String(lastApiError?.message || lastApiError)}
        </div>
      ) : null}
    </div>
  );
};
