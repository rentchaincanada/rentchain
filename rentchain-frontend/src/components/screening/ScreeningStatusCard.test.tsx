import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreeningStatusCard } from "./ScreeningStatusCard";
import type { ScreeningStatusView } from "@/api/screeningOpsApi";

function buildStatus(overrides: Partial<ScreeningStatusView> = {}): ScreeningStatusView {
  return {
    status: "not_started",
    provider: null,
    requestedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    resultSummary: null,
    resultFlags: [],
    reportAvailable: false,
    reportUrl: null,
    reportExportId: null,
    actionLabel: "Start Screening",
    actionPath: "/applications?applicationId=app-1",
    operationId: null,
    ...overrides,
  };
}

describe("ScreeningStatusCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders provider-neutral blocked setup state", () => {
    render(
      <ScreeningStatusCard
        status={buildStatus({
          status: "blocked_transunion_not_connected",
          actionLabel: "Connect TransUnion",
        })}
      />
    );

    expect(screen.getByText("Next step required")).toBeInTheDocument();
    expect(screen.getByText(/Connect the configured screening provider to continue/i)).toBeInTheDocument();
    expect(screen.getByText(/Connect provider access, request screening/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect screening provider" })).toBeInTheDocument();
    expect(screen.queryByText(/Connect TransUnion/i)).not.toBeInTheDocument();
  });

  it("renders requested state", () => {
    render(
      <ScreeningStatusCard
        status={buildStatus({
          status: "requested",
          provider: "transunion_manual",
          requestedAt: "2026-03-28T10:00:00.000Z",
          actionLabel: "View Application",
        })}
      />
    );

    expect(screen.getByText("Screening requested")).toBeInTheDocument();
  });

  it("renders in progress state", () => {
    render(
      <ScreeningStatusCard
        status={buildStatus({
          status: "in_progress",
          startedAt: "2026-03-28T11:00:00.000Z",
          actionLabel: "View Application",
        })}
      />
    );

    expect(screen.getByText("Screening in progress")).toBeInTheDocument();
  });

  it("renders completed state with summary", () => {
    render(
      <ScreeningStatusCard
        status={buildStatus({
          status: "completed",
          completedAt: "2026-03-28T12:00:00.000Z",
          actionLabel: "Review Decision",
          resultSummary: "Low risk overall.",
          resultFlags: ["income_verified"],
          reportAvailable: true,
        })}
      />
    );

    expect(screen.getByText("Screening completed")).toBeInTheDocument();
    expect(screen.getByText(/Low risk overall/)).toBeInTheDocument();
    expect(screen.getByText("Report available")).toBeInTheDocument();
  });

  it("invokes the primary action callback", () => {
    const onPrimaryAction = vi.fn();
    render(<ScreeningStatusCard status={buildStatus()} onPrimaryAction={onPrimaryAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Start Screening" }));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });
});
