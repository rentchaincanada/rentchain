import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MoveInRequirementsCard } from "./MoveInRequirementsCard";

afterEach(() => {
  cleanup();
});

describe("MoveInRequirementsCard", () => {
  it("renders a populated requirements list", () => {
    render(
      <MoveInRequirementsCard
        requirements={{
          status: "in-progress",
          completedCount: 3,
          requiredCount: 6,
          progressPercent: 50,
          lastUpdatedAt: "2026-03-18T10:00:00.000Z",
          items: [
            { key: "lease_signed", label: "Lease signed", required: true, state: "complete", source: "lease", updatedAt: "2026-03-18T10:00:00.000Z" },
            { key: "deposit_received", label: "Deposit received", required: true, state: "pending", source: "lease_terms", note: "Collect or confirm the security deposit." },
          ],
        }}
      />
    );

    expect(screen.getByText("Move-in requirements")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Lease signed")).toBeInTheDocument();
    expect(screen.getByText("Collect or confirm the security deposit.")).toBeInTheDocument();
  });

  it("renders partial requirement data safely", () => {
    render(
      <MoveInRequirementsCard
        requirements={{
          status: "not-started",
          completedCount: 0,
          requiredCount: 2,
          progressPercent: 0,
          items: [
            { key: "portal_invited", label: "Tenant portal invite sent", required: true, state: "pending" },
          ],
        }}
      />
    );

    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText("Tenant portal invite sent")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders the empty state when requirements are unavailable", () => {
    render(<MoveInRequirementsCard requirements={{ status: "unknown", items: [], completedCount: 0, requiredCount: 0 }} />);

    expect(
      screen.getByText("Move-in requirements will appear as lease and onboarding details become available.")
    ).toBeInTheDocument();
  });
});
