import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandlordDecisionPanel } from "./LandlordDecisionPanel";

afterEach(() => {
  cleanup();
});

describe("LandlordDecisionPanel", () => {
  it("renders the structured risk summary, factors, flags, and recommendations", () => {
    const { container } = render(
      <LandlordDecisionPanel
        riskSnapshot={{
          version: "risk-v1",
          status: "completed",
          score: 78,
          grade: "B",
          confidence: 0.84,
          factors: [
            {
              code: "identity_verified",
              label: "Identity verification completed",
              impact: "positive",
              weight: 8,
            },
            {
              code: "income_to_rent_low",
              label: "Income below preferred threshold",
              impact: "negative",
              weight: 18,
            },
          ],
          flags: ["Income verification incomplete"],
          recommendations: ["Request additional income documentation"],
          updatedAt: "2026-04-01T00:00:00.000Z",
        }}
      />
    );

    expect(screen.getByText("Landlord Decision Panel")).toBeInTheDocument();
    expect(container.querySelector(".rc-landlord-decision-panel__risk-summary-grid")).toBeTruthy();
    expect(screen.getByText("78")).toBeInTheDocument();
    expect(screen.getByText("Grade B")).toBeInTheDocument();
    expect(screen.getByText("Lower risk")).toBeInTheDocument();
    expect(screen.getByText("Identity verification completed")).toBeInTheDocument();
    expect(screen.getByText("Income below preferred threshold")).toBeInTheDocument();
    expect(screen.getByText("Income verification incomplete")).toBeInTheDocument();
    expect(screen.getByText("Request additional income documentation")).toBeInTheDocument();
  });

  it("renders the not-evaluated state and triggers risk evaluation", () => {
    const onEvaluateRisk = vi.fn();

    render(<LandlordDecisionPanel riskSnapshot={null} onEvaluateRisk={onEvaluateRisk} />);

    expect(screen.getByText("No risk snapshot is available yet. Evaluate risk first to unlock the decision panel.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Evaluate risk" }));
    expect(onEvaluateRisk).toHaveBeenCalledTimes(1);
  });

  it("renders decision actions and passes notes to the click handler", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);

    render(
      <LandlordDecisionPanel
        riskSnapshot={{
          version: "risk-v1",
          status: "manual_review_required",
          score: 48,
          grade: "D",
          confidence: 0.61,
          factors: [],
          flags: ["Document review is still pending"],
          recommendations: ["Wait for missing documents before decision"],
          updatedAt: "2026-04-01T00:00:00.000Z",
        }}
        onDecision={onDecision}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Optional decision notes for your team audit trail"), {
      target: { value: "Need one more paystub before final call." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request More Info" }));

    expect(onDecision).toHaveBeenCalledWith("request_info", "Need one more paystub before final call.");
  });

  it("renders recorded final-decision copy instead of active decision actions", () => {
    const onDecision = vi.fn();

    render(
      <LandlordDecisionPanel
        riskSnapshot={{
          version: "risk-v1",
          status: "completed",
          score: 82,
          grade: "A",
          confidence: 0.9,
          factors: [],
          flags: [],
          recommendations: [],
          updatedAt: "2026-04-01T00:00:00.000Z",
        }}
        onDecision={onDecision}
        finalDecisionState={{
          title: "Application approved",
          description: "This application has already been approved.",
          nextAction: "Continue lease follow-through from the lease workspace.",
        }}
      />
    );

    expect(screen.getByText("Recorded Decision")).toBeInTheDocument();
    expect(screen.getByText("Application approved")).toBeInTheDocument();
    expect(screen.getByText("This application has already been approved.")).toBeInTheDocument();
    expect(screen.getByText("Next step: Continue lease follow-through from the lease workspace.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request More Info" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Optional decision notes for your team audit trail")).not.toBeInTheDocument();
  });

  it("renders recorded final-decision copy even without a risk snapshot", () => {
    const onEvaluateRisk = vi.fn();

    render(
      <LandlordDecisionPanel
        riskSnapshot={null}
        onEvaluateRisk={onEvaluateRisk}
        finalDecisionState={{
          title: "Application declined",
          description: "This decision has already been recorded.",
          nextAction: "Keep the application summary available for review history.",
        }}
      />
    );

    expect(screen.getByText("Application declined")).toBeInTheDocument();
    expect(screen.getByText("This decision has already been recorded.")).toBeInTheDocument();
    expect(screen.queryByText("No risk snapshot is available yet. Evaluate risk first to unlock the decision panel.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Evaluate risk" })).not.toBeInTheDocument();
  });
});
