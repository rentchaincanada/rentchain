import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MoveInReadinessCard } from "./MoveInReadinessCard";

afterEach(() => {
  cleanup();
});

describe("MoveInReadinessCard", () => {
  it("renders a populated readiness summary", () => {
    render(
      <MoveInReadinessCard
        readiness={{
          status: "in-progress",
          readinessPercent: 67,
          leaseSigned: true,
          portalActivated: false,
          keysReleaseReady: false,
          completedItems: ["Lease signed", "Deposit received"],
          outstandingItems: ["Tenant portal activation pending", "Complete move-in inspection"],
          lastUpdatedAt: "2026-03-18T10:00:00.000Z",
        }}
      />
    );

    expect(screen.getByText("Move-in readiness")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getAllByText("Lease signed").length).toBeGreaterThan(0);
    expect(screen.getByText("Complete move-in inspection")).toBeInTheDocument();
  });

  it("renders partial readiness data safely", () => {
    render(
      <MoveInReadinessCard
        readiness={{
          status: "ready",
          readinessPercent: 100,
          keysReleaseReady: true,
          completedItems: [],
          outstandingItems: [],
          lastUpdatedAt: null,
        }}
      />
    );

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("No completed readiness items yet.")).toBeInTheDocument();
    expect(screen.getByText("No outstanding requirements right now.")).toBeInTheDocument();
  });

  it("renders the empty state when readiness is unavailable", () => {
    render(<MoveInReadinessCard readiness={{ status: "unknown" }} />);

    expect(
      screen.getByText("Move-in readiness will appear as lease and onboarding details become available.")
    ).toBeInTheDocument();
  });
});
