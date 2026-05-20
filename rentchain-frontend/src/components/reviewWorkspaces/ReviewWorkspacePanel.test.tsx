import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReviewWorkspacePanel, type ReviewWorkspaceUiModel } from "./ReviewWorkspacePanel";

afterEach(() => {
  cleanup();
});

function workspace(overrides: Partial<ReviewWorkspaceUiModel> = {}): ReviewWorkspaceUiModel {
  return {
    workspaceReference: "manual-review-preview:payments:critical",
    workspaceType: "payment_ledger_review",
    reviewStatus: "Open",
    reviewPriority: "Critical",
    routingReason: "Delinquency or payment evidence review",
    assignmentLabel: "Operations owned",
    sensitivityClass: "sensitive",
    visibilityClass: "landlord_operational",
    manualOnly: true,
    autonomousActionsEnabled: false,
    evidenceLinks: [{ label: "Payments / obligations source workflow", destination: "/leases/lease-1/ledger" }],
    relatedResources: [{ label: "North Towers · Unit 104 · James Smith", resourceType: "lease" }],
    ...overrides,
  };
}

describe("ReviewWorkspacePanel", () => {
  it("renders deterministic manual-only review metadata without actions", () => {
    render(
      <MemoryRouter>
        <ReviewWorkspacePanel workspace={workspace()} />
      </MemoryRouter>
    );

    expect(screen.getByText("Review workspace readiness")).toBeInTheDocument();
    expect(screen.getByText(/does not create a workspace, route work automatically, or change source records/i)).toBeInTheDocument();
    expect(screen.getByText("Payment Ledger Review")).toBeInTheDocument();
    expect(screen.getByText("Delinquency or payment evidence review")).toBeInTheDocument();
    expect(screen.getByText("Landlord Operational")).toBeInTheDocument();
    expect(screen.getByLabelText("Review status for Payment Ledger Review")).toHaveValue("open");
    expect(screen.getByLabelText("Assigned reviewer for Payment Ledger Review")).toHaveValue("operations");
    expect(screen.getByText(/They do not route work automatically, change source records, or alter financial status/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payments / obligations source workflow" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByText("North Towers · Unit 104 · James Smith")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/auto-create/i)).not.toBeInTheDocument();
  });

  it("allows local manual assignment and status selections without persistence or autonomous controls", () => {
    render(
      <MemoryRouter>
        <ReviewWorkspacePanel workspace={workspace()} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Review status for Payment Ledger Review"), {
      target: { value: "blocked" },
    });
    fireEvent.change(screen.getByLabelText("Assigned reviewer for Payment Ledger Review"), {
      target: { value: "property_manager" },
    });

    expect(screen.getByText("Manual status: Blocked")).toBeInTheDocument();
    expect(screen.getByText("Manual assignment: Property manager")).toBeInTheDocument();
    expect(screen.getByText("Assignment reason: Property manager owns the next manual review step.")).toBeInTheDocument();
    expect(screen.getByText("Review status note: Cannot progress until a manual blocker is cleared.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?assign/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?route/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/financial mutation/i)).not.toBeInTheDocument();
  });

  it("does not render raw resource identifiers as primary labels", () => {
    render(
      <MemoryRouter>
        <ReviewWorkspacePanel
          workspace={workspace({
            evidenceLinks: [{ label: "Decision decision:review_missing_payment:lease_lifecycle:jjua9wfkdv19d5y5sdv7" }],
            relatedResources: [{ label: "Lease JK6S7JQ2HsMj8m8RFI76", resourceType: "lease" }],
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Source workflow evidence")).toBeInTheDocument();
    expect(screen.getByText("Lease context")).toBeInTheDocument();
    expect(screen.queryByText(/Decision decision:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lease JK6S7JQ2HsMj8m8RFI76/i)).not.toBeInTheDocument();
  });

  it("does not render autonomous, mutation, sharing, tenant-internal, or raw payload controls", () => {
    render(
      <MemoryRouter>
        <ReviewWorkspacePanel
          workspace={workspace({
            workspaceReference: "internal-scope-reference:workspace-1",
            evidenceLinks: [
              {
                label: "Screening source workflow",
                destination: "/applications/app-1",
                sensitivityClass: "restricted",
              },
            ],
            relatedResources: [{ label: "Screening workflow review", resourceType: "screening_order" }],
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Internal workspace reference:/)).toBeInTheDocument();
    expect(screen.getByText("Screening source workflow")).toBeInTheDocument();
    expect(screen.getByText("Screening workflow review")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/create review workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto.?route/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/resolve review/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mutate ledger/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/institutional sharing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tenant-visible review/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw provider/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw csv/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret-token/i)).not.toBeInTheDocument();
  });
});
