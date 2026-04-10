import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationDecisionSummaryCard } from "./ApplicationDecisionSummaryCard";

afterEach(() => {
  cleanup();
});

describe("ApplicationDecisionSummaryCard", () => {
  it("renders full decision support content", () => {
    render(
      <ApplicationDecisionSummaryCard
        summary={{
          applicationId: "app-1",
          status: "IN_REVIEW",
          riskSnapshot: {
            version: "risk-v1",
            status: "completed",
            score: 72,
            grade: "B",
            confidence: 0.84,
            factors: [
              {
                code: "identity_verified",
                label: "Identity verification completed",
                impact: "positive",
                weight: 8,
              },
            ],
            flags: ["Income verification incomplete"],
            recommendations: ["Request additional income documentation"],
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          riskInsights: {
            score: 78,
            grade: "B",
            confidence: 0.81,
            signals: ["Income stress", "Recent address change"],
            recommendations: ["Verify income documents"],
          },
          referenceQuestions: ["Would you re-rent to this applicant?", "Were payments reliably on time?"],
          screeningRecommendation: {
            recommended: true,
            reason: "Screening can improve confidence before approval.",
            priority: "medium",
          },
          screeningSummary: {
            available: true,
            provider: "TransUnion",
            completedAt: "2026-03-18T10:00:00.000Z",
            highlights: ["Overall result: Review"],
          },
          decisionSupport: {
            summaryLine: "Review the available signals together before deciding.",
            nextBestAction: "Review references before approving.",
          },
        }}
      />
    );

    expect(screen.getByText("Application decision support")).toBeInTheDocument();
    expect(screen.getByText("Landlord Decision Panel")).toBeInTheDocument();
    expect(screen.getByText("Legacy Decision Signals")).toBeInTheDocument();
    expect(screen.getByText("Reference Questions")).toBeInTheDocument();
    expect(screen.getByText("Screening Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Decision Support Summary")).toBeInTheDocument();
    expect(screen.getByText("Income stress")).toBeInTheDocument();
    expect(screen.getByText("Overall result: Review")).toBeInTheDocument();
    expect(screen.getByText("Identity verification completed")).toBeInTheDocument();
    expect(screen.getByText("Income verification incomplete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("renders partial decision data safely", () => {
    render(
      <ApplicationDecisionSummaryCard
        summary={{
          applicationId: "app-2",
          riskInsights: null,
          referenceQuestions: [],
          screeningRecommendation: {
            recommended: false,
            reason: "Screening is already in progress.",
            priority: "low",
          },
          screeningSummary: {
            available: false,
            provider: null,
            completedAt: null,
            highlights: [],
          },
          decisionSupport: {
            summaryLine: "More verification will help improve confidence.",
            nextBestAction: "Complete screening before deciding.",
          },
        }}
      />
    );

    expect(screen.getByText("Screening is already in progress.")).toBeInTheDocument();
    expect(screen.getByText("Reference prompts will appear as application details become available.")).toBeInTheDocument();
  });

  it("renders the lease conflict warning when present in risk insights", () => {
    render(
      <ApplicationDecisionSummaryCard
        summary={{
          applicationId: "app-lease",
          status: "IN_REVIEW",
          riskInsights: {
            score: 52,
            grade: "D",
            confidence: 0.76,
            signals: ["Active lease conflict risk"],
            recommendations: [
              "Applicant is currently under lease with significant time remaining and landlord is not aware.",
            ],
          },
          referenceQuestions: [],
          screeningRecommendation: {
            recommended: true,
            reason: "Screening can improve confidence before approval.",
            priority: "high",
          },
          screeningSummary: {
            available: false,
            provider: null,
            completedAt: null,
            highlights: [],
          },
          decisionSupport: {
            summaryLine: "Follow up on the active lease before deciding.",
            nextBestAction: "Clarify move timing with the applicant and confirm landlord awareness.",
          },
        }}
      />
    );

    expect(screen.getByText("Active lease conflict risk")).toBeInTheDocument();
    expect(
      screen.getByText("Applicant is currently under lease with significant time remaining and landlord is not aware.")
    ).toBeInTheDocument();
  });

  it("renders the empty state when no decision inputs are available", () => {
    render(<ApplicationDecisionSummaryCard summary={null} />);

    expect(
      screen.getByText("Decision support will appear as application and screening data becomes available.")
    ).toBeInTheDocument();
  });

  it("renders a not-evaluated risk state and triggers a refresh action safely", () => {
    const onEvaluateRisk = vi.fn();
    render(<ApplicationDecisionSummaryCard summary={{ applicationId: "app-3", riskSnapshot: null }} onEvaluateRisk={onEvaluateRisk} />);

    expect(screen.getByText("No risk snapshot is available yet. Evaluate risk first to unlock the decision panel.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Evaluate risk" }));
    expect(onEvaluateRisk).toHaveBeenCalledTimes(1);
  });

  it("passes decision actions through to the provided handler", () => {
    const onDecision = vi.fn();
    render(
      <ApplicationDecisionSummaryCard
        summary={{
          applicationId: "app-4",
          riskSnapshot: {
            version: "risk-v1",
            status: "completed",
            score: 88,
            grade: "A",
            confidence: 0.94,
            factors: [],
            flags: [],
            recommendations: [],
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        }}
        onDecision={onDecision}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Optional decision notes for your team audit trail"), {
      target: { value: "Looks strong overall." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onDecision).toHaveBeenCalledWith("approve", "Looks strong overall.");
  });
});
