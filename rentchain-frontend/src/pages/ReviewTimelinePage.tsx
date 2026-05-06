import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchReviewTimeline,
  type CanonicalReviewTimeline as Timeline,
  type ReviewTimelineEntryStatus,
  type ReviewTimelineEntryType,
  type ReviewTimelineScope,
  type ReviewTimelineSource,
} from "@/api/reviewTimelineApi";
import { MacShell } from "@/components/layout/MacShell";
import { CanonicalReviewTimeline } from "@/components/reviewTimeline/CanonicalReviewTimeline";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const scopeOptions: ReviewTimelineScope[] = [
  "decision",
  "workflow",
  "operator_review",
  "evidence_pack",
  "institution_export",
  "audit_compliance",
  "lease",
  "property",
  "delinquency",
  "maintenance",
  "admin_review",
];

function isScope(value: string | null): value is ReviewTimelineScope {
  return Boolean(value && scopeOptions.includes(value as ReviewTimelineScope));
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load review timeline";
}

export default function ReviewTimelinePage() {
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();
  const initialScope = params.get("scope");
  const [scope, setScope] = React.useState<ReviewTimelineScope>(isScope(initialScope) ? initialScope : "decision");
  const [scopeId, setScopeId] = React.useState(params.get("scopeId") || "");
  const [entryType, setEntryType] = React.useState<ReviewTimelineEntryType | "all">("all");
  const [status, setStatus] = React.useState<ReviewTimelineEntryStatus | "all">("all");
  const [source, setSource] = React.useState<ReviewTimelineSource | "all">("all");
  const [data, setData] = React.useState<Timeline | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadTimeline = React.useCallback(async () => {
    if (!scopeId.trim()) {
      setError("Scope ID is required for review timeline.");
      setData(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const timeline = await fetchReviewTimeline({ scope, scopeId: scopeId.trim(), entryType, status, source });
      setData(timeline);
      const next = new URLSearchParams({ scope, scopeId: scopeId.trim() });
      if (entryType !== "all") next.set("entryType", entryType);
      if (status !== "all") next.set("status", status);
      if (source !== "all") next.set("source", source);
      setParams(next);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      showToast({ message: "Failed to load review timeline", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [entryType, scope, scopeId, setParams, showToast, source, status]);

  React.useEffect(() => {
    if (params.get("scopeId")) void loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MacShell title="Canonical review timeline" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Canonical review timeline</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Read-only operational review timeline. Timeline entries are audit oriented and manually reviewable. No
              automated approval or certification occurs.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Scope
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as ReviewTimelineScope)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 200 }}
            >
              {scopeOptions.map((option) => (
                <option key={option} value={option}>
                  {label(option)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Scope ID
            <input
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 240 }}
            />
          </label>
          <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Entry type
            <select
              value={entryType}
              onChange={(event) => setEntryType(event.target.value as ReviewTimelineEntryType | "all")}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 190 }}
            >
              <option value="all">All</option>
              {data?.filters.entryType.map((option) => <option key={option} value={option}>{label(option)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ReviewTimelineEntryStatus | "all")}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 170 }}
            >
              <option value="all">All</option>
              {data?.filters.status.map((option) => <option key={option} value={option}>{label(option)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Source
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as ReviewTimelineSource | "all")}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 190 }}
            >
              <option value="all">All</option>
              {data?.filters.source.map((option) => <option key={option} value={option}>{label(option)}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={loadTimeline}
            disabled={loading || !scopeId.trim()}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontWeight: 900, background: "#fff" }}
          >
            Filter timeline
          </button>
        </Section>

        {loading ? <Card>Loading review timeline...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}
        {!loading && !error && data ? <CanonicalReviewTimeline timeline={data} /> : null}
      </div>
    </MacShell>
  );
}
