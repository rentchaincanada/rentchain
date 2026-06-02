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
  const [pendingChanges, setPendingChanges] = React.useState<boolean>(false);
  const [showConfirmation, setShowConfirmation] = React.useState<boolean>(false);
  const [pendingStatus, setPendingStatus] = React.useState<ReviewLifecycleStatus | null>(null);
  const [pendingAssignment, setPendingAssignment] = React.useState<ReviewAssignmentTarget | null>(null);

  React.useEffect(() => {
    setStatus(normalizeReviewLifecycleStatus(initialStatus));
  }, [initialStatus]);

  React.useEffect(() => {
    setAssignment(normalizeReviewAssignmentTarget(initialAssignment));
  }, [initialAssignment]);

  function updateStatus(nextStatus: ReviewLifecycleStatus) {
    if (nextStatus !== status) {
      setPendingStatus(nextStatus);
      setPendingChanges(true);
      setShowConfirmation(true);
    }
  }

  function updateAssignment(nextAssignment: ReviewAssignmentTarget) {
    if (nextAssignment !== assignment) {
      setPendingAssignment(nextAssignment);
      setPendingChanges(true);
      setShowConfirmation(true);
    }
  }

  function confirmChanges() {
    if (pendingStatus !== null) {
      setStatus(pendingStatus);
      onChange?.({ status: pendingStatus, assignment });
    }
    if (pendingAssignment !== null) {
      setAssignment(pendingAssignment);
      onChange?.({ status, assignment: pendingAssignment });
    }
    resetPendingState();
  }

  function cancelChanges() {
    resetPendingState();
  }

  function resetPendingState() {
    setPendingStatus(null);
    setPendingAssignment(null);
    setPendingChanges(false);
    setShowConfirmation(false);
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
        <label style={controlLabelStyle}>
          Manual review status
          <select
            aria-label={`Review status for ${title}`}
            aria-describedby={`${itemId}-status-help`}
            aria-invalid={pendingChanges && pendingStatus !== null}
            value={pendingStatus ?? status}
            onChange={(event) => updateStatus(event.target.value as ReviewLifecycleStatus)}
            style={{
              ...selectStyle,
              borderColor: pendingChanges && pendingStatus !== null ? "#f59e0b" : "#cbd5e1",
              backgroundColor: pendingChanges && pendingStatus !== null ? "#fffbeb" : "#fff",
            }}
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span id={`${itemId}-status-help`} style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
            {pendingChanges && pendingStatus !== null ? "Change pending confirmation" : selectedStatusDescription(status)}
          </span>
        </label>
        <label style={controlLabelStyle}>
          Assigned reviewer
          <select
            aria-label={`Assigned reviewer for ${title}`}
            aria-describedby={`${itemId}-assignment-help`}
            aria-invalid={pendingChanges && pendingAssignment !== null}
            value={pendingAssignment ?? assignment}
            onChange={(event) => updateAssignment(event.target.value as ReviewAssignmentTarget)}
            style={{
              ...selectStyle,
              borderColor: pendingChanges && pendingAssignment !== null ? "#f59e0b" : "#cbd5e1",
              backgroundColor: pendingChanges && pendingAssignment !== null ? "#fffbeb" : "#fff",
            }}
          >
            {REVIEW_ASSIGNMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span id={`${itemId}-assignment-help`} style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
            {pendingChanges && pendingAssignment !== null ? "Change pending confirmation" : selectedAssignmentReason(assignment)}
          </span>
        </label>
      </div>
      <div id={`${itemId}-manual-review-summary`} style={{ display: "grid", gap: 3, color: "#334155", fontSize: 13, lineHeight: 1.4 }}>
        <span>Manual status: {reviewStatusLabel(pendingStatus ?? status)}</span>
        <span>Manual assignment: {reviewAssignmentLabel(pendingAssignment ?? assignment)}</span>
        <span>Assignment reason: {selectedAssignmentReason(pendingAssignment ?? assignment)}</span>
        <span>Review status note: {selectedStatusDescription(pendingStatus ?? status)}</span>
      </div>

      {showConfirmation && (
        <div
          role="dialog"
          aria-labelledby={`${itemId}-confirmation-title`}
          aria-describedby={`${itemId}-confirmation-description`}
          style={{
            border: "2px solid #f59e0b",
            borderRadius: 8,
            background: "#fffbeb",
            padding: 12,
            display: "grid",
            gap: 10,
            marginTop: 8,
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <strong id={`${itemId}-confirmation-title`} style={{ color: "#92400e", fontSize: 14 }}>
              Confirm assignment changes
            </strong>
            <p id={`${itemId}-confirmation-description`} style={{ color: "#92400e", fontSize: 13, lineHeight: 1.4, margin: 0 }}>
              You're about to update the manual review assignment. This change will be recorded in the audit trail but does not alter source records or route work automatically.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={confirmChanges}
              style={{
                backgroundColor: "#059669",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
                minWidth: 80,
              }}
              aria-describedby={`${itemId}-confirm-help`}
            >
              Confirm changes
            </button>
            <button
              onClick={cancelChanges}
              style={{
                backgroundColor: "#6b7280",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
                minWidth: 80,
              }}
              aria-describedby={`${itemId}-cancel-help`}
            >
              Cancel
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
            <span id={`${itemId}-confirm-help`} style={{ display: "block" }}>
              Confirm: Apply the assignment changes and record in audit trail.
            </span>
            <span id={`${itemId}-cancel-help`} style={{ display: "block" }}>
              Cancel: Discard changes and keep current assignment settings.
            </span>
          </div>
        </div>
      )}
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
  padding: "12px 14px",
  color: "#0f172a",
  background: "#fff",
  minWidth: 0,
  width: "100%",
  minHeight: 44,
  fontSize: 14,
  lineHeight: 1.4,
};
