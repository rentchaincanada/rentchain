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

    expect(screen.getByText("Manual status: In review")).toBeInTheDocument();
    expect(screen.getByText("Manual assignment: Finance reviewer")).toBeInTheDocument();
    expect(screen.getByText("Assignment reason: Finance reviewer owns the next manual review step.")).toBeInTheDocument();
    expect(screen.getByText("Review status note: Operator review is actively underway.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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
});
