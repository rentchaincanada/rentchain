import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreeningWorkflowPanel } from "./ScreeningWorkflowPanel";

afterEach(() => {
  cleanup();
});

describe("ScreeningWorkflowPanel", () => {
  it("renders provider-agnostic screening options without making TransUnion the only path", () => {
    render(<ScreeningWorkflowPanel transUnionConnected={false} workflowStatus="not_started" />);

    expect(screen.getByText("Screening workflow")).toBeInTheDocument();
    expect(screen.getByText("TransUnion")).toBeInTheDocument();
    expect(screen.getByText("Certn")).toBeInTheDocument();
    expect(screen.getByText("Equifax")).toBeInTheDocument();
    expect(screen.getByText("Manual/offline review")).toBeInTheDocument();
    expect(screen.getByText("Future provider")).toBeInTheDocument();
    expect(screen.getByText("Workflow state: Not started")).toBeInTheDocument();
  });

  it("labels unavailable providers as non-live and keeps them disabled", () => {
    render(<ScreeningWorkflowPanel transUnionConnected={false} />);

    const disabledButtons = screen.getAllByRole("button", { name: "Not live yet" });
    expect(disabledButtons.length).toBeGreaterThanOrEqual(3);
    expect(disabledButtons[0]).toBeDisabled();
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThanOrEqual(3);
  });

  it("uses requires-setup for TransUnion until credentials are connected", () => {
    const onSetup = vi.fn();
    render(<ScreeningWorkflowPanel transUnionConnected={false} onTransUnionSetup={onSetup} />);

    expect(screen.getByText("Requires setup")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set up provider" }));
    expect(onSetup).toHaveBeenCalledTimes(1);
  });

  it("allows manual review as a safe fallback without starting a live provider", () => {
    const onManualReview = vi.fn();
    render(<ScreeningWorkflowPanel transUnionConnected={false} onManualReview={onManualReview} />);

    fireEvent.click(screen.getByRole("button", { name: "Use manual review" }));
    expect(onManualReview).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/do not upload or store raw bureau reports here/i)).toBeInTheDocument();
  });

  it("shows consent and provider requirements guidance", () => {
    render(<ScreeningWorkflowPanel transUnionConnected workflowStatus="requested" onTransUnionStart={vi.fn()} />);

    expect(screen.getByText("Workflow state: Awaiting applicant")).toBeInTheDocument();
    expect(screen.getByText(/Verify consent and provider requirements before ordering reports/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use TransUnion" })).toBeEnabled();
  });
});
