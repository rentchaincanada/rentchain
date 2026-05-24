import { describe, expect, it } from "vitest";

import {
  buildEscalationReviewWorkspaceLink,
  buildEscalationWorkspaceLinks,
  buildIncidentWorkspaceLinks,
} from "../escalationReviewWorkspaceLinks";

const incident = {
  incidentReviewVersion: "admin_security_incident_review_v1" as const,
  incidentId: "security_incident:abc123",
  category: "projection_safety_redaction" as const,
  severity: "high" as const,
  status: "reviewing" as const,
  title: "Projection Safety Redaction",
  summary: "Projection safety metadata requires review.",
  occurredAt: "2026-05-24T01:00:00.000Z",
  lastSeenAt: "2026-05-24T01:05:00.000Z",
  actorSummary: { role: "admin", supportAttribution: true, rawActorIdsIncluded: false as const },
  targetSummary: {
    accountType: "tenant",
    resourceType: "review_workspace",
    landlordScoped: true,
    tenantScoped: true,
    rawTargetIdsIncluded: false as const,
  },
  workflowFamily: "admin_security_incident_review",
  policyOutcomeSummary: "redacted",
  sourceRoute: "/api/admin/security/incidents",
  routeSource: "adminSecurityIncidentRoutes.ts",
  metadataOnly: true as const,
  redactionSummary: "Restricted fields excluded.",
  recommendedReviewAction: "Review projection boundary.",
  safeEvidenceReferences: [
    {
      referenceType: "evidence" as const,
      referenceId: "evidence:safe",
      label: "Evidence metadata reference",
      internalReference: true as const,
    },
  ],
};

const escalation = {
  escalationReviewVersion: "admin_support_escalation_review_v1" as const,
  escalationId: "escalation-safe",
  category: "projection_safety" as const,
  severity: "high" as const,
  state: "awaiting_approval" as const,
  approvalExpectation: "admin_review" as const,
  title: "Projection Safety escalation",
  summary: "Projection safety review escalation.",
  createdAt: "2026-05-24T01:10:00.000Z",
  lastUpdatedAt: "2026-05-24T01:20:00.000Z",
  actorSummary: { role: "admin", displayName: "Security operator", supportAttribution: true, rawActorIdsIncluded: false as const },
  safeEvidenceRefs: [
    {
      referenceType: "incident" as const,
      referenceId: "abc123",
      label: "Linked incident",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      internalReference: true as const,
      metadataOnly: true as const,
    },
    {
      referenceType: "evidence_pack" as const,
      referenceId: "evidence-pack-safe",
      label: "Evidence pack",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      internalReference: true as const,
      metadataOnly: true as const,
    },
  ],
  historyCount: 1,
  noteCount: 1,
  metadataOnly: true as const,
  visibilityClass: "admin_support_internal" as const,
  tenantVisible: false as const,
  landlordVisible: false as const,
};

describe("escalation review workspace links", () => {
  it("fails safe for unsupported relationship types", () => {
    expect(
      buildEscalationReviewWorkspaceLink({
        linkType: "raw_debug_payload",
        sourceSummary: { kind: "security_incident", label: "Incident" },
        targetSummary: { kind: "support_escalation", label: "Escalation" },
      })
    ).toBeNull();
  });

  it("builds metadata-only incident to escalation and evidence links", () => {
    const links = buildIncidentWorkspaceLinks({ incident, escalations: [escalation], derivedAt: "2026-05-24T02:00:00.000Z" });

    expect(links.map((link) => link.linkType).sort()).toEqual(["incident_to_escalation", "incident_to_evidence"]);
    for (const link of links) {
      expect(link).toEqual(
        expect.objectContaining({
          metadataOnly: true,
          visibilityClass: "admin_support_internal",
          tenantVisible: false,
          landlordVisible: false,
          appendCompatible: true,
          supportPowersGranted: false,
          autonomousRemediationEnabled: false,
          autonomousEscalationEnabled: false,
          mutationControlsEnabled: false,
        })
      );
      expect(link.sourceSummary.rawIdsIncluded).toBe(false);
      expect(link.targetSummary.rawIdsIncluded).toBe(false);
    }
  });

  it("builds escalation runbook, history, note, incident, and evidence links without raw payload labels", () => {
    const links = buildEscalationWorkspaceLinks({
      escalation: {
        ...escalation,
        historyEntries: [
          {
            supportEscalationHistoryVersion: "support_escalation_history_v1",
            historyEntryId: "history-raw-id",
            escalationRefId: "escalation-safe",
            category: "projection_safety",
            severity: "high",
            state: "awaiting_approval",
            actionType: "approval_requested",
            actorSummary: { role: "admin", displayName: "Security operator", supportAttribution: true, rawActorIdsIncluded: false },
            occurredAt: "2026-05-24T01:12:00.000Z",
            noteSummary: "Bearer secret gs://bucket/raw.pdf",
            approvalExpectation: "admin_review",
            safeEvidenceRefs: [],
            resourceRefs: [],
            metadataOnly: true,
            visibilityClass: "admin_support_internal",
            tenantVisible: false,
            landlordVisible: false,
            appendOnly: true,
            supportPowersGranted: false,
            impersonationEnabled: false,
            autonomousRemediationEnabled: false,
            autonomousEscalationEnabled: false,
            financialMutationEnabled: false,
            routeVisibilityChanged: false,
            payloadSafety: {
              rawPayloads: "excluded",
              providerData: "reference_only",
              evidenceData: "reference_only",
              exportData: "reference_only",
              documentData: "reference_only",
              credentialData: "excluded",
              requestResponseData: "excluded",
              diagnosticData: "metadata_only",
              internalPolicyData: "summary_only",
            },
          },
        ],
        reviewNotes: [
          {
            supportEscalationHistoryVersion: "support_escalation_history_v1",
            noteId: "note-raw-id",
            escalationRefId: "escalation-safe",
            noteType: "admin_review_note",
            noteSummary: "authorization=Bearer-secret",
            authorSummary: { role: "admin", displayName: "Security operator", supportAttribution: true, rawActorIdsIncluded: false },
            createdAt: "2026-05-24T01:15:00.000Z",
            safeEvidenceRefs: [],
            resourceRefs: [],
            redactionSummary: "Raw payloads excluded.",
            metadataOnly: true,
            visibilityClass: "admin_support_internal",
            tenantVisible: false,
            landlordVisible: false,
            appendOnly: true,
            supportPowersGranted: false,
            impersonationEnabled: false,
            autonomousRemediationEnabled: false,
            autonomousEscalationEnabled: false,
            financialMutationEnabled: false,
            routeVisibilityChanged: false,
            payloadSafety: {
              rawPayloads: "excluded",
              providerData: "reference_only",
              evidenceData: "reference_only",
              exportData: "reference_only",
              documentData: "reference_only",
              credentialData: "excluded",
              requestResponseData: "excluded",
              diagnosticData: "metadata_only",
              internalPolicyData: "summary_only",
            },
          },
        ],
        redactionSummary: "Metadata-only.",
        prohibitedActions: ["Do not perform autonomous remediation."],
        relatedWorkspaceLinks: [],
        emptyState: false,
      },
      incidents: [incident],
    });

    expect(links.map((link) => link.linkType).sort()).toEqual([
      "escalation_to_evidence",
      "escalation_to_history",
      "escalation_to_note",
      "escalation_to_runbook",
      "incident_to_escalation",
    ]);
    const payload = JSON.stringify(links);
    expect(payload).not.toContain("Bearer-secret");
    expect(payload).not.toContain("gs://");
    expect(payload).not.toContain("history-raw-id");
    expect(payload).not.toContain("note-raw-id");
  });
});
