import { describe, expect, it } from "vitest";

import {
  buildEscalationGovernedReviewWorkspaceSummary,
  buildGovernedReviewWorkspaceSummary,
  buildIncidentGovernedReviewWorkspaceSummary,
  normalizeGovernedReviewWorkspaceType,
} from "../governedReviewWorkspaces";

const workspaceLink = {
  escalationReviewWorkspaceLinkVersion: "escalation_review_workspace_linking_v1" as const,
  linkId: "workspace_link:safe",
  linkType: "incident_to_escalation" as const,
  sourceSummary: {
    kind: "security_incident" as const,
    label: "Projection Safety Redaction",
    category: "projection_safety_redaction",
    severity: "high",
    state: "reviewing",
    metadataOnly: true as const,
    rawIdsIncluded: false as const,
  },
  targetSummary: {
    kind: "support_escalation" as const,
    label: "Projection Safety escalation",
    category: "projection_safety",
    severity: "high",
    state: "awaiting_approval",
    metadataOnly: true as const,
    rawIdsIncluded: false as const,
  },
  workflowFamily: "admin_security_incident_review",
  createdAt: "2026-05-24T01:00:00.000Z",
  derivedAt: "2026-05-24T01:00:00.000Z",
  metadataOnly: true as const,
  visibilityClass: "admin_support_internal" as const,
  tenantVisible: false as const,
  landlordVisible: false as const,
  appendCompatible: true as const,
  supportPowersGranted: false as const,
  impersonationEnabled: false as const,
  autonomousRemediationEnabled: false as const,
  autonomousEscalationEnabled: false as const,
  financialMutationEnabled: false as const,
  routeVisibilityChanged: false as const,
  mutationControlsEnabled: false as const,
  redactionSummary: "Metadata-only.",
};

describe("governed review workspaces", () => {
  it("normalizes workspace types and fails safe for unsupported values", () => {
    expect(normalizeGovernedReviewWorkspaceType("projection-safety review")).toBe("projection_safety_review");
    expect(normalizeGovernedReviewWorkspaceType("raw_admin_console")).toBe("other");
  });

  it("builds metadata-only workspace summaries with safe labels and flags", () => {
    const workspace = buildGovernedReviewWorkspaceSummary({
      workspaceType: "security_review",
      title: "abcdefghijklmnopqrstuvwxyz1234567890",
      summary: "token=secret gs://bucket/raw.pdf",
      workflowFamily: "policy.failure",
      severity: "critical",
      reviewState: "reviewing",
      approvalExpectation: "security_review",
      relatedIncidentCount: 1,
      relatedEscalationCount: 1,
      relatedEvidenceCount: 1,
      relatedNoteCount: 2,
      safeEvidenceRefs: [
        {
          referenceType: "evidence_pack",
          referenceId: "evidence-1",
          label: "https://storage.googleapis.com/bucket/raw.pdf",
          landlordId: "landlord-raw",
          tenantId: "tenant-raw",
        },
        {
          referenceType: "unsupported_debug" as any,
          referenceId: "debug-1",
          label: "Debug context",
        },
      ],
      relatedWorkspaceLinks: [workspaceLink],
    });

    expect(workspace).toEqual(
      expect.objectContaining({
        workspaceType: "security_review",
        title: "Governed review workspace",
        summary: "Metadata-only review workspace summary. Raw payloads and tenant/landlord-facing details are excluded.",
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendCompatible: true,
        supportPowersGranted: false,
        impersonationEnabled: false,
        autonomousRemediationEnabled: false,
        autonomousEscalationEnabled: false,
        financialMutationEnabled: false,
        routeVisibilityChanged: false,
        mutationControlsEnabled: false,
        rawPayloadAccessEnabled: false,
      })
    );
    expect(workspace.safeEvidenceRefs[0]).toEqual(
      expect.objectContaining({
        label: "evidence pack reference",
        landlordId: null,
        tenantId: null,
        metadataOnly: true,
      })
    );
    expect(workspace.safeEvidenceRefs[1].referenceType).toBe("support_diagnostic");
    expect(JSON.stringify(workspace)).not.toContain("landlord-raw");
    expect(JSON.stringify(workspace)).not.toContain("tenant-raw");
    expect(JSON.stringify(workspace)).not.toContain("token=secret");
    expect(JSON.stringify(workspace)).not.toContain("gs://");
  });

  it("derives incident workspace summaries from safe incident metadata", () => {
    const workspace = buildIncidentGovernedReviewWorkspaceSummary({
      incidentReviewVersion: "admin_security_incident_review_v1",
      incidentId: "security_incident:safe",
      category: "projection_safety_redaction",
      severity: "high",
      status: "reviewing",
      title: "Projection Safety Redaction",
      summary: "Projection safety metadata requires review.",
      occurredAt: "2026-05-24T01:00:00.000Z",
      lastSeenAt: "2026-05-24T01:05:00.000Z",
      actorSummary: { role: "admin", supportAttribution: true, rawActorIdsIncluded: false },
      targetSummary: { accountType: "tenant", resourceType: "review_workspace", landlordScoped: true, tenantScoped: true, rawTargetIdsIncluded: false },
      workflowFamily: "admin_security_incident_review",
      policyOutcomeSummary: "redacted",
      sourceRoute: "/api/admin/security/incidents",
      routeSource: "adminSecurityIncidentRoutes.ts",
      metadataOnly: true,
      redactionSummary: "Restricted fields excluded.",
      recommendedReviewAction: "Review projection boundary.",
      safeEvidenceReferences: [{ referenceType: "evidence", referenceId: "evidence:safe", label: "Evidence metadata reference", internalReference: true }],
      timeline: [],
      relatedEventSummaries: [],
      redactionNotes: [],
      suggestedNextReviewStep: "Review projection boundary.",
      relatedWorkspaceLinks: [workspaceLink],
      governedReviewWorkspace: null as any,
    });

    expect(workspace.workspaceType).toBe("projection_safety_review");
    expect(workspace.relatedIncidentCount).toBe(1);
    expect(workspace.relatedEscalationCount).toBe(1);
    expect(workspace.relatedWorkspaceLinks).toHaveLength(1);
  });

  it("derives support escalation workspace summaries from safe escalation metadata", () => {
    const workspace = buildEscalationGovernedReviewWorkspaceSummary({
      escalationReviewVersion: "admin_support_escalation_review_v1",
      escalationId: "escalation-safe",
      category: "projection_safety",
      severity: "high",
      state: "awaiting_approval",
      approvalExpectation: "admin_review",
      title: "Projection Safety escalation",
      summary: "Projection safety escalation metadata.",
      createdAt: "2026-05-24T01:10:00.000Z",
      lastUpdatedAt: "2026-05-24T01:20:00.000Z",
      actorSummary: { role: "admin", displayName: "Security operator", supportAttribution: true, rawActorIdsIncluded: false },
      safeEvidenceRefs: [{ referenceType: "incident", referenceId: "incident-safe", label: "Linked incident", landlordId: null, tenantId: null, internalReference: true, metadataOnly: true }],
      historyCount: 1,
      noteCount: 2,
      metadataOnly: true,
      visibilityClass: "admin_support_internal",
      tenantVisible: false,
      landlordVisible: false,
      relatedWorkspaceLinks: [workspaceLink],
    });

    expect(workspace.workspaceType).toBe("projection_safety_review");
    expect(workspace.relatedEscalationCount).toBe(1);
    expect(workspace.relatedNoteCount).toBe(2);
    expect(workspace.approvalExpectationSummary).toBe("admin_review");
  });
});
