// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchActionCenter } from "../../api/actionCenterApi";
import type { ActionRequest } from "../../api/actionRequestsApi";
import { fixActionForRequest } from "../../services/actionRequestFixRouter";

function shortId(v: any, n = 8) {
  const s = typeof v === "string" ? v : "";
  return s ? `${s.slice(0, n)}…` : "—";
}

function safeStr(v: any) {
  return typeof v === "string" ? v : "";
}

function parseTime(it: any): number {
  const t = it?.updatedAt ?? it?.reportedAt ?? it?.createdAt;
  if (!t) return 0;
  if (typeof t === "string") {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : 0;
  }
  const maybe = t?.toDate?.();
  if (maybe instanceof Date) return maybe.getTime();
  return 0;
}

function daysAgo(ms: number) {
  if (!ms) return null;
  const diff = Date.now() - ms;
  if (diff <= 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function severityRank(s?: string) {
  if (s === "high") return 0;
  if (s === "medium") return 1;
  if (s === "low") return 2;
  return 3;
}

export function ActionCenterDrawer({
  open,
  onClose,
  propertyLabelById,
}: {
  open: boolean;
  onClose: () => void;
  propertyLabelById: Record<string, { name: string; subtitle?: string }>;
}) {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<ActionRequest[]>([]);
  const [q, setQ] = useState("");
  const [sev, setSev] = useState<"all" | "high" | "medium" | "low">("all");
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchActionCenter(25);
      setItems(res.actionRequests ?? []);
      setRefreshedAt(Date.now());
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load Action Center");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let alive = true;

    (async () => {
      if (!alive) return;
      await load();
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? [])
      .filter((x) => x.status !== "resolved")
      .filter((x) => (sev === "all" ? true : x.severity === sev))
      .filter((x) => {
        if (!s) return true;
        const blob = [
          x.issueType,
          x.description,
          x.ruleKey,
          x.propertyId,
          x.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(s);
      })
      .sort((a, b) => {
        const sr = severityRank(a.severity) - severityRank(b.severity);
        if (sr !== 0) return sr;
        const at = String(a.updatedAt ?? a.reportedAt ?? a.createdAt ?? "");
        const bt = String(b.updatedAt ?? b.reportedAt ?? b.createdAt ?? "");
        return bt.localeCompare(at);
      });
  }, [items, q, sev]);

  const kpis = useMemo(() => {
    const openItems = filtered;
    const openCount = openItems.length;
    const highCount = openItems.filter((x) => x.severity === "high").length;

    const oldestMs = openItems.reduce((min: number, it: any) => {
      const ms = parseTime(it);
      if (!ms) return min;
      return min === 0 ? ms : Math.min(min, ms);
    }, 0);

    const oldestDays = daysAgo(oldestMs);

    return { openCount, highCount, oldestDays };
  }, [filtered]);

  const safeItems = useMemo(() => {
    return (filtered ?? []).filter(
      (it) => typeof it?.propertyId === "string" && typeof it?.id === "string"
    );
  }, [filtered]);

  const goToView = (it: ActionRequest) => {
    const usp = new URLSearchParams();
    usp.set("propertyId", it.propertyId);
    usp.set("panel", "actionRequests");
    usp.set("actionRequestId", it.id);
    nav(`/properties?${usp.toString()}`);
    onClose();
  };

  const goToFix = (it: ActionRequest) => {
    const action = fixActionForRequest(it);

    if (action.kind === "noop") {
      goToView(it);
      return;
    }

    if (action.kind === "navigate") {
      nav(action.to);
      onClose();
      return;
    }

    const usp = new URLSearchParams(action.search);
    nav(`${action.to}?${usp.toString()}`);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,6,23,0.35)",
          zIndex: 50,
        }}
      />

      <div
        className="rc-safe-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100dvh",
          width: "min(480px, 92vw)",
          background: "white",
          zIndex: 51,
          boxShadow: "0 25px 60px rgba(2,6,23,0.25)",
          borderLeft: "1px solid rgba(148,163,184,0.25)",
          display: "flex",
          flexDirection: "column",
          transform: "translateX(0)",
          transition: "transform 140ms ease",
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Action Center</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                System-detected tasks across your portfolio
              </div>
              <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>
                {refreshedAt ? `Last refreshed: ${new Date(refreshedAt).toLocaleString()}` : ""}
              </div>
            </div>

            <div className="rc-wrap-row">
              <button
                onClick={load}
                disabled={loading}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.35)",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 850,
                  fontSize: 12,
                  opacity: loading ? 0.7 : 1,
                }}
                title="Refresh"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>

              <button
                onClick={() => {
                  const rows = (filtered ?? []).map((it) => {
                    const label = propertyLabelById[it.propertyId];
                    const propName = label?.name || "";
                    const propSubtitle = label?.subtitle || "";
                    return {
                      id: it.id,
                      propertyId: it.propertyId,
                      propertyName: propName,
                      propertyAddress: propSubtitle,
                      status: it.status ?? "",
                      severity: it.severity ?? "",
                      source: it.source ?? "",
                      ruleKey: it.ruleKey ?? "",
                      issueType: it.issueType ?? "",
                      location: it.location ?? "",
                      description: it.description ?? "",
                      createdAt: it.createdAt ?? "",
                      updatedAt: it.updatedAt ?? "",
                      reportedAt: (it as any).reportedAt ?? "",
                    };
                  });

                  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
                  downloadCsv(`rentchain-action-center-${stamp}.csv`, rows);
                }}
                disabled={filtered.length === 0}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.35)",
                  background: "transparent",
                  cursor: filtered.length === 0 ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  fontSize: 12,
                  opacity: filtered.length === 0 ? 0.5 : 1,
                }}
                title="Export current view to CSV"
              >
                Export CSV
              </button>

              <button
                onClick={onClose}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.35)",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 850,
                  fontSize: 12,
                }}
                title="Close"
              >
                Close
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(148,163,184,0.08)",
                fontSize: 12,
                fontWeight: 900,
              }}
              title="Open tasks in current view"
            >
              Open tasks: {kpis.openCount}
            </div>

            <div
              style={{
                padding: "8px 10px",
                borderRadius: 14,
                border: "1px solid rgba(239,68,68,0.35)",
                background: "rgba(239,68,68,0.10)",
                color: "#dc2626",
                fontSize: 12,
                fontWeight: 900,
              }}
              title="High severity tasks in current view"
            >
              High severity: {kpis.highCount}
            </div>

            <div
              style={{
                padding: "8px 10px",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(148,163,184,0.08)",
                fontSize: 12,
                fontWeight: 900,
              }}
              title="Oldest open task age (days)"
            >
              Oldest open: {kpis.oldestDays === null ? "—" : `${kpis.oldestDays}d`}
            </div>
          </div>
        </div>

        <div style={{ padding: "0 16px 12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            style={{
              flex: "1 1 220px",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.35)",
              outline: "none",
              fontWeight: 650,
              fontSize: 13,
            }}
          />
          <select
            value={sev}
            onChange={(e) => setSev(e.target.value as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "white",
              fontWeight: 750,
              fontSize: 13,
              cursor: "pointer",
              minWidth: 140,
            }}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div style={{ padding: "0 16px 16px 16px", overflow: "auto" }}>
          {loading ? <div style={{ opacity: 0.75 }}>Loading…</div> : null}
          {err ? (
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(239,68,68,0.4)" }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Couldn’t load</div>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{err}</div>
            </div>
          ) : null}

          {!loading && !err && filtered.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No open tasks right now.</div>
          ) : null}

          <div style={{ display: "grid", gap: 10 }}>
            {safeItems.map((it) => {
              const pid = safeStr(it.propertyId);
              const label = pid ? propertyLabelById[pid] : undefined;
              const name = label?.name || (pid ? `Property ${shortId(pid, 8)}` : "Property");
              const subtitle = label?.subtitle;
              const isFixable = Boolean(it.ruleKey);

              return (
                <div
                  key={it.id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>
                      {it.issueType || it.ruleKey || "Action request"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {it.severity ? it.severity : "unknown"}
                      {it.source === "system" || it.ruleKey ? " • system" : ""}
                    </div>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, opacity: 0.9 }}>
                    {name}
                  </div>
                  {subtitle ? (
                    <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>{subtitle}</div>
                  ) : null}

                  {it.description ? (
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                      {it.description}
                    </div>
                  ) : null}

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                    <div style={{ fontSize: 12, opacity: 0.65 }}>
                      Status: {it.status ?? "new"} • ID: {shortId(it.id, 8)}
                  {(() => {
                    const age = daysAgo(parseTime(it));
                    const slaRisk = typeof age === "number" && age >= 14;
                    return slaRisk ? (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(245,158,11,0.35)",
                          background: "rgba(245,158,11,0.10)",
                          color: "#b45309",
                          fontSize: 11,
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                        title="This task has been open for 14+ days"
                      >
                        SLA risk
                      </span>
                    ) : null;
                  })()}
                </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => goToView(it)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.35)",
                          background: "transparent",
                          cursor: "pointer",
                          fontWeight: 850,
                          fontSize: 12,
                        }}
                        title="View"
                      >
                        View
                      </button>

                      {isFixable ? (
                        <button
                          type="button"
                          onClick={() => goToFix(it)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(239,68,68,0.45)",
                            background: "rgba(239,68,68,0.10)",
                            cursor: "pointer",
                            fontWeight: 900,
                            fontSize: 12,
                            color: "#dc2626",
                          }}
                          title="Fix"
                        >
                          Fix →
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
