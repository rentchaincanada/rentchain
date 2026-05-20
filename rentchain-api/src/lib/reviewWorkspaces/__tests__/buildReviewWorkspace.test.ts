import { describe, expect, it } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import {
  buildReviewWorkspace,
  normalizeReviewWorkspace,
  reviewWorkspaceToOperatorReviewOpenRequest,
} from "../buildReviewWorkspace";

const createdBy = { userId: "landlord-user-1", role: "landlord" as const, email: "ops@example.test" };

describe("buildReviewWorkspace", () => {
  it("builds deterministic manual-only review workspaces with scoped evidence linkage", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "delinquency_review",
      workspaceScopeId: "lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      createdBy,
      createdAt: "2026-05-20T10:00:00.000Z",
      assignedReviewer: { userId: "operator-1", role: "operator" },
      reviewPriority: "critical",
      evidenceRefs: [
        {
          evidencePackId: "evidence-1",
          evidenceItemId: "item-1",
          label: "Missing payment evidence",
          sourceCollection: "ledgerEntries",
          sourceId: "ledger-1",
          sensitivityClass: "sensitive",
        },
        {
          evidencePackId: "evidence-1",
          evidenceItemId: "item-1",
          label: "Duplicate should collapse",
          sourceCollection: "ledgerEntries",
          sourceId: "ledger-1",
        },
      ],
      relatedResourceRefs: [
        {
          resourceType: "lease",
          resourceId: "lease-1",
          label: "North Towers · Unit 104 lease context",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          propertyId: "property-1",
          unitId: "unit-104",
          leaseId: "lease-1",
        },
      ],
      createdFromEvent: {
        eventId: "event-1",
        eventType: "decision.workflow.review_required",
        sourceSystem: "decision_workflow",
      },
      auditRefs: [{ auditId: "audit-1", eventType: "operator_review_session_opened", sourceCollection: "canonicalEvents" }],
      reviewSummary: "Review missing payment evidence",
      reviewTags: ["delinquency", "payment evidence", "delinquency"],
    });
    const duplicate = buildReviewWorkspace({
      workspaceType: "delinquency_review",
      workspaceScopeId: "lease-1",
      landlordId: "landlord-1",
      createdBy,
      createdAt: "2026-05-20T10:00:00.000Z",
    });

    expect(workspace.workspaceId).toBe(duplicate.workspaceId);
    expect(workspace).toEqual(
      expect.objectContaining({
        workspaceContractVersion: "review_workspace_foundation_v1",
        workspaceType: "delinquency_review",
        workspaceScope: "delinquency_review",
        workspaceScopeId: "lease-1",
        landlordId: "landlord-1",
        reviewStatus: "open",
        reviewPriority: "critical",
        sensitivityClass: "sensitive",
        visibilityClass: "landlord_operational",
        manualOnly: true,
        autonomousActionsEnabled: false,
        externalSharingEnabled: false,
        institutionalSharingEnabled: false,
        financialMutationEnabled: false,
      })
    );
    expect(workspace.evidenceRefs).toEqual([
      {
        evidencePackId: "evidence-1",
        evidenceItemId: "item-1",
        label: "Missing payment evidence",
        sourceCollection: "ledgerEntries",
        sourceId: "ledger-1",
        sensitivityClass: "sensitive",
      },
    ]);
    expect(workspace.relatedResourceRefs).toEqual([
      expect.objectContaining({
        resourceType: "lease",
        resourceId: "lease-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
      }),
    ]);
    expect(workspace.reviewTags).toEqual(["delinquency", "payment_evidence"]);
  });

  it("excludes unrelated landlord and tenant resources from workspace linkage", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "payment_ledger_review",
      workspaceScopeId: "payment-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      createdBy,
      relatedResourceRefs: [
        { resourceType: "payment", resourceId: "payment-1", label: "Scoped payment", landlordId: "landlord-1", tenantId: "tenant-1" },
        { resourceType: "payment", resourceId: "payment-2", label: "Wrong landlord", landlordId: "landlord-2", tenantId: "tenant-1" },
        { resourceType: "payment", resourceId: "payment-3", label: "Wrong tenant", landlordId: "landlord-1", tenantId: "tenant-2" },
      ],
    });

    expect(workspace.relatedResourceRefs).toEqual([
      expect.objectContaining({ resourceId: "payment-1", label: "Scoped payment" }),
    ]);
    expect(JSON.stringify(workspace)).not.toContain("payment-2");
    expect(JSON.stringify(workspace)).not.toContain("payment-3");
  });

  it("does not duplicate restricted raw payloads into review workspace metadata", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "screening_review",
      workspaceScopeId: "screening-1",
      landlordId: "landlord-1",
      createdBy,
      evidenceRefs: [
        {
          evidencePackId: "evidence-1",
          label: "Screening status evidence",
          rawPayload: { providerPayload: "raw provider dump" },
          rawCsv: "raw csv data",
          bankAccountNumber: "111122223333",
          routeSource: "debug route",
          stack: "private stack trace",
        },
      ],
      relatedResourceRefs: [
        {
          resourceType: "screening_order",
          resourceId: "screening-1",
          label: "Screening review",
          landlordId: "landlord-1",
          providerPayload: "raw provider dump",
          rawReport: "raw bureau report",
          token: "secret-token",
        },
      ],
      reviewNotes: ["<b>Manual review only</b>"],
    });

    expect(workspace.reviewNotes).toEqual(["bManual review only/b"]);
    expectNoRestrictedProjectionFields(workspace);
    expectPayloadDoesNotContainValues(workspace, [
      "raw provider dump",
      "raw csv data",
      "111122223333",
      "debug route",
      "private stack trace",
      "raw bureau report",
      "secret-token",
    ]);
  });

  it("bridges workspaces to existing operator review open requests without autonomous actions", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "evidence_review",
      workspaceScopeId: "evidence-1",
      landlordId: "landlord-1",
      createdBy,
      reviewSummary: "Review evidence package lineage",
      evidenceRefs: [{ evidencePackId: "evidence-1", label: "Evidence pack", sensitivityClass: "restricted" }],
    });

    expect(reviewWorkspaceToOperatorReviewOpenRequest(workspace)).toEqual({
      scope: "audit_compliance",
      scopeId: "evidence-1",
      linkedEvidence: [{ evidenceId: "evidence-1", label: "Evidence pack", kind: "workflow", destination: null }],
      note: "Review evidence package lineage",
    });
  });

  it("normalizes stored workspace records defensively", () => {
    const normalized = normalizeReviewWorkspace({
      workspaceId: "workspace-1",
      workspaceType: "document_review",
      workspaceScopeId: "lease-doc-1",
      landlordId: "landlord-1",
      createdBy,
      createdAt: "2026-05-20T10:00:00.000Z",
      updatedAt: "2026-05-20T10:05:00.000Z",
      reviewStatus: "under_review",
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        workspaceId: "workspace-1",
        workspaceType: "document_review",
        reviewStatus: "under_review",
        updatedAt: "2026-05-20T10:05:00.000Z",
      })
    );
    expect(normalizeReviewWorkspace({ workspaceType: "document_review" })).toBeNull();
  });
});
