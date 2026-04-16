import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssignmentPanel from "./AssignmentPanel";

vi.mock("../../api/adminAssignmentApi", () => ({
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AssignmentPanel", () => {
  it("renders empty state and creates an assignment", async () => {
    const { createAssignment } = await import("../../api/adminAssignmentApi");
    vi.mocked(createAssignment).mockResolvedValue({
      assignment: {
        version: "v1",
        id: "assignment-1",
        resource: { type: "application", id: "app-1" },
        currentOwner: { ownerId: "admin-1", ownerLabel: "Morgan Ops" },
        createdAt: "2026-04-16T12:00:00.000Z",
        updatedAt: "2026-04-16T12:00:00.000Z",
        history: [],
      },
    } as any);
    const onChange = vi.fn();

    render(
      <AssignmentPanel
        resourceType="application"
        resourceId="app-1"
        assignment={null}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/Assignment owner ID/i), {
      target: { value: "admin-1" },
    });
    fireEvent.change(screen.getByLabelText(/Assignment owner label/i), {
      target: { value: "Morgan Ops" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Assign owner/i }));

    await waitFor(() => {
      expect(createAssignment).toHaveBeenCalledWith({
        resourceType: "application",
        resourceId: "app-1",
        ownerId: "admin-1",
        ownerLabel: "Morgan Ops",
        note: null,
      });
      expect(onChange).toHaveBeenCalled();
    });
  });

  it("changes owner and clears owner while showing history", async () => {
    const { updateAssignment } = await import("../../api/adminAssignmentApi");
    vi.mocked(updateAssignment)
      .mockResolvedValueOnce({
        assignment: {
          version: "v1",
          id: "assignment-1",
          resource: { type: "application", id: "app-1" },
          currentOwner: { ownerId: "admin-2", ownerLabel: "Taylor Ops" },
          createdAt: "2026-04-16T12:00:00.000Z",
          updatedAt: "2026-04-16T12:10:00.000Z",
          history: [
            {
              id: "hist-1",
              timestamp: "2026-04-16T12:00:00.000Z",
              action: "set",
              toOwnerId: "admin-1",
              toOwnerLabel: "Morgan Ops",
            },
          ],
        },
      } as any)
      .mockResolvedValueOnce({
        assignment: {
          version: "v1",
          id: "assignment-1",
          resource: { type: "application", id: "app-1" },
          currentOwner: {},
          createdAt: "2026-04-16T12:00:00.000Z",
          updatedAt: "2026-04-16T12:15:00.000Z",
          history: [
            {
              id: "hist-1",
              timestamp: "2026-04-16T12:00:00.000Z",
              action: "set",
              toOwnerId: "admin-1",
              toOwnerLabel: "Morgan Ops",
            },
            {
              id: "hist-2",
              timestamp: "2026-04-16T12:15:00.000Z",
              action: "cleared",
              fromOwnerId: "admin-2",
              fromOwnerLabel: "Taylor Ops",
            },
          ],
        },
      } as any);

    const onChange = vi.fn();
    render(
      <AssignmentPanel
        resourceType="application"
        resourceId="app-1"
        assignment={{
          version: "v1",
          id: "assignment-1",
          resource: { type: "application", id: "app-1" },
          currentOwner: { ownerId: "admin-1", ownerLabel: "Morgan Ops" },
          createdAt: "2026-04-16T12:00:00.000Z",
          updatedAt: "2026-04-16T12:00:00.000Z",
          history: [
            {
              id: "hist-1",
              timestamp: "2026-04-16T12:00:00.000Z",
              action: "set",
              toOwnerId: "admin-1",
              toOwnerLabel: "Morgan Ops",
            },
          ],
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/Assigned:\s*Morgan Ops/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Assignment owner ID/i), {
      target: { value: "admin-2" },
    });
    fireEvent.change(screen.getByLabelText(/Assignment owner label/i), {
      target: { value: "Taylor Ops" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Change owner/i }));

    await waitFor(() => {
      expect(updateAssignment).toHaveBeenCalledWith("assignment-1", {
        ownerId: "admin-2",
        ownerLabel: "Taylor Ops",
        note: null,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Clear owner/i }));

    await waitFor(() => {
      expect(updateAssignment).toHaveBeenLastCalledWith("assignment-1", {
        ownerId: null,
        ownerLabel: null,
        note: null,
      });
      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });
});
