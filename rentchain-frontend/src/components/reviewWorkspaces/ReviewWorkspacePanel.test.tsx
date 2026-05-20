import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewWorkspacePanel, type ReviewWorkspaceUiModel } from "./ReviewWorkspacePanel";

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
    expect(screen.getByRole("link", { name: "Payments / obligations source workflow" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByText("North Towers · Unit 104 · James Smith")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/auto-create/i)).not.toBeInTheDocument();
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
});
