import React from "react";
import { verifyLedger } from "@/api/ledgerApi";

type Result = { ok: boolean; checked: number; brokenAt?: string; reason?: string };

export function VerifyLedgerButton({ limit = 500, onVerified }: { limit?: number; onVerified?: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastCheckedTs, setLastCheckedTs] = React.useState<number | null>(null);

  const runVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await verifyLedger(limit);
      setResult(res);
      setLastCheckedTs(Date.now());
      onVerified?.();
    } catch (e: any) {
      setError(e?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        onClick={runVerify}
        disabled={loading}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid rgba(148,163,184,0.6)",
          background: loading ? "rgba(148,163,184,0.2)" : "#fff",
          color: "#0f172a",
          cursor: loading ? "default" : "pointer",
          fontWeight: 700,
        }}
      >
        {loading ? "Verifying..." : "Verify ledger"}
      </button>

      {result ? (
        <div style={{ fontSize: 12, color: result.ok ? "#0f766e" : "#b91c1c" }}>
          {result.ok
            ? `Verified (checked ${result.checked})`
            : `Broken: ${result.reason || "Unknown"}`}
          {result.brokenAt ? ` @ ${result.brokenAt}` : ""}
          {lastCheckedTs ? (
            <div style={{ color: "#475569", marginTop: 2 }}>
              Last checked {new Date(lastCheckedTs).toLocaleString()}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div style={{ fontSize: 12, color: "#b91c1c" }}>Verify failed: {error}</div>
      ) : null}
    </div>
  );
}
