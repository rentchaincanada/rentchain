import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ResolutionPanel from "./ResolutionPanel";

vi.mock("../../api/adminResolutionApi", () => ({
  createResolution: vi.fn(),
  updateResolutionStatus: vi.fn(),
  addResolutionNote: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ResolutionPanel", () => {
  it("renders empty state and creates a resolution", async () => {
    const { createResolution } = await import("../../api/adminResolutionApi");
    vi.mocked(createResolution).mockResolvedValue({
      resolution: {
        version: "v1",
        id: "resolution-1",
        resource: { type: "application", id: "app-1" },
        triage: {},
        status: "open",
        createdAt: "2026-04-15T12:00:00.000Z",
        updatedAt: "2026-04-15T12:00:00.000Z",
        notes: [],
        history: [],
      },
    } as any);
    const onChange = vi.fn();

    render(
      <ResolutionPanel
        resourceType="application"
        resourceId="app-1"
        triageCategory="screening_reconciliation"
        triageSeverity="critical"
        reasonCode="TRIAGE_PAID_NOT_FULFILLED"
        resolution={null}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/No resolution record exists yet for this resource/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create resolution/i }));

    await waitFor(() => {
      expect(createResolution).toHaveBeenCalledWith({
        resourceType: "application",
        resourceId: "app-1",
        triageCategory: "screening_reconciliation",
        triageSeverity: "critical",
        reasonCode: "TRIAGE_PAID_NOT_FULFILLED",
        note: null,
      });
      expect(onChange).toHaveBeenCalled();
    });
  });

  it("renders actions and appends notes for an existing resolution", async () => {
    const { updateResolutionStatus, addResolutionNote } = await import("../../api/adminResolutionApi");
    vi.mocked(updateResolutionStatus).mockResolvedValue({
      resolution: {
        version: "v1",
        id: "resolution-1",
        resource: { type: "application", id: "app-1" },
        triage: {},
        status: "acknowledged",
        createdAt: "2026-04-15T12:00:00.000Z",
        updatedAt: "2026-04-15T12:10:00.000Z",
        notes: [],
        history: [],
      },
    } as any);
    vi.mocked(addResolutionNote).mockResolvedValue({
      resolution: {
        version: "v1",
        id: "resolution-1",
        resource: { type: "application", id: "app-1" },
        triage: {},
        status: "open",
        createdAt: "2026-04-15T12:00:00.000Z",
        updatedAt: "2026-04-15T12:05:00.000Z",
        notes: [{ id: "note-1", createdAt: "2026-04-15T12:05:00.000Z", message: "Investigating." }],
        history: [],
      },
    } as any);
    const onChange = vi.fn();

    render(
      <ResolutionPanel
        resourceType="application"
        resourceId="app-1"
        resolution={{
          version: "v1",
          id: "resolution-1",
          resource: { type: "application", id: "app-1" },
          triage: {},
          status: "open",
          createdAt: "2026-04-15T12:00:00.000Z",
          updatedAt: "2026-04-15T12:00:00.000Z",
          notes: [],
          history: [],
        }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/Resolution status reason/i), {
      target: { value: "Starting review." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/i }));

    await waitFor(() => {
      expect(updateResolutionStatus).toHaveBeenCalledWith("resolution-1", {
        status: "acknowledged",
        reason: "Starting review.",
      });
    });

    fireEvent.change(screen.getByLabelText(/Resolution note/i), {
      target: { value: "Investigating." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add note/i }));

    await waitFor(() => {
      expect(addResolutionNote).toHaveBeenCalledWith("resolution-1", {
        message: "Investigating.",
      });
      expect(onChange).toHaveBeenCalled();
    });
  });
});
