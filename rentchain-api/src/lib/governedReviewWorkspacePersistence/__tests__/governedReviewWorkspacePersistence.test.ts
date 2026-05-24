import { describe, expect, it } from "vitest";

import {
  buildGovernedReviewWorkspacePersistenceRecord,
  normalizeGovernedReviewWorkspaceAppendEventType,
  normalizeGovernedReviewWorkspaceRetentionClass,
  validateGovernedReviewWorkspacePersistenceCandidate,
} from "../governedReviewWorkspacePersistence";

const safeWorkspaceLink = {
  escalationReviewWorkspaceLinkVersion: "escalation_review_workspace_linking_v1" as const,
  linkId: "workspace_link:safe",
  linkType: "incident_to_review_workspace" as const,
  sourceSummary: {
    kind: "security_incident" as const,
    label: "Security incident",
    category: "policy_denied",
    severity: "medium",
    state: "open",
    metadataOnly: true as const,
    rawIdsIncluded: false as const,
  },
  targetSummary: {
    kind: "review_workspace" as const,
    label: "Governed workspace",
    category: "security_review",
    severity: "medium",
    state: "metadata_review_ready",
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

describe("governed review workspace persistence readiness", () => {
  it("normalizes retention classes and append event types with fail-safe defaults", () => {
    expect(normalizeGovernedReviewWorkspaceRetentionClass("security-review")).toBe("security_review");
    expect(normalizeGovernedReviewWorkspaceRetentionClass("raw_forever_store")).toBe("other");
    expect(normalizeGovernedReviewWorkspaceAppendEventType("workspace.link.added")).toBe("workspace_link_added");
    expect(normalizeGovernedReviewWorkspaceAppendEventType("approve_and_resolve")).toBe("workspace_candidate_created");
  });

  it("builds contract-only append-compatible persistence records", () => {
    const record = buildGovernedReviewWorkspacePersistenceRecord({
      workspaceType: "security_review",
      title: "Security review workspace",
      summary: "Metadata-only persistence readiness.",
      workflowFamily: "admin_security_incident_review",
      severity: "medium",
      reviewState: "metadata_review_ready",
      approvalExpectation: "admin_review",
      retentionClass: "security_review",
      retentionReason: "Security review metadata retention readiness.",
      createdAt: "2026-05-24T01:00:00.000Z",
      safeEvidenceRefs: [
        {
          referenceType: "evidence_pack",
          referenceId: "evidence-safe",
          label: "Evidence metadata reference",
          landlordId: "landlord-raw",
          tenantId: "tenant-raw",
        },
      ],
      relatedWorkspaceLinks: [safeWorkspaceLink],
      appendEvents: [
        {
          eventType: "workspace_evidence_ref_added",
          eventSummary: "Evidence reference added.",
          actor: { role: "admin", displayName: "Security operator", actorId: "raw-actor-id" },
          occurredAt: "2026-05-24T01:05:00.000Z",
        },
      ],
    });

    expect(record).toEqual(
      expect.objectContaining({
        workspaceType: "security_review",
        retentionClass: "security_review",
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendCompatible: true,
        appendOnly: true,
        firestoreWriteEnabled: false,
        createRouteEnabled: false,
        updateRouteEnabled: false,
        deleteRouteEnabled: false,
        statusMutationEnabled: false,
        tenantLandlordProjectionEnabled: false,
        persistenceDecision: "contract_only_firestore_deferred",
      })
    );
    expect(record.appendEventRefs[0]).toEqual(
      expect.objectContaining({
        eventType: "workspace_evidence_ref_added",
        metadataOnly: true,
        appendOnly: true,
        rawPayloadAccessEnabled: false,
      })
    );
    expect(record.safeEvidenceRefs[0]).toEqual(
      expect.objectContaining({
        landlordId: null,
        tenantId: null,
        metadataOnly: true,
      })
    );
    expect(JSON.stringify(record)).not.toContain("landlord-raw");
    expect(JSON.stringify(record)).not.toContain("tenant-raw");
    expect(JSON.stringify(record)).not.toContain("raw-actor-id");
  });

  it("sanitizes unsafe candidate inputs and reports warnings", () => {
    const validation = validateGovernedReviewWorkspacePersistenceCandidate({
      workspaceType: "projection_safety_review",
      title: "abcdefghijklmnopqrstuvwxyz1234567890",
      summary: "Bearer raw.token.value requestBody={raw} stackTrace=unsafe",
      retentionReason: "secret=value gs://bucket/raw.pdf",
      createdAt: "2026-05-24T01:00:00.000Z",
      safeEvidenceRefs: [
        {
          referenceType: "document",
          referenceId: "doc-safe",
          label: "https://storage.googleapis.com/bucket/raw.pdf",
        },
      ],
      appendEvents: [
        {
          eventType: "debug_payload_added",
          eventSummary: "token=secret responseBody={raw}",
          actor: { authorization: "Bearer raw", cookie: "session=raw", displayName: "Support" },
        },
      ],
    });

    expect(validation.ok).toBe(true);
    expect(validation.warnings).toEqual(
      expect.arrayContaining([
        "restricted_credential_or_secret_like_input_sanitized",
        "storage_path_or_signed_url_input_sanitized",
        "raw_payload_input_excluded_from_contract",
      ])
    );
    expect(validation.record.title).toBe("Governed review workspace");
    expect(validation.record.retentionReason).toBe("Metadata-only governed review workspace retention candidate.");
    expect(validation.record.safeEvidenceRefs[0].label).toBe("document reference");
    expect(validation.record.appendEventRefs[0].eventType).toBe("workspace_candidate_created");
    expect(validation.record.appendEventRefs[0].eventSummary).toBe("workspace candidate created metadata event");
    expect(JSON.stringify(validation.record)).not.toContain("raw.token.value");
    expect(JSON.stringify(validation.record)).not.toContain("gs://");
    expect(JSON.stringify(validation.record)).not.toContain("storage.googleapis.com");
    expect(JSON.stringify(validation.record)).not.toContain("responseBody");
  });

  it("forces unsafe workspace summary visibility to internal metadata-only contract", () => {
    const validation = validateGovernedReviewWorkspacePersistenceCandidate({
      workspaceSummary: {
        metadataOnly: true,
        tenantVisible: true as any,
        landlordVisible: true as any,
        workspaceType: "support_escalation_review",
        title: "Support escalation workspace",
        summary: "Support escalation metadata.",
        workflowFamily: "admin_support_escalation_review",
        severitySummary: "low",
        reviewStateSummary: "metadata_review_ready",
        approvalExpectationSummary: "none_for_metadata_review",
        relatedIncidentCount: 0,
        relatedEscalationCount: 1,
        relatedEvidenceCount: 0,
        relatedNoteCount: 0,
        safeEvidenceRefs: [],
        relatedWorkspaceLinks: [],
      },
    });

    expect(validation.warnings).toContain("tenant_or_landlord_visibility_forced_false");
    expect(validation.record.tenantVisible).toBe(false);
    expect(validation.record.landlordVisible).toBe(false);
    expect(validation.record.workspaceSummary.tenantVisible).toBe(false);
    expect(validation.record.workspaceSummary.landlordVisible).toBe(false);
    expect(validation.record.supportPowersGranted).toBe(false);
    expect(validation.record.autonomousRemediationEnabled).toBe(false);
    expect(validation.record.mutationControlsEnabled).toBe(false);
  });
});
