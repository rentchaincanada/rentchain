import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminReviewWorkspacesPage from "./AdminReviewWorkspacesPage";

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

const WORKSPACE = {
  workspaceId: "governed_workspace:safe",
  workspaceType: "security_review",
  title: "Security review workspace",
  summary: "Metadata-only workspace summary.",
  workflowFamily: "admin_security_incident_review",
  severitySummary: "medium",
  reviewStateSummary: "metadata_review_ready",
  approvalExpectationSummary: "admin_review",
  relatedIncidentCount: 1,
  relatedEscalationCount: 0,
  relatedEvidenceCount: 1,
  relatedNoteCount: 1,
  appendEventCount: 1,
  retentionClass: "security_review",
  retentionReviewAt: "2026-06-01T00:00:00.000Z",
  lastAppendedAt: "2026-05-24T01:00:00.000Z",
  metadataOnly: true,
  visibilityClass: "admin_support_internal",
  tenantVisible: false,
  landlordVisible: false,
  appendOnly: true,
  mutationControlsEnabled: false,
  rawPayloadAccessEnabled: false,
};

beforeEach(() => {
  showToast.mockReset();
  fetchAdminReviewWorkspaces.mockReset();
  fetchAdminReviewWorkspaceDetail.mockReset();
  fetchAdminReviewWorkspaces.mockResolvedValue({
    ok: true,
    workspaces: [WORKSPACE],
    summary: { total: 1, metadataOnly: true, emptyState: null },
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
  fetchAdminReviewWorkspaceDetail.mockResolvedValue({
    ok: true,
    workspace: {
      ...WORKSPACE,
      safeEvidenceRefs: [
        {
          referenceType: "evidence_pack",
          referenceId: "evidence-safe",
          label: "Evidence metadata reference",
          internalReference: true,
          metadataOnly: true,
        },
      ],
      relatedWorkspaceLinks: [
        {
          linkId: "workspace_link:safe",
          linkType: "incident_to_review_workspace",
          sourceSummary: {
            kind: "security_incident",
            label: "Security incident",
            category: "policy_denied",
            severity: "medium",
            state: "open",
            metadataOnly: true,
            rawIdsIncluded: false,
          },
          targetSummary: {
            kind: "review_workspace",
            label: "Governed workspace",
            category: "security_review",
            severity: "medium",
            state: "metadata_review_ready",
            metadataOnly: true,
            rawIdsIncluded: false,
          },
          workflowFamily: "admin_security_incident_review",
          metadataOnly: true,
          visibilityClass: "admin_support_internal",
          tenantVisible: false,
          landlordVisible: false,
          appendCompatible: true,
          mutationControlsEnabled: false,
        },
      ],
      appendEventSummaries: [
        {
          eventRefId: "event-safe",
          eventType: "workspace_candidate_created",
          eventSummary: "Workspace candidate created.",
          occurredAt: "2026-05-24T01:00:00.000Z",
          metadataOnly: true,
          visibilityClass: "admin_support_internal",
          tenantVisible: false,
          landlordVisible: false,
          appendOnly: true,
        },
      ],
      redactionSummary: "Raw notes, documents, storage paths, tokens, secrets, and debug payloads are excluded.",
      payloadSafety: { rawPayloads: "excluded" },
      persistenceDecision: "contract_only_firestore_deferred",
    },
  });
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
    expect(await screen.findByText(/Workspace Candidate Created/)).toBeInTheDocument();
    expect(await screen.findByText(/Evidence metadata reference/)).toBeInTheDocument();
    expect(await screen.findByText(/Incident To Review Workspace/)).toBeInTheDocument();
    expect(screen.getAllByText("Metadata only").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Read only").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(JSON.stringify(document.body.textContent)).not.toContain("tenant-raw-id");
    expect(JSON.stringify(document.body.textContent)).not.toContain("gs://");
    expect(JSON.stringify(document.body.textContent)).not.toContain("secret-token");
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
    expect(screen.getByText(/No governed review workspace append records/)).toBeInTheDocument();
  });
});
