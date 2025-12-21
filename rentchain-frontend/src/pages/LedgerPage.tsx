// @ts-nocheck
// rentchain-frontend/src/pages/LedgerPage.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TopNav } from "../components/layout/TopNav";
import { fetchTenantLedger, TenantLedgerEntry } from "../api/ledgerApi";
import { useToast } from "../components/ui/ToastProvider";

const LedgerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId");
  const { showToast } = useToast();

  const [entries, setEntries] = useState<TenantLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!tenantId) {
        setEntries([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await fetchTenantLedger(tenantId);
        if (!cancelled) {
          setEntries(data);
        }
      } catch (err) {
        console.error("[LedgerPage] Failed to load tenant ledger", err);
        if (!cancelled) {
          setError("Failed to load tenant ledger");
          showToast({
            message: "Failed to load ledger",
            description:
              "An error occurred while loading this tenant’s ledger entries.",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tenantId, showToast]);

  return (
    <div className="app-root">
      <TopNav />
      <div className="app-shell">
        <div
          style={{
            padding: 16,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <h1
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#e5e7eb",
            }}
          >
            Ledger
          </h1>

          {!tenantId ? (
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
              }}
            >
              No tenant selected. Open a tenant profile and click “View all
              ledger events →” to see their full ledger here.
            </div>
          ) : loading ? (
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
              }}
            >
              Loading ledger…
            </div>
          ) : error ? (
            <div
              style={{
                fontSize: 13,
                color: "#f97316",
              }}
            >
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
              }}
            >
              No ledger entries found for this tenant.
            </div>
          ) : (
            <div
              style={{
                borderRadius: 16,
                border: "1px solid rgba(31,41,55,1)",
                backgroundColor: "rgba(15,23,42,0.95)",
                padding: 12,
                maxHeight: "calc(100vh - 120px)",
                overflowY: "auto",
              }}
            >
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "6px 8px",
                    borderBottom: "1px solid rgba(31,41,55,1)",
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 500,
                        color: "#e5e7eb",
                      }}
                    >
                      {entry.date} · {entry.type}
                    </div>
                    {entry.label && (
                      <div
                        style={{
                          color: "#9ca3af",
                        }}
                      >
                        {entry.label}
                      </div>
                    )}
                    {entry.notes && (
                      <div
                        style={{
                          color: "#6b7280",
                          fontSize: 11,
                          marginTop: 2,
                        }}
                      >
                        {entry.notes}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      minWidth: 110,
                    }}
                  >
                    <div
                      style={{
                        color:
                          entry.type === "payment"
                            ? "#22c55e"
                            : entry.type === "charge"
                            ? "#f97316"
                            : "#e5e7eb",
                        fontWeight: 500,
                      }}
                    >
                      {entry.type === "payment" ? "+" : ""}
                      ${Number(entry.amount).toFixed(2)}
                    </div>
                    {typeof entry.runningBalance === "number" && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9ca3af",
                        }}
                      >
                        Bal: ${Number(entry.runningBalance).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LedgerPage;
