import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminReviewWorkspacesPage from "./AdminReviewWorkspacesPage";
import {
  getGovernedReviewWorkspaceFixtureDetail,
  getGovernedReviewWorkspaceFixtureResponse,
} from "../../test/fixtures/governedReviewWorkspaceFixtures";

const showToast = vi.fn();
const fetchAdminReviewWorkspaces = vi.fn();
const fetchAdminReviewWorkspaceDetail = vi.fn();

vi.mock("../../api/adminReviewWorkspacesApi", () => ({
  fetchAdminReviewWorkspaces: (...args: any[]) => fetchAdminReviewWorkspaces(...args),
  fetchAdminReviewWorkspaceDetail: (...args: any[]) => fetchAdminReviewWorkspaceDetail(...args),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../components/ui/Ui", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Pill: ({ children }: any) => <span>{children}</span>,
  Section: ({ children }: any) => <section>{children}</section>,
}));

beforeEach(() => {
  showToast.mockReset();
  fetchAdminReviewWorkspaces.mockReset();
  fetchAdminReviewWorkspaceDetail.mockReset();
  fetchAdminReviewWorkspaces.mockResolvedValue(getGovernedReviewWorkspaceFixtureResponse());
  fetchAdminReviewWorkspaceDetail.mockImplementation((workspaceId: string) =>
    Promise.resolve(getGovernedReviewWorkspaceFixtureDetail(workspaceId))
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminReviewWorkspacesPage", () => {
  it("renders metadata-only workspace list and detail", async () => {
    render(<AdminReviewWorkspacesPage />);

    expect(await screen.findByRole("heading", { name: "Governed review workspaces" })).toBeInTheDocument();
    expect((await screen.findAllByText("Security review workspace")).length).toBeGreaterThan(0);
    expect(screen.getByText("Support escalation review workspace")).toBeInTheDocument();
    expect(screen.getByText("Export governance review workspace")).toBeInTheDocument();
    expect(screen.getByText("Evidence review workspace")).toBeInTheDocument();
    expect(await screen.findByText(/Workspace Candidate Created/)).toBeInTheDocument();
    expect(await screen.findByText(/Security review workspace evidence metadata/)).toBeInTheDocument();
    expect(await screen.findByText(/Incident To Review Workspace/)).toBeInTheDocument();
    expect(screen.getAllByText("Metadata only").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Read only").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remediate/i })).not.toBeInTheDocument();
    expect(JSON.stringify(document.body.textContent)).not.toContain("tenant-raw-id");
    expect(JSON.stringify(document.body.textContent)).not.toContain("gs://");
    expect(JSON.stringify(document.body.textContent)).not.toContain("secret-token");
    expect(document.body.textContent).not.toContain("fixture_workspace_");
    expect(document.body.textContent).not.toContain("_fixture_ref");
    expect(document.body.textContent).not.toContain("_fixture_link");
    expect(document.body.textContent).not.toContain("_fixture_append_event");
  });

  it("sends filters to the workspace API", async () => {
    render(<AdminReviewWorkspacesPage />);
    await screen.findByText("Security review workspace");

    fireEvent.change(screen.getByLabelText("Workspace type"), { target: { value: "security_review" } });

    await waitFor(() =>
      expect(fetchAdminReviewWorkspaces).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workspaceType: "security_review",
        })
      )
    );
  });

  it("renders safe empty state without fake workspaces", async () => {
    fetchAdminReviewWorkspaces.mockResolvedValueOnce({
      ok: true,
      workspaces: [],
      summary: {
        total: 0,
        metadataOnly: true,
        emptyState: "No governed review workspace append records are available yet.",
      },
      schema: {
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendOnly: true,
        persistence: "read_only_if_present",
        mutationControlsEnabled: false,
        rawPayloadAccessEnabled: false,
        createRouteEnabled: false,
        updateRouteEnabled: false,
        deleteRouteEnabled: false,
      },
    });

    render(<AdminReviewWorkspacesPage />);

    expect(await screen.findByText(/No governed review workspace records are available yet/)).toBeInTheDocument();
    expect(screen.getByText(/metadata-only surface is ready/)).toBeInTheDocument();
    expect(screen.getByText(/append-only persistence and write governance are enabled/)).toBeInTheDocument();
    expect(screen.getByText(/Unsupported or raw-only records are excluded by default/)).toBeInTheDocument();
    expect(screen.getByText(/No governed review workspace append records/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remediate/i })).not.toBeInTheDocument();
  });
});
