import React from "react";

export type ReviewLifecycleStatus =
  | "open"
  | "needs_review"
  | "in_review"
  | "awaiting_information"
  | "blocked"
  | "resolved"
  | "closed";

export type ReviewAssignmentTarget =
  | "unassigned"
  | "operations"
  | "property_manager"
  | "finance_reviewer"
  | "document_reviewer"
  | "screening_reviewer";

type ReviewStatusOption = {
  value: ReviewLifecycleStatus;
  label: string;
  description: string;
};

type AssignmentOption = {
  value: ReviewAssignmentTarget;
  label: string;
  reason: string;
};

export const REVIEW_STATUS_OPTIONS: ReviewStatusOption[] = [
  { value: "open", label: "Open", description: "Ready for manual review intake." },
  { value: "needs_review", label: "Needs review", description: "Requires operator attention before routing decisions." },
  { value: "in_review", label: "In review", description: "Operator review is actively underway." },
  { value: "awaiting_information", label: "Awaiting information", description: "Waiting for supporting context or evidence." },
  { value: "blocked", label: "Blocked", description: "Cannot progress until a manual blocker is cleared." },
  { value: "resolved", label: "Resolved", description: "Operational review item is resolved by staff." },
  { value: "closed", label: "Closed", description: "Manual review handling is closed." },
];

export const REVIEW_ASSIGNMENT_OPTIONS: AssignmentOption[] = [
  { value: "unassigned", label: "Unassigned", reason: "No manual owner selected." },
  { value: "operations", label: "Operations owned", reason: "Operations team owns the next manual review step." },
  { value: "property_manager", label: "Property manager", reason: "Property manager owns the next manual review step." },
  { value: "finance_reviewer", label: "Finance reviewer", reason: "Finance reviewer owns the next manual review step." },
  { value: "document_reviewer", label: "Document reviewer", reason: "Document reviewer owns the next manual review step." },
  { value: "screening_reviewer", label: "Screening reviewer", reason: "Screening reviewer owns the next manual review step." },
];

function normalizeToken(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function normalizeReviewLifecycleStatus(value: string | null | undefined): ReviewLifecycleStatus {
  const token = normalizeToken(value || "");
  if (token === "needs_review" || token === "review_needed" || token === "manual_review") return "needs_review";
  if (token === "in_review" || token === "under_review") return "in_review";
  if (token === "awaiting_information" || token === "waiting_context" || token === "waiting_information") {
    return "awaiting_information";
  }
  if (token === "blocked") return "blocked";
  if (token === "resolved" || token === "completed") return "resolved";
  if (token === "closed" || token === "abandoned") return "closed";
  return "open";
}

export function normalizeReviewAssignmentTarget(value: string | null | undefined): ReviewAssignmentTarget {
  const token = normalizeToken(value || "");
  if (!token || token === "unassigned") return "unassigned";
  if (token.includes("finance")) return "finance_reviewer";
  if (token.includes("document")) return "document_reviewer";
  if (token.includes("screening")) return "screening_reviewer";
  if (token.includes("property")) return "property_manager";
  if (token.includes("operation")) return "operations";
  return "operations";
}

export function reviewStatusLabel(value: ReviewLifecycleStatus) {
  return REVIEW_STATUS_OPTIONS.find((option) => option.value === value)?.label || "Open";
}

export function reviewAssignmentLabel(value: ReviewAssignmentTarget) {
  return REVIEW_ASSIGNMENT_OPTIONS.find((option) => option.value === value)?.label || "Unassigned";
}

function selectedStatusDescription(value: ReviewLifecycleStatus) {
  return REVIEW_STATUS_OPTIONS.find((option) => option.value === value)?.description || REVIEW_STATUS_OPTIONS[0].description;
}

function selectedAssignmentReason(value: ReviewAssignmentTarget) {
  return REVIEW_ASSIGNMENT_OPTIONS.find((option) => option.value === value)?.reason || REVIEW_ASSIGNMENT_OPTIONS[0].reason;
}

export function ReviewAssignmentStatusControls({
  itemId,
  title,
  initialStatus,
  initialAssignment,
  onChange,
}: {
  itemId: string;
  title: string;
  initialStatus: string;
  initialAssignment: string;
  onChange?: (next: { status: ReviewLifecycleStatus; assignment: ReviewAssignmentTarget }) => void;
}) {
  const [status, setStatus] = React.useState<ReviewLifecycleStatus>(() => normalizeReviewLifecycleStatus(initialStatus));
  const [assignment, setAssignment] = React.useState<ReviewAssignmentTarget>(() =>
    normalizeReviewAssignmentTarget(initialAssignment)
  );

  React.useEffect(() => {
    setStatus(normalizeReviewLifecycleStatus(initialStatus));
  }, [initialStatus]);

  React.useEffect(() => {
    setAssignment(normalizeReviewAssignmentTarget(initialAssignment));
  }, [initialAssignment]);

  function updateStatus(nextStatus: ReviewLifecycleStatus) {
    setStatus(nextStatus);
    onChange?.({ status: nextStatus, assignment });
  }

  function updateAssignment(nextAssignment: ReviewAssignmentTarget) {
    setAssignment(nextAssignment);
    onChange?.({ status, assignment: nextAssignment });
  }

  return (
    <section
      aria-label={`Manual review lifecycle controls for ${title}`}
      style={{
        border: "1px solid #dbe3ef",
        borderRadius: 8,
        background: "#f8fafc",
        padding: 10,
        display: "grid",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ display: "grid", gap: 3 }}>
        <strong style={{ color: "#0f172a", fontSize: 13 }}>Manual review controls</strong>
        <span style={{ color: "#475569", fontSize: 12, lineHeight: 1.45 }}>
          Assignment and status selections are manual review metadata only. They do not route work automatically, change source
          records, or alter financial status.
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 8 }}>
        <label style={controlLabelStyle}>
          Manual review status
          <select
            aria-label={`Review status for ${title}`}
            value={status}
            onChange={(event) => updateStatus(event.target.value as ReviewLifecycleStatus)}
            style={selectStyle}
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={controlLabelStyle}>
          Assigned reviewer
          <select
            aria-label={`Assigned reviewer for ${title}`}
            value={assignment}
            onChange={(event) => updateAssignment(event.target.value as ReviewAssignmentTarget)}
            style={selectStyle}
          >
            {REVIEW_ASSIGNMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div id={`${itemId}-manual-review-summary`} style={{ display: "grid", gap: 3, color: "#334155", fontSize: 12 }}>
        <span>Manual status: {reviewStatusLabel(status)}</span>
        <span>Manual assignment: {reviewAssignmentLabel(assignment)}</span>
        <span>Assignment reason: {selectedAssignmentReason(assignment)}</span>
        <span>Review status note: {selectedStatusDescription(status)}</span>
      </div>
    </section>
  );
}

const controlLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#334155",
  fontSize: 12,
  fontWeight: 900,
};

const selectStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#0f172a",
  background: "#fff",
  minWidth: 0,
  width: "100%",
};
