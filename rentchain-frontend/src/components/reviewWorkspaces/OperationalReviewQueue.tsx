import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Ui";
import {
  ReviewAssignmentStatusControls,
  type ReviewAssignmentTarget,
  type ReviewLifecycleStatus,
} from "./ReviewAssignmentStatusControls";

export type OperationalReviewQueueItem = {
  queueItemId: string;
  title: string;
  contextLabel: string;
  sourceLabel: string;
  destination: string;
  workspaceType: string;
  reviewStatus: string;
  reviewPriority: string;
  routingReason: string;
  assignmentLabel: string;
  workflowStatus: string;
  financialStatus?: string | null;
  sensitivityClass: string;
  visibilityClass: string;
  evidenceLabel: string;
  relatedResourceLabel: string;
  manualReviewScope: string;
  manualReviewScopeId: string;
  manualOnly: true;
  autonomousActionsEnabled: false;
};

function label(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeDisplayLabel(value: string, fallback: string) {
  const raw = String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  if (/^(Lease|Property|Tenant|Unit|Decision)\s+[A-Za-z0-9:_-]{12,}$/i.test(raw)) return fallback;
  return raw;
}

function metadata(labelText: string, value: string | null | undefined) {
  if (!value) return null;
  return (
    <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
      <span style={{ color: "#64748b", fontSize: 13, fontWeight: 900, textTransform: "uppercase", lineHeight: 1.4 }}>{labelText}</span>
      <span style={{ color: "#0f172a", fontSize: 15, fontWeight: 900, overflowWrap: "anywhere", lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

function compactMetadata(labelText: string, value: string | null | undefined) {
  if (!value) return null;
  return (
    <span style={{ color: "#334155", fontSize: 13, fontWeight: 800, lineHeight: 1.35 }}>
      {labelText}: {value}
    </span>
  );
}

function displayForItem(item: OperationalReviewQueueItem) {
  return {
    title: safeDisplayLabel(item.title, "Operational review item"),
    context: safeDisplayLabel(item.contextLabel, "Operational review context"),
    workspaceType: label(item.workspaceType),
    sensitivity: label(item.sensitivityClass),
    visibility: label(item.visibilityClass),
    evidence: safeDisplayLabel(item.evidenceLabel, "Open source workflow evidence"),
    relatedResource: safeDisplayLabel(item.relatedResourceLabel, "Scoped resource context"),
  };
}

function metadataItemsForItem(item: OperationalReviewQueueItem, display: ReturnType<typeof displayForItem>) {
  return [
    { labelText: "Routing reason", value: item.routingReason },
    { labelText: "Source", value: item.sourceLabel },
    { labelText: "Review status", value: item.reviewStatus },
    { labelText: "Assignment", value: item.assignmentLabel },
    { labelText: "Workflow status", value: item.workflowStatus },
    { labelText: "Financial status", value: item.financialStatus || null },
    { labelText: "Sensitivity", value: display.sensitivity },
    { labelText: "Visibility", value: display.visibility },
  ];
}

const REVIEW_CARD_MIN_WIDTH = 280;
const REVIEW_CARD_GRID_GAP = 10;

function cardsPerReviewRowForWidth(width: number) {
  if (!Number.isFinite(width) || width <= 0) return 2;
  return Math.max(1, Math.floor((width + REVIEW_CARD_GRID_GAP) / (REVIEW_CARD_MIN_WIDTH + REVIEW_CARD_GRID_GAP)));
}

function chunkReviewRows<T>(items: T[], cardsPerRow: number) {
  const size = Math.max(1, cardsPerRow);
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

const OperationalReviewQueueCard = memo(function OperationalReviewQueueCard({
  item,
  isExpanded,
  onToggleDetails,
}: {
  item: OperationalReviewQueueItem;
  isExpanded: boolean;
  onToggleDetails: (item: OperationalReviewQueueItem) => void;
}) {
  const display = useMemo(
    () => displayForItem(item),
    [
      item.contextLabel,
      item.evidenceLabel,
      item.relatedResourceLabel,
      item.sensitivityClass,
      item.title,
      item.visibilityClass,
      item.workspaceType,
    ]
  );

  return (
    <Card
      style={{
        borderRadius: 8,
        padding: 12,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        display: "grid",
        gap: 12,
        minWidth: 0,
        overflowWrap: "anywhere",
      }}
    >
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pillStyle("#fef3c7", "#92400e", "#fde68a")}>{item.reviewPriority}</span>
          <span style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>{display.workspaceType}</span>
        </div>
        <strong style={{ color: "#0f172a", fontSize: 15 }}>{display.title}</strong>
        <span style={{ color: "#475569", fontSize: 13 }}>{display.context}</span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          minWidth: 0,
        }}
      >
        {compactMetadata("Manual status", item.reviewStatus)}
        {compactMetadata("Assigned reviewer", item.assignmentLabel)}
      </div>

      <Link to={item.destination} style={{
        color: "#2563eb",
        fontSize: 14,
        fontWeight: 900,
        padding: "8px 0",
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        textDecoration: "none",
        borderRadius: 4,
        width: "fit-content"
      }}>
        {display.evidence}
      </Link>

      <button
        type="button"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Hide details and manual controls" : "Details and manual controls"} for ${display.title}`}
        onClick={() => onToggleDetails(item)}
        style={{
          border: `1px solid ${isExpanded ? "#93c5fd" : "#dbe3ef"}`,
          background: isExpanded ? "#eff6ff" : "#ffffff",
          color: "#1d4ed8",
          borderRadius: 6,
          padding: "8px 12px",
          minHeight: 44,
          width: "fit-content",
          fontSize: 13,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        {isExpanded ? "Hide details and manual controls" : "Details and manual controls"}
      </button>
    </Card>
  );
});

const OperationalReviewQueueDetailsPanel = memo(function OperationalReviewQueueDetailsPanel({
  item,
  onManualReviewChange,
  onClose,
}: {
  item: OperationalReviewQueueItem;
  onManualReviewChange?: (
    item: OperationalReviewQueueItem,
    next: { status: ReviewLifecycleStatus; assignment: ReviewAssignmentTarget }
  ) => void | Promise<void>;
  onClose: () => void;
}) {
  const display = useMemo(
    () => displayForItem(item),
    [
      item.contextLabel,
      item.evidenceLabel,
      item.relatedResourceLabel,
      item.sensitivityClass,
      item.title,
      item.visibilityClass,
      item.workspaceType,
    ]
  );
  const metadataItems = useMemo(
    () => metadataItemsForItem(item, display),
    [
      display,
      item.assignmentLabel,
      item.financialStatus,
      item.reviewStatus,
      item.routingReason,
      item.sourceLabel,
      item.workflowStatus,
    ]
  );

  return (
    <Card
      data-testid="operational-review-details-panel"
      style={{
        borderRadius: 10,
        padding: 14,
        border: "1px solid #bfdbfe",
        background: "#f8fbff",
        display: "grid",
        gap: 12,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
          <span style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
            Details and manual controls
          </span>
          <strong style={{ color: "#0f172a", fontSize: 16, overflowWrap: "anywhere" }}>{display.title}</strong>
          <span style={{ color: "#475569", fontSize: 13, lineHeight: 1.5 }}>{display.context}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            borderRadius: 6,
            padding: "8px 12px",
            minHeight: 44,
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Close details
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
          gap: 10,
          minWidth: 0,
        }}
      >
        {metadataItems.map((entry) => (
          <React.Fragment key={entry.labelText}>{metadata(entry.labelText, entry.value)}</React.Fragment>
        ))}
      </div>

      <ReviewAssignmentStatusControls
        itemId={item.queueItemId}
        title={display.title}
        initialStatus={item.reviewStatus}
        initialAssignment={item.assignmentLabel}
        onChange={(next) => onManualReviewChange?.(item, next)}
      />

      <div style={{ display: "grid", gap: 5 }}>
        <span style={{ color: "#334155", fontSize: 12, fontWeight: 900 }}>Related resource context</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span
            style={{
              border: "1px solid #dbe3ef",
              borderRadius: 999,
              padding: "8px 12px",
              color: "#475569",
              fontSize: 13,
              fontWeight: 800,
              background: "#fff",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              lineHeight: 1.4,
            }}
          >
            {display.relatedResource}
          </span>
        </div>
      </div>
    </Card>
  );
});

export const OperationalReviewQueue = memo(function OperationalReviewQueue({
  items,
  onManualReviewChange,
}: {
  items: OperationalReviewQueueItem[];
  onManualReviewChange?: (
    item: OperationalReviewQueueItem,
    next: { status: ReviewLifecycleStatus; assignment: ReviewAssignmentTarget }
  ) => void | Promise<void>;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [cardsPerRow, setCardsPerRow] = useState(2);
  const assignedCount = useMemo(
    () => items.filter((item) => !/^unassigned$/i.test(item.assignmentLabel)).length,
    [items]
  );
  const expandedItem = useMemo(
    () => items.find((item) => item.queueItemId === expandedItemId) || null,
    [expandedItemId, items]
  );
  const itemRows = useMemo(() => chunkReviewRows(items, cardsPerRow), [cardsPerRow, items]);

  useEffect(() => {
    if (expandedItemId && !expandedItem) {
      setExpandedItemId(null);
    }
  }, [expandedItem, expandedItemId]);

  useEffect(() => {
    const updateCardsPerRow = () => {
      setCardsPerRow(cardsPerReviewRowForWidth(gridRef.current?.clientWidth || 0));
    };

    updateCardsPerRow();

    if (typeof ResizeObserver !== "undefined" && gridRef.current) {
      const observer = new ResizeObserver(updateCardsPerRow);
      observer.observe(gridRef.current);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateCardsPerRow);
    return () => window.removeEventListener("resize", updateCardsPerRow);
  }, []);

  const handleToggleDetails = React.useCallback((item: OperationalReviewQueueItem) => {
    setExpandedItemId((current) => (current === item.queueItemId ? null : item.queueItemId));
  }, []);

  return (
    <Card
      data-testid="operational-review-queue"
      style={{
        borderRadius: 10,
        padding: 14,
        border: "1px solid #dbe3ef",
        background: "#ffffff",
        display: "grid",
        gap: 12,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <strong style={{ color: "#0f172a", fontSize: 16 }}>Operational review queue</strong>
          <span style={{ color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
            Manual intake visibility for reviewable operational work. This queue does not create workspaces, route work automatically,
            or change source records.
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pillStyle("#dbeafe", "#1d4ed8", "#bfdbfe")}>{items.length} reviewable</span>
          <span style={pillStyle("#f8fafc", "#475569", "#dbe3ef")}>{assignedCount} assigned</span>
        </div>
      </div>

      {items.length ? (
        <div
          data-testid="operational-review-card-grid"
          ref={gridRef}
          style={{
            display: "grid",
            gap: 10,
            minWidth: 0,
          }}
        >
          {itemRows.map((row, rowIndex) => {
            const rowHasExpandedItem = row.some((item) => item.queueItemId === expandedItemId);
            return (
              <React.Fragment key={row.map((item) => item.queueItemId).join("|") || rowIndex}>
                <div
                  data-testid="operational-review-card-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  {row.map((item) => (
                    <OperationalReviewQueueCard
                      key={item.queueItemId}
                      item={item}
                      isExpanded={expandedItemId === item.queueItemId}
                      onToggleDetails={handleToggleDetails}
                    />
                  ))}
                </div>
                {rowHasExpandedItem && expandedItem ? (
                  <OperationalReviewQueueDetailsPanel
                    item={expandedItem}
                    onManualReviewChange={onManualReviewChange}
                    onClose={() => setExpandedItemId(null)}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
          No reviewable operational queue items match the current filters. Adjust the triage view or reset filters to review the full
          operational queue.
        </div>
      )}
    </Card>
  );
});

function pillStyle(background: string, color: string, border: string): React.CSSProperties {
  return {
    border: `1px solid ${border}`,
    background,
    color,
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
    minHeight: 44,
    minWidth: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
