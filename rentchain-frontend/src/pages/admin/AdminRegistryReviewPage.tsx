import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Input, Pill, Section } from "../../components/ui/Ui";
import { RegistryReviewQueueRow } from "../../components/admin/RegistryReviewQueueRow";
import {
  fetchAdminRegistryReview,
  fetchNextAdminRegistryReviewPage,
  type RegistryReviewItem,
} from "../../api/adminRegistryApi";

const REVIEW_STATUSES = ["all", "possible_match", "mismatch", "unmatched", "matched", "ignored"] as const;
const REVIEW_PAGE_SIZE = 50;
const VIRTUAL_LIST_HEIGHT = 720;
const VIRTUAL_ROW_ESTIMATE = 260;
const VIRTUAL_ROW_GAP = 12;
const VIRTUAL_OVERSCAN = 3;

type HeightMap = Record<string, number>;

function MeasuredVirtualRow(props: {
  item: RegistryReviewItem;
  top: number;
  setHeightMap: React.Dispatch<React.SetStateAction<HeightMap>>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      const nextHeight = Math.max(Math.ceil(node.getBoundingClientRect().height || 0), VIRTUAL_ROW_ESTIMATE);
      props.setHeightMap((current) => (current[props.item.match.id] === nextHeight ? current : { ...current, [props.item.match.id]: nextHeight }));
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [props.item, props.item.match.id, props.setHeightMap]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: props.top,
        left: 0,
        right: 0,
      }}
    >
      <RegistryReviewQueueRow item={props.item} />
    </div>
  );
}

function VirtualizedRegistryReviewList(props: {
  items: RegistryReviewItem[];
  resetKey: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(VIRTUAL_LIST_HEIGHT);
  const [heightMap, setHeightMap] = useState<HeightMap>({});

  useEffect(() => {
    setHeightMap({});
    setScrollTop(0);
    const node = containerRef.current;
    if (node) node.scrollTop = 0;
  }, [props.resetKey]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measureViewport = () => {
      setViewportHeight(node.clientHeight > 0 ? node.clientHeight : VIRTUAL_LIST_HEIGHT);
    };

    measureViewport();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureViewport);
      return () => window.removeEventListener("resize", measureViewport);
    }

    const observer = new ResizeObserver(() => measureViewport());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const itemMetrics: Array<{ item: RegistryReviewItem; top: number; height: number }> = [];
  let totalHeight = 0;
  for (const item of props.items) {
    const height = heightMap[item.match.id] || VIRTUAL_ROW_ESTIMATE;
    itemMetrics.push({ item, top: totalHeight, height });
    totalHeight += height + VIRTUAL_ROW_GAP;
  }
  totalHeight = Math.max(totalHeight - VIRTUAL_ROW_GAP, 0);

  const viewportBottom = scrollTop + viewportHeight;
  let startIndex = 0;
  while (startIndex < itemMetrics.length && itemMetrics[startIndex].top + itemMetrics[startIndex].height < scrollTop) {
    startIndex += 1;
  }
  startIndex = Math.max(0, startIndex - VIRTUAL_OVERSCAN);

  let endIndex = startIndex;
  while (endIndex < itemMetrics.length && itemMetrics[endIndex].top < viewportBottom) {
    endIndex += 1;
  }
  endIndex = Math.min(itemMetrics.length, endIndex + VIRTUAL_OVERSCAN);

  const visibleItems = itemMetrics.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      aria-label="Registry review queue list"
      style={{
        position: "relative",
        overflowY: "auto",
        maxHeight: VIRTUAL_LIST_HEIGHT,
        minHeight: Math.min(VIRTUAL_LIST_HEIGHT, Math.max(280, props.items.length * 120)),
        paddingRight: 4,
      }}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
      }}
    >
      <div style={{ position: "relative", height: totalHeight }}>
        {visibleItems.map((entry) => (
          <MeasuredVirtualRow
            key={entry.item.match.id}
            item={entry.item}
            top={entry.top}
            setHeightMap={setHeightMap}
          />
        ))}
      </div>
    </div>
  );
}

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

  const resetKey = `${matchStatus}:${searchQuery}`;

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
          {!loading && items.length ? <VirtualizedRegistryReviewList items={items} resetKey={resetKey} /> : null}
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
