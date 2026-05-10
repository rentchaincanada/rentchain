import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SupportDebugConsolePage from "./SupportDebugConsolePage";

const showToast = vi.fn();

vi.mock("../../api/supportConsoleApi", () => ({
  fetchSupportConsoleResource: vi.fn(),
}));

vi.mock("../../api/adminResolutionApi", () => ({
  createResolution: vi.fn(),
  updateResolutionStatus: vi.fn(),
  addResolutionNote: vi.fn(),
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
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(initialEntry = "/admin/support-console") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/support-console" element={<SupportDebugConsolePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SupportDebugConsolePage", () => {
  it("renders loaded support console sections", async () => {
    const { fetchSupportConsoleResource } = await import("../../api/supportConsoleApi");
    vi.mocked(fetchSupportConsoleResource).mockResolvedValue({
      resource: {
        type: "application",
        id: "app-1",
        title: "Alex Tenant",
        subtitle: "Property prop-1 • Unit unit-1",
        status: "complete",
      },
      timeline: [
        {
          id: "event-1",
          title: "Screening completed",
          description: "Screening completed for this application.",
          timestamp: "2026-04-12T10:00:00.000Z",
          domain: "screening",
          status: "completed",
          actor: "System",
        },
      ],
      insight: {
        domain: "screening",
        summary: { lifecycleState: "completed" },
      },
      policyDecisions: [
        {
          id: "policy-1",
          timestamp: "2026-04-12T09:00:00.000Z",
          action: "start_checkout",
          outcome: "allow",
          reasonCodes: ["SCREENING_READY"],
          summary: "Policy evaluated for screening.start_checkout",
        },
      ],
      automation: [
        {
          id: "automation-1",
          timestamp: "2026-04-12T09:01:00.000Z",
          action: "screening.auto_start_checkout",
          executed: true,
          skipped: false,
          summary: "Automation executed for screening.auto_start_checkout",
        },
      ],
      reconciliation: {
        status: "fulfilled",
        reasons: [{ code: "RECON_FULFILLED" }],
      },
      sla: {
        version: "v1",
        resource: { type: "application", id: "app-1" },
        context: {
          triageCategory: "screening_reconciliation",
          triageSeverity: "critical",
          assignmentOwnerId: "admin-1",
          assignmentOwnerLabel: "Morgan Ops",
        },
        age: {
          firstSeenAt: "2026-04-12T09:00:00.000Z",
          lastSeenAt: "2026-04-12T11:30:00.000Z",
          ageMs: 9_000_000,
          ageHours: 2.5,
        },
        sla: {
          stage: "fresh",
          escalationLevel: "none",
          thresholdHours: { aging: 6, dueSoon: 12, overdue: 24, escalated: 36 },
        },
        reason: {
          code: "SLA_FRESH",
          summary: "This issue is within the initial response window.",
        },
        evaluatedAt: "2026-04-12T11:30:00.000Z",
      },
      assignment: {
        version: "v1",
        id: "assignment-1",
        resource: { type: "application", id: "app-1" },
        currentOwner: { ownerId: "admin-1", ownerLabel: "Morgan Ops" },
        createdAt: "2026-04-12T11:00:00.000Z",
        updatedAt: "2026-04-12T11:20:00.000Z",
        history: [{ id: "assign-1", timestamp: "2026-04-12T11:00:00.000Z", action: "set", toOwnerId: "admin-1", toOwnerLabel: "Morgan Ops" }],
      },
      resolution: {
        version: "v1",
        id: "resolution-1",
        resource: { type: "application", id: "app-1" },
        triage: { reasonCode: "TRIAGE_PAID_NOT_FULFILLED" },
        status: "acknowledged",
        createdAt: "2026-04-12T11:00:00.000Z",
        updatedAt: "2026-04-12T11:30:00.000Z",
        notes: [{ id: "note-1", createdAt: "2026-04-12T11:10:00.000Z", message: "Investigating." }],
        history: [{ id: "hist-1", timestamp: "2026-04-12T11:00:00.000Z", toStatus: "open" }],
      },
      debug: {
        canonicalEventCount: 4,
        domainsPresent: ["application", "screening"],
        identifiers: { propertyId: "prop-1" },
      },
    } as any);

    renderPage("/admin/support-console?resourceType=application&resourceId=app-1");

    expect(await screen.findByText(/Alex Tenant/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Derived insight/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Reconciliation$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^SLA$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Assignment$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Resolution$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Policy decisions/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Automation history/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Timeline$/i })).toBeInTheDocument();
    expect(screen.getByText(/Screening completed for this application/i)).toBeInTheDocument();
    expect(screen.getByText(/Assigned:\s*Morgan Ops/i)).toBeInTheDocument();
    expect(screen.getByText(/This issue is within the initial response window/i)).toBeInTheDocument();
  });

  it("renders an empty state before a lookup", async () => {
    renderPage();
    expect(
      screen.getByText(/Enter a resource type and ID to inspect timeline, policy, automation, and reconciliation state/i)
    ).toBeInTheDocument();
  });

  it("renders an error state", async () => {
    const { fetchSupportConsoleResource } = await import("../../api/supportConsoleApi");
    vi.mocked(fetchSupportConsoleResource).mockRejectedValue(new Error("Boom"));

    renderPage();
    fireEvent.change(screen.getByLabelText(/Resource ID/i), { target: { value: "lease-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Inspect resource/i }));

    expect(await screen.findByText(/Failed to load support console: Boom/i)).toBeInTheDocument();
  });

  it("renders policy and automation sections when present and hides reconciliation when not applicable", async () => {
    const { fetchSupportConsoleResource } = await import("../../api/supportConsoleApi");
    vi.mocked(fetchSupportConsoleResource).mockResolvedValue({
      resource: {
        type: "maintenance",
        id: "maint-1",
        title: "Broken heater",
      },
      timeline: [],
      insight: { summary: { lifecycleState: "assigned" } },
      policyDecisions: [
        {
          id: "policy-1",
          timestamp: "2026-04-12T09:00:00.000Z",
          action: "approve_cost",
          outcome: "review",
          reasonCodes: ["MAINTENANCE_COST_REVIEW_REQUIRED"],
        },
      ],
      automation: [
        {
          id: "automation-1",
          timestamp: "2026-04-12T09:01:00.000Z",
          action: "maintenance.auto_approve_cost",
          executed: false,
          skipped: true,
          reason: "MAINTENANCE_AUTO_APPROVE_COST_POLICY_REVIEW_REQUIRED",
        },
      ],
      reconciliation: null,
      sla: null,
      assignment: null,
      resolution: null,
      debug: {
        canonicalEventCount: 2,
        domainsPresent: ["maintenance", "policy", "system"],
        identifiers: {},
      },
    } as any);

    renderPage();
    fireEvent.change(screen.getByLabelText(/Resource type/i), { target: { value: "maintenance" } });
    fireEvent.change(screen.getByLabelText(/Resource ID/i), { target: { value: "maint-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Inspect resource/i }));

    await waitFor(() => {
      expect(screen.getByText(/Broken heater/i)).toBeInTheDocument();
      expect(screen.getByText(/^approve_cost$/i)).toBeInTheDocument();
      expect(screen.getByText(/^maintenance\.auto_approve_cost$/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Reconciliation$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No resolution record exists yet for this resource/i)).toBeInTheDocument();
  });

  it("renders support-safe institution access diagnostics without raw trust data", async () => {
    const { fetchSupportConsoleResource } = await import("../../api/supportConsoleApi");
    vi.mocked(fetchSupportConsoleResource).mockResolvedValue({
      resource: {
        type: "institution_access",
        id: "grant-1",
        title: "Institution access for Example Insurance",
        subtitle: "Audience insurer • Purpose insurance_review",
        status: "active",
      },
      timeline: [],
      insight: {
        lifecycle: "active",
        audience: "insurer",
        purpose: "insurance_review",
        lastOutcome: "blocked",
        lastReason: "recipient_email_mismatch",
      },
      policyDecisions: [],
      automation: [],
      reconciliation: null,
      sla: null,
      assignment: null,
      resolution: null,
      institutionAccessDiagnostic: {
        schemaVersion: "support_institution_access_diagnostics.v1",
        grantId: "grant-1",
        lifecycle: "active",
        audience: "insurer",
        purpose: "insurance_review",
        recipient: {
          redactedEmail: "re***@example.com",
          organizationName: "Example Insurance",
          authenticationRequirement: "recipient_email_session_required",
        },
        tenant: { redactedTenantId: "***nt-1" },
        consent: {
          granted: true,
          consentVersion: "tenant_institution_access_consent.v1",
          grantedAt: "2026-05-01T00:00:00.000Z",
          expiresAt: "2026-06-01T00:00:00.000Z",
          revokedAt: null,
        },
        access: {
          recipientAuthenticationRequired: true,
          sessionBound: true,
          publicAccessEnabled: false,
          publicProfileEnabled: false,
          externalSubmissionEnabled: false,
          downloadEnabled: false,
        },
        package: {
          status: "export_ready",
          blockedReasonCount: 0,
          exportSummaryCount: 1,
        },
        audit: {
          totalEvents: 2,
          openedReviewCount: 1,
          blockedReviewCount: 1,
          revokedAccessCount: 0,
          expiredAccessCount: 0,
          lastActivityAt: "2026-05-02T00:00:00.000Z",
          lastOpenedAt: "2026-05-02T00:00:00.000Z",
          lastBlockedAt: "2026-05-01T00:00:00.000Z",
          lastOutcome: "opened",
          lastReason: "review_available",
          reasonCategories: ["recipient_email_mismatch", "review_available"],
        },
        pilotOperation: {
          schemaVersion: "pilot_institution_review_operation.v1",
          status: "review_escalated",
          statusLabel: "Review escalated",
          escalation: {
            required: true,
            reasons: ["recipient_access_issue"],
            primaryReason: "recipient_access_issue",
          },
          coordination: {
            reviewNeedsFollowUp: true,
            nextOperationalAction: "recipient_followup",
            supportOnly: true,
            freeformNotesEnabled: false,
          },
          continuity: {
            grantLifecycle: "active",
            inviteStatus: "invited",
            deliveryStatus: "sent",
            sessionState: "active",
            trustExportLifecycle: "active",
            revocationVisible: false,
            expirationVisible: false,
            supersessionVisible: false,
            policyDeniedVisible: false,
          },
          reporting: {
            openedReviewCount: 1,
            blockedReviewCount: 1,
            sessionStartedCount: 1,
            deliveryAttemptCount: 1,
            lastActivityAt: "2026-05-02T00:00:00.000Z",
          },
          visibility: {
            tenantVisible: true,
            supportSafe: true,
            operatorVisible: true,
            recipientVisible: false,
            portableVisible: false,
            metadataOnly: true,
            trustPayloadIncluded: false,
            providerPayloadIncluded: false,
            supportMetadataIncluded: false,
            publicAccessEnabled: false,
            downloadEnabled: false,
          },
        },
        observability: {
          schemaVersion: "institution_review_observability.v1",
          operationalHealth: "attention_required",
          lifecycleMetrics: {
            pendingReviewCount: 0,
            activeReviewCount: 0,
            awaitingAuthenticationCount: 0,
            openedReviewCount: 1,
            blockedReviewCount: 1,
            expiredReviewCount: 0,
            revokedReviewCount: 0,
            supersededReviewCount: 0,
            completedReviewCount: 0,
          },
          sessionHealth: {
            sessionStartedCount: 1,
            sessionExpiredCount: 0,
            staleSessionDetected: false,
            replayBlockedCount: 0,
            reauthenticationRequiredCount: 0,
            invalidatedSessionCount: 0,
            continuityState: "active",
          },
          bottlenecks: {
            awaitingAuthentication: false,
            reviewNeverOpened: false,
            deliveryNotSent: false,
            unresolvedBlockedReview: true,
            lifecycleBlocked: false,
            policyDenied: false,
            staleReview: false,
          },
          escalation: {
            followUpRequired: true,
            primaryReason: "recipient_access_issue",
            reasons: ["recipient_access_issue"],
            nextOperationalAction: "recipient_followup",
          },
          conversion: {
            deliveryAttemptCount: 1,
            deliverySent: true,
            reviewOpened: true,
            authenticatedReviewObserved: true,
            completionEvidence: "opened_only",
          },
          auditAlignment: {
            sourceEventCount: 2,
            pilotEventCount: 2,
            lastActivityAt: "2026-05-02T00:00:00.000Z",
            lastObservedReason: "review_available",
            metadataOnly: true,
          },
          visibility: {
            supportSafe: true,
            operatorVisible: true,
            tenantVisible: false,
            recipientVisible: false,
            portableVisible: false,
            metadataOnly: true,
            trustPayloadIncluded: false,
            providerPayloadIncluded: false,
            rawIdentityPayloadIncluded: false,
            rawPropertyPayloadIncluded: false,
            supportMetadataIncluded: false,
            publicAccessEnabled: false,
            downloadEnabled: false,
          },
        },
        payloadSafety: {
          metadataOnly: true,
          supportSafe: true,
          trustPayloadIncluded: false,
          portableAttestationContentsIncluded: false,
          rawProviderPayloadIncluded: false,
          rawIdentityPayloadIncluded: false,
          rawPropertyPayloadIncluded: false,
          supportMetadataIncluded: false,
          unsafePortablePayloadDetected: false,
        },
        timeline: [
          {
            eventType: "recipient_trust_review_blocked",
            occurredAt: "2026-05-01T00:00:00.000Z",
            actorType: "recipient",
            outcome: "blocked",
            status: "recipient_mismatch",
            reason: "recipient_email_mismatch",
            metadataOnly: true,
          },
        ],
      },
      operatorAuditTimeline: {
        schemaVersion: "operator_audit_timeline.v1",
        metadataOnly: true,
        supportSafe: true,
        eventCount: 3,
        lifecycleTransitionCount: 1,
        revocationCount: 0,
        expirationCount: 0,
        supersessionCount: 1,
        policyDeniedCount: 1,
        sessionEventCount: 1,
        operatorInteractionCount: 1,
        firstEventAt: "2026-05-01T00:00:00.000Z",
        lastEventAt: "2026-05-04T00:00:00.000Z",
        events: [
          {
            schemaVersion: "operator_audit_timeline_event.v1",
            eventId: "operator-1",
            source: "operator_interaction",
            category: "operator_access",
            eventType: "system.institution_access_diagnostics_opened",
            occurredAt: "2026-05-04T00:00:00.000Z",
            actorType: "operator",
            status: "completed",
            outcome: "completed",
            reason: "support_diagnostics",
            lifecycleState: null,
            audience: null,
            purpose: null,
            resource: { type: "tenant_institution_access_grant", id: "grant-1", redactedId: "***nt-1" },
            operator: { redactedOperatorId: "***or-1", role: "admin" },
            metadataOnly: true,
            visibility: {
              supportVisible: true,
              tenantVisible: false,
              recipientVisible: false,
              portableVisible: false,
              trustPayloadIncluded: false,
              providerPayloadIncluded: false,
              rawIdentityPayloadIncluded: false,
              rawPropertyPayloadIncluded: false,
              supportMetadataIncluded: false,
              downloadEnabled: false,
              publicAccessEnabled: false,
            },
          },
          {
            schemaVersion: "operator_audit_timeline_event.v1",
            eventId: "export-1",
            source: "tenant_trust_export",
            category: "trust_export_lifecycle",
            eventType: "trust_export_superseded",
            occurredAt: "2026-05-03T00:00:00.000Z",
            actorType: "system",
            status: "superseded",
            outcome: "inactive",
            reason: "export_superseded",
            lifecycleState: "superseded",
            audience: "insurer",
            purpose: "insurance_review",
            resource: { type: "tenant_trust_export", id: "trust-export-1", redactedId: "***rt-1" },
            metadataOnly: true,
            visibility: {
              supportVisible: true,
              tenantVisible: false,
              recipientVisible: false,
              portableVisible: false,
              trustPayloadIncluded: false,
              providerPayloadIncluded: false,
              rawIdentityPayloadIncluded: false,
              rawPropertyPayloadIncluded: false,
              supportMetadataIncluded: false,
              downloadEnabled: false,
              publicAccessEnabled: false,
            },
          },
          {
            schemaVersion: "operator_audit_timeline_event.v1",
            eventId: "session-1",
            source: "recipient_session",
            category: "recipient_session",
            eventType: "recipient_review_session_started",
            occurredAt: "2026-05-01T00:00:00.000Z",
            actorType: "recipient",
            status: "active",
            outcome: "session_started",
            reason: "session_started",
            lifecycleState: "active",
            audience: "insurer",
            purpose: "insurance_review",
            resource: { type: "tenant_institution_access_grant", id: "grant-1", redactedId: "***nt-1" },
            metadataOnly: true,
            visibility: {
              supportVisible: true,
              tenantVisible: false,
              recipientVisible: false,
              portableVisible: false,
              trustPayloadIncluded: false,
              providerPayloadIncluded: false,
              rawIdentityPayloadIncluded: false,
              rawPropertyPayloadIncluded: false,
              supportMetadataIncluded: false,
              downloadEnabled: false,
              publicAccessEnabled: false,
            },
          },
        ],
        payloadSafety: {
          trustPayloadIncluded: false,
          portableAttestationContentsIncluded: false,
          rawProviderPayloadIncluded: false,
          rawIdentityPayloadIncluded: false,
          rawPropertyPayloadIncluded: false,
          supportMetadataIncluded: false,
          downloadableArtifactIncluded: false,
          publicAccessEnabled: false,
        },
      },
      debug: {
        canonicalEventCount: 0,
        domainsPresent: [],
        identifiers: { grantId: "***nt-1" },
      },
    } as any);

    renderPage();
    fireEvent.change(screen.getByLabelText(/Resource type/i), { target: { value: "institution_access" } });
    fireEvent.change(screen.getByLabelText(/Resource ID/i), { target: { value: "grant-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Inspect resource/i }));

    await waitFor(() => {
      expect(screen.getByText(/Institution access diagnostics/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/re\*\*\*@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/recipient_email_mismatch, review_available/i)).toBeInTheDocument();
    expect(screen.getByText(/Pilot status/i)).toBeInTheDocument();
    expect(screen.getByText(/Review escalated/i)).toBeInTheDocument();
    expect(screen.getByText(/recipient_followup/i)).toBeInTheDocument();
    expect(screen.getByText(/Review health/i)).toBeInTheDocument();
    expect(screen.getByText(/attention_required/i)).toBeInTheDocument();
    expect(screen.getByText(/Replay blocks/i)).toBeInTheDocument();
    expect(screen.getByText(/Completion evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Trust payloads, portable attestation contents, provider payloads/i)).toBeInTheDocument();
    expect(screen.getByText(/Operator audit timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/trust_export_superseded/i)).toBeInTheDocument();
    expect(screen.getByText(/Operator: \*\*\*or-1 · admin/i)).toBeInTheDocument();
    expect(screen.queryByText(/reviewer@example\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/includedClaims/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/exportSummaries/i)).not.toBeInTheDocument();
  });
});
