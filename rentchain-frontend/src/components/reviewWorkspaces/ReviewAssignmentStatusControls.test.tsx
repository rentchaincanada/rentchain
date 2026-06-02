import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeReviewAssignmentTarget,
  normalizeReviewLifecycleStatus,
  ReviewAssignmentStatusControls,
} from "./ReviewAssignmentStatusControls";

afterEach(() => {
  cleanup();
});

describe("ReviewAssignmentStatusControls", () => {
  it("normalizes status and assignment metadata deterministically", () => {
    expect(normalizeReviewLifecycleStatus("under review")).toBe("in_review");
    expect(normalizeReviewLifecycleStatus("waiting_context")).toBe("awaiting_information");
    expect(normalizeReviewLifecycleStatus("completed")).toBe("resolved");
    expect(normalizeReviewLifecycleStatus("unknown-state")).toBe("open");

    expect(normalizeReviewAssignmentTarget("Finance review")).toBe("finance_reviewer");
    expect(normalizeReviewAssignmentTarget("Document reviewer")).toBe("document_reviewer");
    expect(normalizeReviewAssignmentTarget("")).toBe("unassigned");
    expect(normalizeReviewAssignmentTarget("Operations owned")).toBe("operations");
  });

  it("requires explicit confirmation for changes and does not render autonomous or mutation controls", () => {
    const onChange = vi.fn();
    render(
      <ReviewAssignmentStatusControls
        itemId="queue-item-1"
        title="Missing payment review"
        initialStatus="Open"
        initialAssignment="Unassigned"
        onChange={onChange}
      />
    );

    // Initially shows open status
    expect(screen.getByText("Manual status: Open")).toBeInTheDocument();
    expect(screen.getByText("Manual assignment: Unassigned")).toBeInTheDocument();

    // Make changes but they should be pending
    fireEvent.change(screen.getByLabelText("Review status for Missing payment review"), {
      target: { value: "awaiting_information" },
    });

    // Should show confirmation dialog instead of applying immediately
    expect(screen.getByRole('dialog', { name: /Confirm assignment changes/i })).toBeInTheDocument();
    expect(screen.getByText(/Change pending confirmation/i)).toBeInTheDocument();

    // onChange should not be called yet
    expect(onChange).not.toHaveBeenCalled();

    // Confirm the change
    fireEvent.click(screen.getByRole('button', { name: /Confirm changes/i }));

    // Now onChange should be called and status updated
    expect(onChange).toHaveBeenCalledWith({ status: "awaiting_information", assignment: "unassigned" });
    expect(screen.getByText("Manual status: Awaiting information")).toBeInTheDocument();
    expect(screen.getByText("Review status note: Waiting for supporting context or evidence.")).toBeInTheDocument();

    // Should not show autonomous controls
    expect(screen.queryByText(/auto.?assign/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?route/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?resolve/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mutate ledger/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/institutional sharing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tenant-visible review/i)).not.toBeInTheDocument();
  });

  it("meets WCAG 2.1 touch target requirements for mobile accessibility", () => {
    const { container } = render(
      <ReviewAssignmentStatusControls
        itemId="queue-item-1"
        title="Missing payment review"
        initialStatus="Open"
        initialAssignment="Unassigned"
      />
    );

    // Check that interactive elements have adequate touch target sizing
    const selectElements = container.querySelectorAll('select');
    selectElements.forEach(select => {
      const computedStyle = window.getComputedStyle(select);
      const minHeight = parseInt(computedStyle.minHeight, 10);
      expect(minHeight).toBeGreaterThanOrEqual(44); // WCAG 2.1 minimum
    });
  });

  it("includes proper aria attributes for form validation feedback", () => {
    render(
      <ReviewAssignmentStatusControls
        itemId="queue-item-1"
        title="Missing payment review"
        initialStatus="Open"
        initialAssignment="Unassigned"
      />
    );

    const statusSelect = screen.getByLabelText("Review status for Missing payment review");
    expect(statusSelect).toHaveAttribute('aria-describedby', 'queue-item-1-status-help');
    expect(statusSelect).toHaveAttribute('aria-invalid', 'false');

    const assignmentSelect = screen.getByLabelText("Assigned reviewer for Missing payment review");
    expect(assignmentSelect).toHaveAttribute('aria-describedby', 'queue-item-1-assignment-help');
    expect(assignmentSelect).toHaveAttribute('aria-invalid', 'false');
  });

  it("shows validation feedback when changes are pending", () => {
    render(
      <ReviewAssignmentStatusControls
        itemId="queue-item-1"
        title="Missing payment review"
        initialStatus="Open"
        initialAssignment="Unassigned"
      />
    );

    // Make a change
    fireEvent.change(screen.getByLabelText("Review status for Missing payment review"), {
      target: { value: "in_review" },
    });

    // Check that aria-invalid is updated and visual feedback is shown
    const statusSelect = screen.getByLabelText("Review status for Missing payment review");
    expect(statusSelect).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Change pending confirmation/i)).toBeInTheDocument();

    // Should show confirmation dialog with proper aria attributes
    const dialog = screen.getByRole('dialog', { name: /Confirm assignment changes/i });
    expect(dialog).toHaveAttribute('aria-labelledby', 'queue-item-1-confirmation-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'queue-item-1-confirmation-description');
  });

  it("allows canceling changes and restores original state", () => {
    render(
      <ReviewAssignmentStatusControls
        itemId="queue-item-1"
        title="Missing payment review"
        initialStatus="Open"
        initialAssignment="Unassigned"
      />
    );

    // Initially shows open status
    expect(screen.getByText("Manual status: Open")).toBeInTheDocument();

    // Make a change
    fireEvent.change(screen.getByLabelText("Review status for Missing payment review"), {
      target: { value: "blocked" },
    });

    // Should show pending state
    expect(screen.getByText("Manual status: Blocked")).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Cancel the change
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    // Should restore original state
    expect(screen.getByText("Manual status: Open")).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/Change pending confirmation/i)).not.toBeInTheDocument();
  });
});
