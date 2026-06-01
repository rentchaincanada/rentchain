import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminRecoveryWorkspacePage from "./AdminRecoveryWorkspacePage";
import {
  getRecoveryLogsFixtureResponse,
  recoveryInspectionFixture,
} from "../../test/fixtures/recoveryWorkspaceFixtures";

const showToast = vi.fn();
const fetchRecoveryLogs = vi.fn();
const inspectRecoveryWorkflow = vi.fn();

vi.mock("../../api/adminRecoveryApi", () => ({
  fetchRecoveryLogs: (params: { includeCandidates?: boolean; limit?: number }) => fetchRecoveryLogs(params),
  inspectRecoveryWorkflow: (input: { workflowType: string; workflowId: string }) => inspectRecoveryWorkflow(input),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
};

vi.mock("../../components/ui/Ui", () => ({
  Button: ({ children, variant: _variant, ...props }: ButtonProps) => <button {...props}>{children}</button>,
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Pill: ({ children }: React.HTMLAttributes<HTMLSpanElement>) => <span>{children}</span>,
  Section: ({ children }: React.HTMLAttributes<HTMLElement>) => <section>{children}</section>,
}));

beforeEach(() => {
  showToast.mockReset();
  fetchRecoveryLogs.mockReset();
  inspectRecoveryWorkflow.mockReset();
  fetchRecoveryLogs.mockResolvedValue(getRecoveryLogsFixtureResponse());
  inspectRecoveryWorkflow.mockResolvedValue({ ok: true, reconciliation: recoveryInspectionFixture });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminRecoveryWorkspacePage", () => {
  it("renders recovery history, candidate inspection, and safe timeline linkage", async () => {
    render(<AdminRecoveryWorkspacePage />);

    expect(await screen.findByRole("heading", { name: "Recovery workspace" })).toBeInTheDocument();
    expect(screen.getByText("Immutable recovery history")).toBeInTheDocument();
    expect(await screen.findByText("Canonical timeline reviewed and accepted.")).toBeInTheDocument();
    expect(screen.getAllByText("Metadata divergence").length).toBeGreaterThan(0);
    expect(screen.getByText("Timeline entry recovery_timeline:safe-entry-key")).toBeInTheDocument();
    expect(screen.getByText(/Raw workflow and actor identifiers are replaced/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reconcile/i })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("tenant-raw-id");
    expect(document.body.textContent).not.toContain("gs://");
    expect(document.body.textContent).not.toContain("secret-token");
  });

  it("submits read-only inspection requests and renders state comparison", async () => {
    render(<AdminRecoveryWorkspacePage />);

    await screen.findByText("Canonical timeline reviewed and accepted.");
    fireEvent.change(screen.getByLabelText("Workflow type"), { target: { value: "payment" } });
    fireEvent.change(screen.getByLabelText("Workflow reference"), { target: { value: "payment-reference" } });
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));

    await waitFor(() =>
      expect(inspectRecoveryWorkflow).toHaveBeenCalledWith({
        workflowType: "payment",
        workflowId: "payment-reference",
      })
    );
    expect(await screen.findByText("Recovery inspection")).toBeInTheDocument();
    expect(screen.getByText("Canonical state")).toBeInTheDocument();
    expect(screen.getByText("Derived state")).toBeInTheDocument();
    expect(screen.getByText("Proposal Accept Canonical")).toBeInTheDocument();
  });

  it("renders empty states without mutation affordances", async () => {
    fetchRecoveryLogs.mockResolvedValueOnce({ ok: true, logs: [], candidates: [] });

    render(<AdminRecoveryWorkspacePage />);

    expect(await screen.findByText("No recovery candidates are available.")).toBeInTheDocument();
    expect(screen.getByText("No recovery actions recorded.")).toBeInTheDocument();
    expect(screen.getByText("Select a recovery log to review its timeline linkage.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reconcile/i })).not.toBeInTheDocument();
  });

  it("shows safe error states for failed inspection", async () => {
    inspectRecoveryWorkflow.mockRejectedValueOnce(new Error("RECOVERY_WORKFLOW_NOT_FOUND"));

    render(<AdminRecoveryWorkspacePage />);

    await screen.findByText("Canonical timeline reviewed and accepted.");
    fireEvent.change(screen.getByLabelText("Workflow reference"), { target: { value: "missing-reference" } });
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));

    expect(await screen.findByText("RECOVERY_WORKFLOW_NOT_FOUND")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to inspect recovery state",
        variant: "error",
      })
    );
  });
});
