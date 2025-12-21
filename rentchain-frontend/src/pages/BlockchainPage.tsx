// rentchain-frontend/src/pages/BlockchainPage.tsx
import React, { useMemo, useState } from "react";
import { TopNav } from "../components/layout/TopNav";
import { useBlockchain } from "../hooks/useBlockchain";
import { useBlockchainVerify } from "../hooks/useBlockchainVerify";

const truncate = (hash: string | null | undefined, length = 12) => {
  if (!hash) return "—";
  if (hash.length <= length) return hash;
  return `${hash.slice(0, length)}…${hash.slice(-4)}`;
};

const BlockchainPage: React.FC = () => {
  const { blocks, length, head, loading, error } = useBlockchain();
  const {
    data: verifyData,
    loading: verifyLoading,
    error: verifyError,
    refresh: refreshVerify,
  } = useBlockchainVerify();

  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const tenantOptions = useMemo(() => {
    const map = new Map<string, string>();
    blocks.forEach((b) => {
      if (!b.tenantId) return;
      if (!map.has(b.tenantId)) {
        map.set(b.tenantId, b.tenantName || b.tenantId);
      }
    });
    return Array.from(map.entries())
      .map(([tenantId, tenantName]) => ({ tenantId, tenantName }))
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
  }, [blocks]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    blocks.forEach((b) => {
      if (b.type) set.add(b.type);
    });
    return Array.from(set).sort();
  }, [blocks]);

  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (tenantFilter !== "all" && b.tenantId !== tenantFilter) return false;
      if (typeFilter !== "all" && b.type !== typeFilter) return false;
      return true;
    });
  }, [blocks, tenantFilter, typeFilter]);

  // --- Derive a friendly verification status model ---

  const verificationStatus = useMemo(() => {
    if (verifyLoading) {
      return {
        badge: "Checking…",
        badgeColor: "rgba(59,130,246,0.4)",
        headline: "Checking blockchain integrity…",
        detail:
          "The system is rebuilding the chain and comparing it to the latest stored chain head snapshot.",
      };
    }

    if (verifyError) {
      return {
        badge: "Error",
        badgeColor: "rgba(248,113,113,0.7)",
        headline: "Integrity check failed to run",
        detail: verifyError,
      };
    }

    if (!verifyData) {
      return {
        badge: "Unknown",
        badgeColor: "rgba(148,163,184,0.7)",
        headline: "No verification data available",
        detail:
          "The verification service has not returned any data yet. Try running the check again.",
      };
    }

    if (verifyData.ok && verifyData.message?.includes("No chain head")) {
      // "No chain head snapshots exist yet."
      return {
        badge: "Not Initialized",
        badgeColor: "rgba(250,204,21,0.7)",
        headline: "Chain heads not initialized yet",
        detail:
          verifyData.message ||
          "No chain head snapshots are stored yet. Record a payment to create the first snapshot.",
      };
    }

    if (verifyData.ok) {
      return {
        badge: "Verified",
        badgeColor: "rgba(34,197,94,0.75)",
        headline: "Blockchain integrity verified",
        detail:
          verifyData.message ||
          "The recomputed chain head matches the stored snapshot for the latest tenant.",
        extra: verifyData,
      };
    }

    // ok === false
    const reason =
      verifyData.reason ||
      verifyData.message ||
      "The blockchain verification reported a mismatch.";

    const mismatchDetail =
      verifyData.expected && verifyData.actual
        ? `Expected hash ${truncate(
            verifyData.expected,
            16
          )}, got ${truncate(verifyData.actual, 16)}.`
        : undefined;

    return {
      badge: "Mismatch",
      badgeColor: "rgba(248,113,113,0.85)",
      headline: "Blockchain integrity mismatch detected",
      detail: mismatchDetail || reason,
      extra: verifyData,
    };
  }, [verifyData, verifyLoading, verifyError]);

  return (
    <div className="app-root">
      <TopNav />
      <div className="app-shell">
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "1.5rem",
            gap: "1rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              Integrity &amp; Blockchain
            </h1>
            <div
              style={{
                opacity: 0.7,
                fontSize: "0.8rem",
                marginTop: "0.15rem",
              }}
            >
              {loading
                ? "Building chain from ledger events..."
                : `${length} block${length === 1 ? "" : "s"} in the chain`}
            </div>
          </div>

          <button
            type="button"
            onClick={refreshVerify}
            style={{
              fontSize: "0.8rem",
              padding: "0.35rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.7)",
              backgroundColor: "rgba(15,23,42,0.95)",
              color: "white",
              cursor: "pointer",
              opacity: verifyLoading ? 0.7 : 1,
            }}
            disabled={verifyLoading}
          >
            {verifyLoading ? "Re-checking…" : "Re-check integrity"}
          </button>
        </div>

        {/* Integrity status card */}
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.9rem 1.1rem",
            borderRadius: "0.9rem",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.98))",
            border: "1px solid rgba(148,163,184,0.6)",
            boxShadow: "0 18px 40px rgba(15,23,42,0.6)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            fontSize: "0.85rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  marginBottom: "0.25rem",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "0.6rem",
                    height: "0.6rem",
                    borderRadius: "999px",
                    backgroundColor: verificationStatus.badgeColor,
                    boxShadow: `0 0 12px ${verificationStatus.badgeColor}`,
                  }}
                />
                <span
                  style={{
                    fontSize: "0.78rem",
                    padding: "0.12rem 0.55rem",
                    borderRadius: "999px",
                    border: `1px solid ${verificationStatus.badgeColor}`,
                    backgroundColor: "rgba(15,23,42,0.95)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}
                >
                  {verificationStatus.badge}
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  marginBottom: "0.15rem",
                }}
              >
                {verificationStatus.headline}
              </div>
              <div
                style={{
                  opacity: 0.85,
                }}
              >
                {verificationStatus.detail}
              </div>
            </div>

            {verificationStatus.extra &&
              verificationStatus.extra.ok &&
              head && (
                <div
                  style={{
                    minWidth: "240px",
                    padding: "0.55rem 0.7rem",
                    borderRadius: "0.6rem",
                    background:
                      "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(56,189,248,0.1))",
                    border: "1px solid rgba(34,197,94,0.6)",
                    fontSize: "0.8rem",
                  }}
                >
                  <div
                    style={{
                      opacity: 0.7,
                      marginBottom: "0.15rem",
                    }}
                  >
                    Latest verified tenant
                  </div>
                  <div style={{ marginBottom: "0.15rem" }}>
                    <strong>
                      {(verificationStatus.extra as any).tenantId || "Unknown"}
                    </strong>
                  </div>
                  <div
                    style={{
                      opacity: 0.7,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco",
                      fontSize: "0.78rem",
                    }}
                  >
                    Block #{(verificationStatus.extra as any).blockHeight} ·{" "}
                    {truncate((verificationStatus.extra as any).rootHash, 16)}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Summary + Filters */}
        <div
          style={{
            marginBottom: "1.25rem",
            display: "grid",
            gridTemplateColumns: "minmax(0, 2.1fr) minmax(0, 1.2fr)",
            gap: "1rem",
            alignItems: "stretch",
          }}
        >
          {/* Chain integrity snapshot (based on current computed chain) */}
          <div
            style={{
              padding: "0.9rem 1.1rem",
              borderRadius: "0.9rem",
              background:
                "linear-gradient(135deg, rgba(129,140,248,0.16), rgba(45,212,191,0.18))",
              border: "1px solid rgba(94,234,212,0.5)",
              boxShadow: "0 18px 40px rgba(15,23,42,0.6)",
              fontSize: "0.85rem",
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                marginBottom: "0.3rem",
              }}
            >
              Chain Integrity Snapshot (computed)
            </div>
            {loading ? (
              <div style={{ opacity: 0.9 }}>Building chain from events...</div>
            ) : length === 0 ? (
              <div style={{ opacity: 0.8 }}>
                No ledger events are currently available to build a chain.
                Record payments or other events to populate this view.
              </div>
            ) : (
              <>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "1.1rem",
                  }}
                >
                  <li>
                    The chain currently has{" "}
                    <strong>{length}</strong> block
                    {length === 1 ? "" : "s"} derived from your ledger across all
                    tenants and properties.
                  </li>
                  {head && (
                    <li>
                      The current head block is{" "}
                      <strong>#{head.index}</strong> with hash{" "}
                      <code>{truncate(head.hash, 16)}</code>.
                    </li>
                  )}
                  {head && (
                    <li>
                      Any change to historical ledger events would alter one or
                      more block hashes, causing a mismatch from the last
                      verified snapshot.
                    </li>
                  )}
                </ul>
                {head && (
                  <div
                    style={{
                      marginTop: "0.6rem",
                      padding: "0.55rem 0.7rem",
                      borderRadius: "0.6rem",
                      backgroundColor: "rgba(15,23,42,0.9)",
                      border: "1px solid rgba(148,163,184,0.5)",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco",
                      fontSize: "0.78rem",
                      wordBreak: "break-all",
                    }}
                  >
                    <div
                      style={{
                        opacity: 0.7,
                        marginBottom: "0.2rem",
                      }}
                    >
                      Current computed head hash
                    </div>
                    <div>{head.hash}</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Filters */}
          <div
            style={{
              padding: "0.9rem 1.1rem",
              borderRadius: "0.9rem",
              backgroundColor: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.5)",
              fontSize: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
            >
              Block Filters
            </div>

            {/* Tenant filter */}
            <label
              style={{
                fontSize: "0.8rem",
                opacity: 0.9,
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <span>Tenant</span>
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                style={{
                  backgroundColor: "rgba(15,23,42,0.98)",
                  borderRadius: "0.4rem",
                  border: "1px solid rgba(148,163,184,0.7)",
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.8rem",
                  color: "white",
                }}
              >
                <option value="all">All tenants</option>
                {tenantOptions.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.tenantName}
                  </option>
                ))}
              </select>
            </label>

            {/* Event type filter */}
            <label
              style={{
                fontSize: "0.8rem",
                opacity: 0.9,
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <span>Event type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  backgroundColor: "rgba(15,23,42,0.98)",
                  borderRadius: "0.4rem",
                  border: "1px solid rgba(148,163,184,0.7)",
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.8rem",
                  color: "white",
                }}
              >
                <option value="all">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Blocks table */}
        <div
          style={{
            backgroundColor: "rgba(15,23,42,0.7)",
            borderRadius: "0.75rem",
            padding: "1rem",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            border: "1px solid rgba(148,163,184,0.4)",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              marginBottom: "0.75rem",
              opacity: 0.9,
            }}
          >
            Blocks
          </div>

          {loading ? (
            <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
              Loading blockchain view...
            </div>
          ) : filteredBlocks.length === 0 ? (
            <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
              No blocks match the current filters.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.85rem",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.7 }}>
                    <th style={{ padding: "0.5rem" }}>#</th>
                    <th style={{ padding: "0.5rem" }}>Event</th>
                    <th style={{ padding: "0.5rem" }}>Tenant / Property</th>
                    <th style={{ padding: "0.5rem", textAlign: "right" }}>
                      Amount
                    </th>
                    <th style={{ padding: "0.5rem" }}>Event Date</th>
                    <th style={{ padding: "0.5rem" }}>Hash</th>
                    <th style={{ padding: "0.5rem" }}>Prev Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBlocks.map((b) => (
                    <tr
                      key={b.hash}
                      style={{
                        borderBottom: "1px solid rgba(30,41,59,0.9)",
                      }}
                    >
                      <td style={{ padding: "0.4rem 0.5rem" }}>{b.index}</td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>
                        <div>{b.type}</div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            opacity: 0.7,
                          }}
                        >
                          ID: {b.eventId ?? "—"}
                        </div>
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>
                        <div>{b.tenantName ?? "—"}</div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            opacity: 0.7,
                          }}
                        >
                          {b.propertyName ?? "—"}
                          {b.unit ? ` – ${b.unit}` : ""}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "0.4rem 0.5rem",
                          textAlign: "right",
                        }}
                      >
                        {b.amount
                          ? `$${Number(b.amount).toLocaleString()}`
                          : "$0"}
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>
                        {b.eventDate
                          ? new Date(b.eventDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "0.4rem 0.5rem",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco",
                          fontSize: "0.78rem",
                        }}
                      >
                        {truncate(b.hash, 16)}
                      </td>
                      <td
                        style={{
                          padding: "0.4rem 0.5rem",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco",
                          fontSize: "0.78rem",
                        }}
                      >
                        {truncate(b.prevHash, 16)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockchainPage;
