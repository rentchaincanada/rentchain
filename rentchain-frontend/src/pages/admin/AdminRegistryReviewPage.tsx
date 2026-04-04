import React, { memo, startTransition, useDeferredValue, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Input, Pill, Section } from "../../components/ui/Ui";
import {
  fetchAdminRegistryReview,
  fetchNextAdminRegistryReviewPage,
  type RegistryReviewItem,
} from "../../api/adminRegistryApi";

const REVIEW_STATUSES = ["all", "possible_match", "mismatch", "unmatched", "matched", "ignored"] as const;
const REVIEW_PAGE_SIZE = 50;

function formatLocation(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

const RegistryReviewQueueRow = memo(function RegistryReviewQueueRow({ item }: { item: RegistryReviewItem }) {
  const propertyAddress = item.property
    ? formatLocation([item.property.addressLine1, item.property.city, item.property.province, item.property.postalCode])
    : "";
  const candidateAddress = item.topCandidate
    ? formatLocation([item.topCandidate.addressLine1, item.topCandidate.city, item.topCandidate.province, item.topCandidate.postalCode])
    : "";

  return (
    <div style={{ border: "1px solid rgba(148,163,184,0.18)", borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{item.normalizedRecord?.addressRaw || item.match.registryRecordId}</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{item.normalizedRecord?.registrationNumber || item.match.registryRecordId}</div>
        </div>
        <Pill tone={item.match.matchStatus === "matched" ? "accent" : "muted"}>{item.match.matchStatus}</Pill>
      </div>
      <div style={{ color: "#475569", fontSize: 14 }}>
        Method: {item.match.matchMethod || "--"} · Score: {item.match.matchScore || 0}
      </div>
      <div style={{ color: "#475569", fontSize: 14 }}>
        Property: {item.property?.name || item.property?.addressLine1 || item.match.propertyId || "--"}
      </div>
      {item.property ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Property document ID: {item.property.id} · Property PID: {item.property.pid || "--"} · Address: {propertyAddress}
        </div>
      ) : null}
      {item.normalizedRecord ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Registry PID: {item.normalizedRecord.pid || "--"} · Registration number: {item.normalizedRecord.registrationNumber || "--"}
        </div>
      ) : null}
      {item.topCandidate ? (
        <div style={{ color: "#475569", fontSize: 14 }}>
          Top candidate: {item.topCandidate.propertyName || item.topCandidate.addressLine1 || item.topCandidate.propertyId}
        </div>
      ) : null}
      {item.topCandidate ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Property document ID: {item.topCandidate.propertyId} · Property PID: {item.topCandidate.pid || "--"} · Units:{" "}
          {item.topCandidate.unitCount ?? "--"} · Address: {candidateAddress}
        </div>
      ) : null}
      {item.match.propertyId ? (
        <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 600 }}>Currently linked property is active for this record.</div>
      ) : null}
      {item.reasonSummary?.length ? (
        <div style={{ color: "#92400e", fontSize: 14 }}>Review notes: {item.reasonSummary.join(" ")}</div>
      ) : null}
      {!item.property && item.topCandidate ? (
        <div style={{ color: "#475569", fontSize: 14 }}>Candidate score: {item.topCandidate.score}</div>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link to={`/admin/registry/records/${encodeURIComponent(item.match.normalizedRecordId)}`}>
          <Button variant="secondary">Open record</Button>
        </Link>
        {item.match.propertyId ? (
          <Link to={`/admin/registry/properties/${encodeURIComponent(item.match.propertyId)}`}>
            <Button variant="secondary">Open property review</Button>
          </Link>
        ) : item.topCandidate ? (
          <Link
            to={`/admin/registry/properties/${encodeURIComponent(item.topCandidate.propertyId)}?normalizedRecordId=${encodeURIComponent(
              item.match.normalizedRecordId
            )}`}
          >
            <Button variant="secondary">Open candidate review</Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
});

export default function AdminRegistryReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const matchStatus = searchParams.get("matchStatus") || "all";
  const searchQuery = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(searchQuery);
  const deferredSearchInput = useDeferredValue(searchInput);
  const [items, setItems] = useState<RegistryReviewItem[]>([]);
  const [summary, setSummary] = useState({
    all: 0,
    possible_match: 0,
    mismatch: 0,
    unmatched: 0,
    matched: 0,
    ignored: 0,
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const nextQuery = deferredSearchInput.trim();
      if (nextQuery === searchQuery) return;
      startTransition(() => {
        const nextParams: Record<string, string> = {};
        if (matchStatus !== "all") nextParams.matchStatus = matchStatus;
        if (nextQuery) nextParams.q = nextQuery;
        setSearchParams(nextParams);
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [deferredSearchInput, matchStatus, searchQuery, setSearchParams]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchAdminRegistryReview(matchStatus, searchQuery);
        if (!active) return;
        setItems(result.items);
        setSummary(result.summary);
        setNextCursor(result.pageInfo.nextCursor);
        setHasMore(result.pageInfo.hasMore);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load registry review queue");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [matchStatus, searchQuery]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      setError(null);
      const result = await fetchNextAdminRegistryReviewPage({
        matchStatus,
        searchQuery,
        pageSize: REVIEW_PAGE_SIZE,
        pageCursor: nextCursor,
      });
      setItems((current) => [...current, ...result.items]);
      setSummary(result.summary);
      setNextCursor(result.pageInfo.nextCursor);
      setHasMore(result.pageInfo.hasMore);
    } catch (err: any) {
      setError(err?.message || "Failed to load more review records");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <MacShell title="Admin · Registry Review">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Registry Review Queue</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Review unmatched, fuzzy, and mismatched Halifax rows before landlord-facing status is trusted.
              </div>
              <Input
                placeholder="Search by registry address, registration number, property name, property PID, or registry PID"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to="/admin/registry/imports">
                <Button variant="secondary">Back to imports</Button>
              </Link>
              {REVIEW_STATUSES.map((status) => (
                <Button
                  key={status}
                  variant={matchStatus === status ? "primary" : "secondary"}
                  onClick={() => {
                    const next: Record<string, string> = {};
                    if (status !== "all") next.matchStatus = status;
                    if (searchInput.trim()) next.q = searchInput.trim();
                    setSearchParams(next);
                  }}
                >
                  {status} ({summary[status as keyof typeof summary] ?? 0})
                </Button>
              ))}
            </div>
          </div>
        </Section>

        <Card style={{ display: "grid", gap: 12 }}>
          {!loading && items.length ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill tone="muted">Visible items: {items.length}</Pill>
              <Pill tone="muted">Filter: {matchStatus}</Pill>
              <Pill tone="muted">Queue total: {summary.all}</Pill>
              {searchQuery ? <Pill tone="muted">Search: {searchQuery}</Pill> : null}
              {matchStatus === "ignored" ? <Pill tone="muted">Ignored items can be returned to review from record detail.</Pill> : null}
            </div>
          ) : null}
          {loading ? <div>Loading registry review queue…</div> : null}
          {!loading && error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
          {!loading && !items.length ? (
            <div style={{ color: "#475569" }}>
              {searchQuery ? "No registry records matched this search and filter combination." : "No registry records match this review state."}
            </div>
          ) : null}
          {loading && !items.length
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  style={{
                    border: "1px solid rgba(148,163,184,0.12)",
                    borderRadius: 16,
                    padding: 16,
                    display: "grid",
                    gap: 10,
                    background: "linear-gradient(90deg, rgba(248,250,252,0.9), rgba(241,245,249,0.9), rgba(248,250,252,0.9))",
                  }}
                >
                  <div style={{ width: "45%", height: 14, borderRadius: 999, background: "rgba(148,163,184,0.18)" }} />
                  <div style={{ width: "65%", height: 12, borderRadius: 999, background: "rgba(148,163,184,0.12)" }} />
                  <div style={{ width: "55%", height: 12, borderRadius: 999, background: "rgba(148,163,184,0.12)" }} />
                </div>
              ))
            : null}
          {items.map((item) => (
            <RegistryReviewQueueRow key={item.match.id} item={item} />
          ))}
          {!loading && hasMore ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? "Loading more…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </MacShell>
  );
}
