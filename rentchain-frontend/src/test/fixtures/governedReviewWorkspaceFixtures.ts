import type {
  GovernedReviewWorkspaceDetail,
  GovernedReviewWorkspaceRecord,
  GovernedReviewWorkspaceSummary,
} from "../../api/adminReviewWorkspacesApi";

export const governedReviewWorkspaceFixtureScope = {
  fixtureOnly: true,
  productionRuntime: false,
  firestoreWrites: false,
  publicRoutes: false,
  mutationControlsEnabled: false,
  tenantVisible: false,
  landlordVisible: false,
} as const;

export const governedReviewWorkspaceFixtureDates = {
  now: "2026-05-24T12:00:00.000Z",
  retentionReview: "2026-06-24T12:00:00.000Z",
} as const;

const payloadSafety = {
  rawNotes: "excluded",
  rawDocuments: "excluded",
  providerPayloads: "excluded",
  storagePaths: "excluded",
  tokens: "excluded",
  secrets: "excluded",
  debugPayloads: "excluded",
  requestResponseBodies: "excluded",
} as const;

function record(input: {
  workspaceId: string;
  workspaceType: string;
  title: string;
  summary: string;
  workflowFamily: string;
  severitySummary: string;
  reviewStateSummary: string;
  approvalExpectationSummary: string;
  relatedIncidentCount?: number;
  relatedEscalationCount?: number;
  relatedEvidenceCount?: number;
  relatedNoteCount?: number;
  appendEventCount?: number;
}): GovernedReviewWorkspaceRecord {
  return {
    workspaceId: input.workspaceId,
    workspaceType: input.workspaceType,
    title: input.title,
    summary: input.summary,
    workflowFamily: input.workflowFamily,
    severitySummary: input.severitySummary,
    reviewStateSummary: input.reviewStateSummary,
    approvalExpectationSummary: input.approvalExpectationSummary,
    relatedIncidentCount: input.relatedIncidentCount ?? 0,
    relatedEscalationCount: input.relatedEscalationCount ?? 0,
    relatedEvidenceCount: input.relatedEvidenceCount ?? 1,
    relatedNoteCount: input.relatedNoteCount ?? 1,
    appendEventCount: input.appendEventCount ?? 1,
    retentionClass: input.workspaceType,
    retentionReviewAt: governedReviewWorkspaceFixtureDates.retentionReview,
    lastAppendedAt: governedReviewWorkspaceFixtureDates.now,
    metadataOnly: true,
    visibilityClass: "admin_support_internal",
    tenantVisible: false,
    landlordVisible: false,
    appendOnly: true,
    mutationControlsEnabled: false,
    rawPayloadAccessEnabled: false,
  };
}

function detail(base: GovernedReviewWorkspaceRecord, input: {
  evidenceLabel: string;
  linkType: string;
  sourceLabel: string;
  targetLabel: string;
  eventSummary: string;
}): GovernedReviewWorkspaceDetail {
  return {
    ...base,
    safeEvidenceRefs: [
      {
        referenceType: "evidence_metadata",
        referenceId: `${base.workspaceType}_fixture_ref`,
        label: input.evidenceLabel,
        internalReference: true,
        metadataOnly: true,
      },
    ],
    relatedWorkspaceLinks: [
      {
        linkId: `${base.workspaceType}_fixture_link`,
        linkType: input.linkType,
        sourceSummary: {
          kind: "governed_review_source",
          label: input.sourceLabel,
          category: base.workspaceType,
          severity: base.severitySummary,
          state: base.reviewStateSummary,
          metadataOnly: true,
          rawIdsIncluded: false,
        },
        targetSummary: {
          kind: "governed_review_workspace",
          label: input.targetLabel,
          category: base.workspaceType,
          severity: base.severitySummary,
          state: base.reviewStateSummary,
          metadataOnly: true,
          rawIdsIncluded: false,
        },
        workflowFamily: base.workflowFamily || "governed_review_workspace",
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
        eventRefId: `${base.workspaceType}_fixture_append_event`,
        eventType: "workspace_candidate_created",
        eventSummary: input.eventSummary,
        occurredAt: governedReviewWorkspaceFixtureDates.now,
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendOnly: true,
      },
    ],
    redactionSummary:
      "Fixture excludes raw notes, documents, provider payloads, storage paths, tokens, secrets, debug payloads, and request or response bodies.",
    payloadSafety,
    persistenceDecision: "test_fixture_only_no_firestore_writes",
  };
}

export const governedReviewWorkspaceFixtureRecords: GovernedReviewWorkspaceRecord[] = [
  record({
    workspaceId: "fixture_workspace_security_review",
    workspaceType: "security_review",
    title: "Security review workspace",
    summary: "Metadata-only review of policy and route-source signals.",
    workflowFamily: "admin_security_incident_review",
    severitySummary: "medium",
    reviewStateSummary: "metadata_review_ready",
    approvalExpectationSummary: "admin_review",
    relatedIncidentCount: 2,
  }),
  record({
    workspaceId: "fixture_workspace_support_escalation_review",
    workspaceType: "support_escalation_review",
    title: "Support escalation review workspace",
    summary: "Metadata-only review of manual support escalation context.",
    workflowFamily: "admin_support_escalation_review",
    severitySummary: "high",
    reviewStateSummary: "manual_review_required",
    approvalExpectationSummary: "support_lead_review",
    relatedEscalationCount: 1,
  }),
  record({
    workspaceId: "fixture_workspace_export_governance_review",
    workspaceType: "export_governance_review",
    title: "Export governance review workspace",
    summary: "Metadata-only review of export readiness and redaction posture.",
    workflowFamily: "export_governance_review",
    severitySummary: "low",
    reviewStateSummary: "metadata_review_ready",
    approvalExpectationSummary: "metadata_review_only",
    relatedEvidenceCount: 2,
  }),
  record({
    workspaceId: "fixture_workspace_evidence_review",
    workspaceType: "evidence_review",
    title: "Evidence review workspace",
    summary: "Metadata-only review of safe evidence references and linkage.",
    workflowFamily: "evidence_review",
    severitySummary: "medium",
    reviewStateSummary: "metadata_review_ready",
    approvalExpectationSummary: "admin_review",
    relatedEvidenceCount: 3,
    relatedNoteCount: 2,
  }),
];

export const governedReviewWorkspaceFixtureDetails: Record<string, GovernedReviewWorkspaceDetail> = Object.fromEntries(
  governedReviewWorkspaceFixtureRecords.map((item) => [
    item.workspaceId,
    detail(item, {
      evidenceLabel: `${item.title} evidence metadata`,
      linkType:
        item.workspaceType === "security_review"
          ? "incident_to_review_workspace"
          : item.workspaceType === "support_escalation_review"
            ? "escalation_to_runbook"
            : item.workspaceType === "export_governance_review"
              ? "escalation_to_evidence"
              : "incident_to_evidence",
      sourceLabel: item.workspaceType === "support_escalation_review" ? "Support escalation summary" : "Governed review source",
      targetLabel: "Governed review workspace",
      eventSummary: `${item.title} fixture candidate created.`,
    }),
  ]),
) as Record<string, GovernedReviewWorkspaceDetail>;

export const governedReviewWorkspaceFixtureSummary: GovernedReviewWorkspaceSummary = {
  total: governedReviewWorkspaceFixtureRecords.length,
  metadataOnly: true,
  emptyState: null,
};

export function getGovernedReviewWorkspaceFixtureResponse() {
  return {
    ok: true as const,
    workspaces: governedReviewWorkspaceFixtureRecords,
    summary: governedReviewWorkspaceFixtureSummary,
    schema: {
      metadataOnly: true as const,
      visibilityClass: "admin_support_internal" as const,
      tenantVisible: false as const,
      landlordVisible: false as const,
      appendOnly: true as const,
      persistence: "read_only_if_present" as const,
      mutationControlsEnabled: false as const,
      rawPayloadAccessEnabled: false as const,
      createRouteEnabled: false as const,
      updateRouteEnabled: false as const,
      deleteRouteEnabled: false as const,
    },
  };
}

export function getGovernedReviewWorkspaceFixtureDetail(workspaceId: string) {
  return {
    ok: true as const,
    workspace:
      governedReviewWorkspaceFixtureDetails[workspaceId] ||
      governedReviewWorkspaceFixtureDetails[governedReviewWorkspaceFixtureRecords[0].workspaceId],
  };
}
