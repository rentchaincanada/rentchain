// rentchain-frontend/src/pages/LedgerPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchLedgerEvents, type LedgerEventStored } from "../api/ledgerApi";
import { useToast } from "../components/ui/ToastProvider";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useUpgrade } from "@/context/UpgradeContext";
import { colors, spacing } from "@/styles/tokens";
import { upgradeStarterButtonStyle } from "@/lib/upgradeButtonStyles";

function getEventDate(e: LedgerEventStored): Date {
  if (typeof e.ts === "number") return new Date(e.ts);
  return new Date(0);
}

function getLabel(e: LedgerEventStored): string {
  const p: any = e.payload ?? {};
  if (p.title) return String(p.title);
  if (p.noticeType) return String(p.noticeType);
  return String(e.type || "EVENT");
}

function getNotes(e: LedgerEventStored): string {
  const p: any = e.payload ?? {};
  if (p.note) return String(p.note);
  if (p.description) return String(p.description);
  return "";
}

function getAmount(e: LedgerEventStored): number {
  const p: any = e.payload ?? {};
  if (typeof p.amountCents === "number") return p.amountCents / 100;
  if (typeof p.amount === "number") return p.amount;
  return 0;
}

function getRunningBalance(e: LedgerEventStored): number | null {
  const p: any = e.payload ?? {};
  if (typeof p.runningBalance === "number") return p.runningBalance;
  return null;
}

const LedgerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [entries, setEntries] = useState<LedgerEventStored[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { features, loading: capsLoading } = useCapabilities();
  const { openUpgrade } = useUpgrade();
  const ledgerEnabled = features?.ledger !== false;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!ledgerEnabled) return;
        setLoading(true);
        setError(null);
        const data = await fetchLedgerEvents({
          tenantId: tenantId || undefined,
          limit: 100,
        });
        if (!cancelled) {
          setEntries(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("[LedgerPage] Failed to load ledger", err);
        if (!cancelled) {
          setError("Failed to load ledger");
          showToast({
            message: "Failed to load ledger",
            description: "An error occurred while loading ledger entries.",
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
  }, [tenantId, showToast, ledgerEnabled]);

  const filterChip = useMemo(() => {
    if (!tenantId) return null;
    const shortId =
      tenantId.length > 8
        ? `${tenantId.slice(0, 4)}...${tenantId.slice(-3)}`
        : tenantId;
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 12,
          background: "rgba(59,130,246,0.12)",
          color: "#bfdbfe",
          border: "1px solid rgba(59,130,246,0.35)",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span>Filtered: Tenant {shortId}</span>
        <button
          type="button"
          onClick={() => navigate("/ledger")}
          style={{
            background: "transparent",
            border: "1px solid rgba(59,130,246,0.45)",
            color: "#bfdbfe",
            borderRadius: 10,
            padding: "4px 8px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Clear filter
        </button>
      </div>
    );
  }, [tenantId, navigate]);

  const emptyMessage = tenantId
    ? "No ledger events for this tenant yet."
    : "No ledger events yet.";

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const da = getEventDate(a).getTime();
      const db = getEventDate(b).getTime();
      return db - da;
    });
  }, [entries]);

  return (
    <div className="app-root">
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

          {filterChip}

          {!capsLoading && !ledgerEnabled ? (
            <div
              style={{
                border: "1px solid rgba(148,163,184,0.35)",
                borderRadius: 16,
                padding: spacing.md,
                background: "rgba(15,23,42,0.6)",
                color: "#e2e8f0",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Upgrade to manage your rentals
              </div>
              <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 12 }}>
                RentChain Screening is free. Rental management starts on Starter.
              </div>
              <button
                type="button"
                onClick={() =>
                  openUpgrade({
                    reason: "screening",
                    plan: "Screening",
                    copy: {
                      title: "Upgrade to manage your rentals",
                      body: "RentChain Screening is free. Rental management starts on Starter.",
                    },
                    ctaLabel: "Upgrade to Starter",
                  })
                }
                style={upgradeStarterButtonStyle}
              >
                Upgrade to Starter
              </button>
            </div>
          ) : (
            <>
              {loading ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "#9ca3af",
                  }}
                >
                  Loading ledger...
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
              ) : sortedEntries.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "#9ca3af",
                  }}
                >
                  {emptyMessage}
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
                  {sortedEntries.map((entry) => {
                    const dt = getEventDate(entry);
                    const label = getLabel(entry);
                    const notes = getNotes(entry);
                    const amount = getAmount(entry);
                    const running = getRunningBalance(entry);
                    const isPayment =
                      entry.type === "payment" || entry.type === "PAYMENT_RECORDED";
                    const isCharge =
                      entry.type === "charge" || entry.type === "RENT_CHARGED";

                    return (
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
                            {dt.toLocaleString()} — {entry.type || "entry"}
                          </div>
                          {label ? (
                            <div
                              style={{
                                color: "#9ca3af",
                              }}
                            >
                              {label}
                            </div>
                          ) : null}
                          {notes ? (
                            <div
                              style={{
                                color: "#6b7280",
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              {notes}
                            </div>
                          ) : null}
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            minWidth: 110,
                          }}
                        >
                          <div
                            style={{
                              color: isPayment
                                ? "#22c55e"
                                : isCharge
                                ? "#f97316"
                                : "#e5e7eb",
                              fontWeight: 500,
                            }}
                          >
                            {isPayment ? "+" : ""}
                            ${amount.toFixed(2)}
                          </div>
                          {running !== null ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                              }}
                            >
                              Bal: ${Number(running).toFixed(2)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LedgerPage;
