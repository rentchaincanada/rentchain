import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminSupportEscalationsPage from "./AdminSupportEscalationsPage";

const showToast = vi.fn();
const fetchAdminSupportEscalations = vi.fn();
const fetchAdminSupportEscalationDetail = vi.fn();

vi.mock("../../api/adminSupportEscalationsApi", () => ({
  fetchAdminSupportEscalations: (...args: any[]) => fetchAdminSupportEscalations(...args),
  fetchAdminSupportEscalationDetail: (...args: any[]) => fetchAdminSupportEscalationDetail(...args),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../components/ui/Ui", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Pill: ({ children }: any) => <span>{children}</span>,
  Section: ({ children }: any) => <section>{children}</section>,
}));

const ESCALATION = {
  escalationReviewVersion: "admin_support_escalation_review_v1",
  escalationId: "escalation-safe",
  category: "credential_secret",
  severity: "critical",
  state: "awaiting_approval",
  approvalExpectation: "security_review",
  title: "Credential Secret escalation",
  summary: "Credential family needs manual review.",
  createdAt: "2026-05-23T12:00:00.000Z",
  lastUpdatedAt: "2026-05-23T13:00:00.000Z",
  actorSummary: { role: "admin", displayName: "Security operator", supportAttribution: true, rawActorIdsIncluded: false },
  safeEvidenceRefs: [{ referenceType: "incident", referenceId: "incident-1", label: "Credential incident", internalReference: true, metadataOnly: true }],
  historyCount: 1,
  noteCount: 1,
  metadataOnly: true,
  visibilityClass: "admin_support_internal",
  tenantVisible: false,
  landlordVisible: false,
};

beforeEach(() => {
  showToast.mockReset();
  fetchAdminSupportEscalations.mockReset();
  fetchAdminSupportEscalationDetail.mockReset();
  fetchAdminSupportEscalations.mockResolvedValue({
    ok: true,
    escalations: [ESCALATION],
    summary: { total: 1, highOrCritical: 1, awaitingApproval: 1, notes: 1, metadataOnly: true, emptyState: null },
    schema: {
      metadataOnly: true,
      visibilityClass: "admin_support_internal",
      tenantVisible: false,
      landlordVisible: false,
      persistence: "read_only_if_present",
      mutationControlsEnabled: false,
    },
  });
  fetchAdminSupportEscalationDetail.mockResolvedValue({
    ok: true,
    escalation: {
      ...ESCALATION,
      historyEntries: [],
      reviewNotes: [],
      redactionSummary: "Escalation details are metadata-only.",
      prohibitedActions: ["Do not perform autonomous remediation."],
      relatedWorkspaceLinks: [
        {
          linkId: "workspace_link:safe",
          linkType: "escalation_to_runbook",
          sourceSummary: {
            kind: "support_escalation",
            label: "Credential Secret escalation",
            category: "credential_secret",
            severity: "critical",
            state: "awaiting_approval",
            metadataOnly: true,
            rawIdsIncluded: false,
          },
          targetSummary: {
            kind: "runbook",
            label: "Credential or Secret Exposure Runbook",
            category: "credential_secret",
            severity: "critical",
            state: "security_review",
            metadataOnly: true,
            rawIdsIncluded: false,
          },
          workflowFamily: "admin_support_escalation_review",
          metadataOnly: true,
          visibilityClass: "admin_support_internal",
          tenantVisible: false,
          landlordVisible: false,
          appendCompatible: true,
          mutationControlsEnabled: false,
        },
      ],
      governedReviewWorkspace: {
        workspaceId: "governed_workspace:safe",
        workspaceType: "support_escalation_review",
        title: "Credential Secret escalation workspace",
        summary: "Metadata-only support escalation workspace summary.",
        workflowFamily: "admin_support_escalation_review",
        severitySummary: "critical",
        reviewStateSummary: "awaiting_approval",
        relatedIncidentCount: 0,
        relatedEscalationCount: 1,
        relatedEvidenceCount: 1,
        relatedNoteCount: 1,
        approvalExpectationSummary: "security_review",
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendCompatible: true,
        mutationControlsEnabled: false,
        rawPayloadAccessEnabled: false,
      },
      emptyState: false,
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminSupportEscalationsPage", () => {
  it("renders metadata-only escalation summaries and safe details", async () => {
    render(<AdminSupportEscalationsPage />);

    expect(await screen.findByRole("heading", { name: "Support escalations" })).toBeInTheDocument();
    expect((await screen.findAllByText("Credential Secret escalation")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Security operator")).toBeInTheDocument();
    expect(await screen.findByText("Metadata-only support escalation workspace summary.")).toBeInTheDocument();
    expect(await screen.findByText("1 evidence refs")).toBeInTheDocument();
    expect(await screen.findByText(/Escalation To Runbook/)).toBeInTheDocument();
    expect(await screen.findByText(/Credential or Secret Exposure Runbook/)).toBeInTheDocument();
    expect(screen.getAllByText("Metadata only").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /impersonate/i })).not.toBeInTheDocument();
    expect(JSON.stringify(document.body.textContent)).not.toContain("rawActorId");
    expect(JSON.stringify(document.body.textContent)).not.toContain("tenant-raw-id");
    expect(JSON.stringify(document.body.textContent)).not.toContain("secret-token");
    expect(JSON.stringify(document.body.textContent)).not.toContain("gs://");
  });

  it("sends filters to the escalation API", async () => {
    render(<AdminSupportEscalationsPage />);
    await screen.findByText("Credential Secret escalation");

    fireEvent.change(screen.getByLabelText("Severity"), { target: { value: "critical" } });

    await waitFor(() =>
      expect(fetchAdminSupportEscalations).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: "critical",
        })
      )
    );
  });

  it("renders a safe empty state without fake escalations", async () => {
    fetchAdminSupportEscalations.mockResolvedValueOnce({
      ok: true,
      escalations: [],
      summary: {
        total: 0,
        highOrCritical: 0,
        awaitingApproval: 0,
        notes: 0,
        metadataOnly: true,
        emptyState: "No persisted support escalation history or review note metadata is available yet.",
      },
      schema: {
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        persistence: "read_only_if_present",
        mutationControlsEnabled: false,
      },
    });

    render(<AdminSupportEscalationsPage />);

    expect(await screen.findByText(/No support escalation metadata is available yet/)).toBeInTheDocument();
    expect(screen.getByText(/No persisted support escalation history/)).toBeInTheDocument();
  });
});
