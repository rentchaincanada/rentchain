import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreeningOpsList } from "./ScreeningOpsList";
import { ScreeningOpDetail } from "./ScreeningOpDetail";
import type { ScreeningOperation } from "@/api/screeningOpsApi";

function buildOperation(overrides: Partial<ScreeningOperation> = {}): ScreeningOperation {
  return {
    id: "screening-op-1",
    applicationId: "app-1",
    landlordId: "landlord-1",
    propertyId: "property-1",
    unitId: "unit-1",
    applicantName: "Jane Doe",
    provider: "transunion_manual",
    status: "requested",
    requestedAt: "2026-03-28T10:00:00.000Z",
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    resultSummary: null,
    resultFlags: [],
    reportUrl: null,
    reportExportId: null,
    operatorNotes: null,
    createdAt: "2026-03-28T10:00:00.000Z",
    updatedAt: "2026-03-28T10:00:00.000Z",
    updatedByUserId: "admin-1",
    ...overrides,
  };
}

describe("ScreeningOps components", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders screening ops list entries", () => {
    render(<ScreeningOpsList operations={[buildOperation()]} onSelect={() => undefined} />);

    expect(screen.getByText("Screening Operations")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Application: app-1")).toBeInTheDocument();
  });

  it("renders detail actions and submits completion payload", () => {
    const onComplete = vi.fn();
    render(<ScreeningOpDetail operation={buildOperation({ status: "in_progress" })} onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText("Result Summary"), {
      target: { value: "Manual result summary" },
    });
    fireEvent.change(screen.getByLabelText("Flags"), {
      target: { value: "income_verified, id_verified" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));

    expect(onComplete).toHaveBeenCalledWith({
      resultSummary: "Manual result summary",
      resultFlags: ["income_verified", "id_verified"],
      reportUrl: null,
      reportExportId: null,
      operatorNotes: null,
    });
  });

  it("submits cancel payload", () => {
    const onCancel = vi.fn();
    render(<ScreeningOpDetail operation={buildOperation()} onCancel={onCancel} />);

    fireEvent.change(screen.getByLabelText("Cancelled Reason"), {
      target: { value: "Applicant withdrew" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel Screening" }));

    expect(onCancel).toHaveBeenCalledWith({ cancelledReason: "Applicant withdrew" });
  });
});
