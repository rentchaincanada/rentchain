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

  it("updates manual metadata only and does not render autonomous or mutation controls", () => {
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

    fireEvent.change(screen.getByLabelText("Review status for Missing payment review"), {
      target: { value: "awaiting_information" },
    });
    fireEvent.change(screen.getByLabelText("Assigned reviewer for Missing payment review"), {
      target: { value: "finance_reviewer" },
    });

    expect(onChange).toHaveBeenCalledWith({ status: "awaiting_information", assignment: "unassigned" });
    expect(onChange).toHaveBeenCalledWith({ status: "awaiting_information", assignment: "finance_reviewer" });
    expect(screen.getByText("Manual status: Awaiting information")).toBeInTheDocument();
    expect(screen.getByText("Manual assignment: Finance reviewer")).toBeInTheDocument();
    expect(screen.getByText("Assignment reason: Finance reviewer owns the next manual review step.")).toBeInTheDocument();
    expect(screen.getByText("Review status note: Waiting for supporting context or evidence.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?assign/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?route/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?resolve/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mutate ledger/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/institutional sharing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tenant-visible review/i)).not.toBeInTheDocument();
  });
});
