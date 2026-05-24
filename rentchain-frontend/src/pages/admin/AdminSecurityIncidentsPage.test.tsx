import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminSecurityIncidentsPage from "./AdminSecurityIncidentsPage";

const showToast = vi.fn();
const fetchAdminSecurityIncidents = vi.fn();
const fetchAdminSecurityIncidentDetail = vi.fn();

vi.mock("../../api/adminSecurityIncidentsApi", () => ({
  fetchAdminSecurityIncidents: (...args: any[]) => fetchAdminSecurityIncidents(...args),
  fetchAdminSecurityIncidentDetail: (...args: any[]) => fetchAdminSecurityIncidentDetail(...args),
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

const INCIDENT = {
  incidentReviewVersion: "admin_security_incident_review_v1",
  incidentId: "security_incident:safe",
  category: "impersonation_started",
  severity: "medium",
  status: "open",
  title: "Impersonation Started",
  summary: "Impersonation started signal derived from telemetry metadata.",
  occurredAt: "2026-05-23T12:00:00.000Z",
  lastSeenAt: "2026-05-23T12:00:00.000Z",
  actorSummary: { role: "admin", supportAttribution: true, rawActorIdsIncluded: false },
  targetSummary: {
    accountType: "tenant",
    resourceType: null,
    landlordScoped: true,
    tenantScoped: true,
    rawTargetIdsIncluded: false,
  },
  workflowFamily: "admin_support_impersonation",
  policyOutcomeSummary: "allowed",
  sourceRoute: null,
  routeSource: "impersonationRoutes.ts",
  metadataOnly: true,
  redactionSummary: "Raw ids excluded.",
  recommendedReviewAction: "Review support attribution.",
  safeEvidenceReferences: [{ referenceType: "telemetry", referenceId: "telemetry:safe", label: "safe", internalReference: true }],
};

beforeEach(() => {
  showToast.mockReset();
  fetchAdminSecurityIncidents.mockReset();
  fetchAdminSecurityIncidentDetail.mockReset();
  fetchAdminSecurityIncidents.mockResolvedValue({
    ok: true,
    incidents: [INCIDENT],
    summary: { total: 1, open: 1, reviewing: 0, highOrCritical: 0, metadataOnly: true },
  });
  fetchAdminSecurityIncidentDetail.mockResolvedValue({
    ok: true,
    incident: {
      ...INCIDENT,
      timeline: [{ occurredAt: INCIDENT.occurredAt, label: INCIDENT.title, category: INCIDENT.category, metadataOnly: true }],
      relatedEventSummaries: [],
      redactionNotes: ["Raw actor ids, target ids, tokens, provider payloads, documents, storage paths, stack traces, and policy internals are not included."],
      suggestedNextReviewStep: "Review support attribution.",
      relatedWorkspaceLinks: [
        {
          linkId: "workspace_link:safe",
          linkType: "incident_to_evidence",
          sourceSummary: {
            kind: "security_incident",
            label: "Impersonation Started",
            category: "impersonation_started",
            severity: "medium",
            state: "open",
            metadataOnly: true,
            rawIdsIncluded: false,
          },
          targetSummary: {
            kind: "evidence_reference",
            label: "Telemetry metadata reference",
            category: "telemetry",
            severity: null,
            state: null,
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
      governedReviewWorkspace: {
        workspaceId: "governed_workspace:safe",
        workspaceType: "security_review",
        title: "Impersonation Started workspace",
        summary: "Metadata-only review workspace summary.",
        workflowFamily: "admin_security_incident_review",
        severitySummary: "medium",
        reviewStateSummary: "open",
        relatedIncidentCount: 1,
        relatedEscalationCount: 0,
        relatedEvidenceCount: 1,
        relatedNoteCount: 0,
        approvalExpectationSummary: "Review support attribution.",
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendCompatible: true,
        mutationControlsEnabled: false,
        rawPayloadAccessEnabled: false,
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminSecurityIncidentsPage", () => {
  it("renders metadata-only security incident summaries and details", async () => {
    render(<AdminSecurityIncidentsPage />);

    expect(await screen.findByRole("heading", { name: "Security incidents" })).toBeInTheDocument();
    expect((await screen.findAllByText("Impersonation Started")).length).toBeGreaterThan(0);
    expect(await screen.findByText("impersonationRoutes.ts")).toBeInTheDocument();
    expect(await screen.findByText("Metadata-only review workspace summary.")).toBeInTheDocument();
    expect(await screen.findByText("1 evidence refs")).toBeInTheDocument();
    expect(await screen.findByText(/Incident To Evidence/)).toBeInTheDocument();
    expect(await screen.findByText(/Telemetry metadata reference/)).toBeInTheDocument();
    expect(screen.getAllByText("Metadata only").length).toBeGreaterThan(0);
    expect(JSON.stringify(document.body.textContent)).not.toContain("realActorId");
    expect(JSON.stringify(document.body.textContent)).not.toContain("effectiveActorId");
    expect(JSON.stringify(document.body.textContent)).not.toContain("impersonationSessionId");
    expect(JSON.stringify(document.body.textContent)).not.toContain("tenant-raw-id");
    expect(JSON.stringify(document.body.textContent)).not.toContain("secret");
  });

  it("sends filter values to the incident API", async () => {
    render(<AdminSecurityIncidentsPage />);
    await screen.findByText("Impersonation Started");

    fireEvent.change(screen.getByLabelText("Severity"), { target: { value: "medium" } });

    await waitFor(() =>
      expect(fetchAdminSecurityIncidents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: "medium",
        })
      )
    );
  });

  it("renders the empty state without fake incidents", async () => {
    fetchAdminSecurityIncidents.mockResolvedValueOnce({
      ok: true,
      incidents: [],
      summary: { total: 0, open: 0, reviewing: 0, highOrCritical: 0, metadataOnly: true },
    });

    render(<AdminSecurityIncidentsPage />);

    expect(await screen.findByText(/No reviewable security incident metadata is available/)).toBeInTheDocument();
  });
});
