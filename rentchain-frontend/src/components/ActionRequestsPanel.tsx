import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchActionRequests,
  recomputeActionRequests,
  type ActionRequest,
} from "../api/actionRequestsApi";
import { fixActionForRequest } from "../services/actionRequestFixRouter";
import { asArray } from "../lib/asArray";

export function ActionRequestsPanel({
  propertyId,
  onCountChange,
  onAfterRecompute,
}: {
  propertyId: string;
  onCountChange?: (n: number) => void;
  onAfterRecompute?: () => void;
}) {
  const nav = useNavigate();
  const [items, setItems] = useState<ActionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openItems = useMemo(
    () => items.filter((x) => x.status !== "resolved"),
    [items]
  );

  const sorted = useMemo(() => {
    const rank = (s?: string) => {
      if (s === "high") return 0;
      if (s === "medium") return 1;
      if (s === "low") return 2;
      return 3;
    };
    return [...openItems].sort((a, b) => {
      const s = rank(a.severity as any) - rank(b.severity as any);
      if (s !== 0) return s;
      const at = String(a.createdAt ?? "");
      const bt = String(b.createdAt ?? "");
      return bt.localeCompare(at);
    });
  }, [openItems]);

  const load = async () => {
    if (!propertyId) {
      onCountChange?.(0);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchActionRequests(propertyId);
      const list = asArray<ActionRequest>(res?.actionRequests ?? res);
      setItems(list);
      onCountChange?.(list.filter((x) => x.status !== "resolved").length);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load action requests");
      onCountChange?.(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const onRecompute = async () => {
    if (!propertyId) return;
    setRecomputing(true);
    setErr(null);
    try {
      await recomputeActionRequests(propertyId);
      await load();
      onAfterRecompute?.();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to recompute action requests");
    } finally {
      setRecomputing(false);
    }
  };

  const onFix = (req: ActionRequest) => {
    const action = fixActionForRequest(req);

    if (action.kind === "noop") {
      setErr(action.reason);
      return;
    }

    if (action.kind === "navigate") {
      nav(action.to);
      return;
    }

    if (action.kind === "navigateWithSearch") {
      const usp = new URLSearchParams(action.search);
      nav(`${action.to}?${usp.toString()}`);
      return;
    }
  };

  return (
    <div
      style={{
        padding: 16,
        border: "1px solid rgba(148,163,184,0.25)",
        borderRadius: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 700 }}>Action requests</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={load}
            disabled={loading || recomputing}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.background = "rgba(15,23,42,0.06)";
            }}
            onMouseLeave={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.background = "transparent";
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 650,
              fontSize: 12,
              transition: "background 150ms ease",
            }}
            title="Reload"
          >
            {loading ? "Loading…" : "Reload"}
          </button>

          <button
            onClick={onRecompute}
            disabled={recomputing || loading}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.background = "rgba(15,23,42,0.06)";
            }}
            onMouseLeave={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.background = "transparent";
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 650,
              fontSize: 12,
              transition: "background 150ms ease",
            }}
            title="Recompute (dev)"
          >
            {recomputing ? "Recomputing…" : "Recompute"}
          </button>
        </div>
      </div>

      {loading && <div style={{ opacity: 0.8 }}>Loading…</div>}

      {err && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.4)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Couldn’t load</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{err}</div>
        </div>
      )}

      {!loading && !err && sorted.length === 0 && (
        <div style={{ opacity: 0.75 }}>
          No action requests yet for this property.
        </div>
      )}

      {!loading && !err && sorted.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((it) => (
            <div
              key={it.id}
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  {it.title ||
                    (it.ruleKey ? `System task: ${it.ruleKey}` : undefined) ||
                    it.issueType ||
                    "Action request"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {it.status || "new"}
                  {it.severity ? ` • ${it.severity}` : ""}
                  {it.source === "system" || it.ruleKey ? " • system" : ""}
                </div>
              </div>

              {it.description ? (
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                  {it.description}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 10,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  {it.ruleKey ? `Rule: ${it.ruleKey} • ` : ""}
                  ID: {it.id.slice(0, 10)}…
                </div>
                <button
                  onClick={() => onFix(it)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(15,23,42,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "transparent",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 12,
                    transition: "background 150ms ease",
                  }}
                  title="Fix this"
                >
                  Fix →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
