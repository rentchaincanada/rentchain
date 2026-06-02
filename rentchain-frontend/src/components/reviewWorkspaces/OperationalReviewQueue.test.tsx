import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OperationalReviewQueue, type OperationalReviewQueueItem } from "./OperationalReviewQueue";

afterEach(() => {
  cleanup();
});

function queueItem(overrides: Partial<OperationalReviewQueueItem> = {}): OperationalReviewQueueItem {
  return {
    queueItemId: "manual-review-queue:decision:decision-1",
    title: "Review missing payment",
    contextLabel: "North Towers · Unit 104 · James Smith",
    sourceLabel: "Decision inbox · Delinquency review",
    destination: "/leases/lease-1/ledger",
    workspaceType: "payment_ledger_review",
    reviewStatus: "Open",
    reviewPriority: "Critical",
    routingReason: "Delinquency or payment evidence review",
    assignmentLabel: "Operations owned",
    workflowStatus: "New",
    financialStatus: "Review required",
    sensitivityClass: "sensitive",
    visibilityClass: "landlord_operational",
    evidenceLabel: "Payments / obligations source workflow",
    relatedResourceLabel: "North Towers · Unit 104 · James Smith",
    manualOnly: true,
    autonomousActionsEnabled: false,
    ...overrides,
  };
}

describe("OperationalReviewQueue", () => {
  it("renders manual-only review queue metadata without action controls", () => {
    render(
      <MemoryRouter>
        <OperationalReviewQueue items={[queueItem()]} />
      </MemoryRouter>
    );

    expect(screen.getByText("Operational review queue")).toBeInTheDocument();
    expect(screen.getByText(/does not create workspaces, route work automatically, or change source records/i)).toBeInTheDocument();
    expect(screen.getByText("Review missing payment")).toBeInTheDocument();
    expect(screen.getAllByText("North Towers · Unit 104 · James Smith").length).toBeGreaterThan(0);
    expect(screen.getByText("Payment Ledger Review")).toBeInTheDocument();
    expect(screen.getByText("Delinquency or payment evidence review")).toBeInTheDocument();
    expect(screen.getAllByText("Operations owned").length).toBeGreaterThan(0);
    expect(screen.getByText("Review required")).toBeInTheDocument();
    expect(screen.getByLabelText("Review status for Review missing payment")).toHaveValue("open");
    expect(screen.getByLabelText("Assigned reviewer for Review missing payment")).toHaveValue("operations");
    expect(screen.getByText("Manual status: Open")).toBeInTheDocument();
    expect(screen.getByText("Manual assignment: Operations owned")).toBeInTheDocument();
    expect(screen.getByText(/They do not route work automatically, change source records, or alter financial status/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payments / obligations source workflow" })).toHaveAttribute(
      "href",
      "/leases/lease-1/ledger"
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/create review workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?route/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mutate ledger/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/institutional sharing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tenant-visible review/i)).not.toBeInTheDocument();
  });

  it("updates manual assignment and status metadata without adding mutation actions", () => {
    render(
      <MemoryRouter>
        <OperationalReviewQueue items={[queueItem()]} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Review status for Review missing payment"), {
      target: { value: "in_review" },
    });
    fireEvent.change(screen.getByLabelText("Assigned reviewer for Review missing payment"), {
      target: { value: "finance_reviewer" },
    });

    // Should trigger confirmation dialog for the changes
    expect(screen.getByRole('dialog', { name: /Confirm assignment changes/i })).toBeInTheDocument();

    // Confirm the changes
    fireEvent.click(screen.getByRole('button', { name: /Confirm changes/i }));

    expect(screen.getByText("Manual status: In review")).toBeInTheDocument();
    expect(screen.getByText("Manual assignment: Finance reviewer")).toBeInTheDocument();
    expect(screen.getByText("Assignment reason: Finance reviewer owns the next manual review step.")).toBeInTheDocument();
    expect(screen.getByText("Review status note: Operator review is actively underway.")).toBeInTheDocument();
    expect(screen.queryByText(/auto.?assign/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?resolution/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mutate ledger/i)).not.toBeInTheDocument();
  });

  it("uses safe fallback labels for raw internal identifiers", () => {
    render(
      <MemoryRouter>
        <OperationalReviewQueue
          items={[
            queueItem({
              title: "Decision decision:review_missing_payment:lease_lifecycle:jjua9wfkdv19d5y5sdv7",
              contextLabel: "Lease JK6S7JQ2HsMj8m8RFI76",
              evidenceLabel: "Decision decision:review_missing_payment:lease_lifecycle:jjua9wfkdv19d5y5sdv7",
              relatedResourceLabel: "Lease JK6S7JQ2HsMj8m8RFI76",
            }),
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Operational review item")).toBeInTheDocument();
    expect(screen.getByText("Operational review context")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open source workflow evidence" })).toBeInTheDocument();
    expect(screen.getByText("Scoped resource context")).toBeInTheDocument();
    expect(screen.queryByText(/Decision decision:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lease JK6S7JQ2HsMj8m8RFI76/i)).not.toBeInTheDocument();
  });

  it("renders a deterministic empty state when filters remove all queue items", () => {
    render(
      <MemoryRouter>
        <OperationalReviewQueue items={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText("0 reviewable")).toBeInTheDocument();
    expect(screen.getByText(/No reviewable operational queue items match the current filters/i)).toBeInTheDocument();
  });

  it("meets WCAG 2.1 touch target requirements for mobile accessibility", () => {
    const { container } = render(
      <MemoryRouter>
        <OperationalReviewQueue items={[queueItem()]} />
      </MemoryRouter>
    );

    // Check that interactive elements have adequate touch target sizing
    const selectElements = container.querySelectorAll('select');
    selectElements.forEach(select => {
      const computedStyle = window.getComputedStyle(select);
      const minHeight = parseInt(computedStyle.minHeight, 10);
      expect(minHeight).toBeGreaterThanOrEqual(44); // WCAG 2.1 minimum
    });

    const linkElements = container.querySelectorAll('a');
    linkElements.forEach(link => {
      const computedStyle = window.getComputedStyle(link);
      const minHeight = parseInt(computedStyle.minHeight, 10);
      expect(minHeight).toBeGreaterThanOrEqual(44); // WCAG 2.1 minimum
    });
  });

  it("includes proper aria attributes for form accessibility", () => {
    render(
      <MemoryRouter>
        <OperationalReviewQueue items={[queueItem()]} />
      </MemoryRouter>
    );

    const statusSelect = screen.getByLabelText("Review status for Review missing payment");
    expect(statusSelect).toHaveAttribute('aria-describedby');

    const assignmentSelect = screen.getByLabelText("Assigned reviewer for Review missing payment");
    expect(assignmentSelect).toHaveAttribute('aria-describedby');

    // Check for proper section aria-label
    const controlsSection = screen.getByLabelText(/Manual review lifecycle controls/i);
    expect(controlsSection).toBeInTheDocument();
  });

  it("displays confirmation dialog when assignment changes are made", () => {
    render(
      <MemoryRouter>
        <OperationalReviewQueue items={[queueItem()]} />
      </MemoryRouter>
    );

    // Change status to trigger confirmation
    fireEvent.change(screen.getByLabelText("Review status for Review missing payment"), {
      target: { value: "in_review" },
    });

    // Should show confirmation dialog
    expect(screen.getByRole('dialog', { name: /Confirm assignment changes/i })).toBeInTheDocument();
    expect(screen.getByText(/You're about to update the manual review assignment/i)).toBeInTheDocument();

    // Should have properly sized confirmation buttons
    const confirmButton = screen.getByRole('button', { name: /Confirm changes/i });
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });

    expect(confirmButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();

    const confirmStyle = window.getComputedStyle(confirmButton);
    const cancelStyle = window.getComputedStyle(cancelButton);

    expect(parseInt(confirmStyle.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(cancelStyle.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it("prevents auto-submit and requires explicit confirmation for mobile UX", () => {
    render(
      <MemoryRouter>
        <OperationalReviewQueue items={[queueItem()]} />
      </MemoryRouter>
    );

    // Initially shows current status
    expect(screen.getByText("Manual status: Open")).toBeInTheDocument();

    // Change assignment
    fireEvent.change(screen.getByLabelText("Assigned reviewer for Review missing payment"), {
      target: { value: "finance_reviewer" },
    });

    // Status should still show original value until confirmed
    expect(screen.getByText("Manual status: Open")).toBeInTheDocument();

    // Should show pending state
    expect(screen.getByText(/Change pending confirmation/i)).toBeInTheDocument();

    // Click confirm to apply changes
    const confirmButton = screen.getByRole('button', { name: /Confirm changes/i });
    fireEvent.click(confirmButton);

    // Now should show updated status
    expect(screen.getByText("Manual assignment: Finance reviewer")).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
