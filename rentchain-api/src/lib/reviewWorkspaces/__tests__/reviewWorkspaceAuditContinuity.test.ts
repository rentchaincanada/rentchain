import { describe, expect, it } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import {
  buildReviewWorkspaceInputFromRouting,
  deriveOperationalReviewRouting,
} from "../../operationalReviewRouting/deriveOperationalReviewRouting";
import {
  buildReviewWorkspace,
  reviewWorkspaceToOperatorReviewOpenRequest,
} from "../buildReviewWorkspace";

const createdBy = { userId: "landlord-user-1", role: "landlord" as const, email: "ops@example.test" };

function expectManualOnlyContinuity(payload: unknown) {
  expect(payload).toEqual(
    expect.objectContaining({
      manualOnly: true,
      autonomousActionsEnabled: false,
    })
  );
  expect(JSON.stringify(payload)).not.toContain("autoCreateWorkspace\":true");
  expect(JSON.stringify(payload)).not.toContain("autoAssign");
  expect(JSON.stringify(payload)).not.toContain("autoResolve");
  expect(JSON.stringify(payload)).not.toContain("financialMutationEnabled\":true");
  expect(JSON.stringify(payload)).not.toContain("institutionalSharingEnabled\":true");
  expect(JSON.stringify(payload)).not.toContain("tenantVisible");
}

describe("review workspace audit continuity", () => {
  it("preserves routing origin, scoped source linkage, evidence lineage, and manual-only handoff metadata", () => {
    const routing = deriveOperationalReviewRouting({
      itemId: "decision:review_missing_payment:lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      title: "Missing payment review",
      description: "Rent evidence needs manual review.",
      category: "payments",
      severity: "critical",
      status: "open",
      workflowQueue: "delinquency_review",
      workflowState: "new",
      reviewStatus: "critical",
      destination: "/leases/lease-1/ledger",
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
        {
          resourceType: "payment",
          resourceId: "payment-wrong-landlord",
          label: "Wrong landlord payment",
          landlordId: "landlord-2",
          tenantId: "tenant-1",
        },
      ],
    });

    expect(routing).toEqual(
      expect.objectContaining({
        reviewEligible: true,
        reviewReasonKey: "delinquency_review",
        reviewReasonLabel: "Delinquency review",
        sourceDestination: "/leases/lease-1/ledger",
        manualOnly: true,
        autoCreateWorkspace: false,
        autonomousActionsEnabled: false,
        permissionWideningRequired: false,
      })
    );
    expect(routing.relatedResourceRefs).toEqual([
      expect.objectContaining({
        resourceType: "lease",
        resourceId: "lease-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        propertyId: "property-1",
        unitId: "unit-104",
        leaseId: "lease-1",
      }),
    ]);

    const workspaceInput = buildReviewWorkspaceInputFromRouting({
      routing,
      createdBy,
      createdAt: "2026-05-20T12:00:00.000Z",
    });
    const workspace = buildReviewWorkspace({
      ...workspaceInput!,
      tenantId: "tenant-1",
      evidenceRefs: [
        {
          evidencePackId: "evidence-pack-1",
          evidenceItemId: "decision-1",
          evidenceType: "evidence_item",
          label: "Missing payment evidence",
          sourceCollection: "decisionItems",
          sourceId: "decision-1",
          scopeType: "decision",
          scopeId: "decision:review_missing_payment:lease-1",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          sensitivityClass: "restricted",
          projectionProfile: "landlord_evidence_review",
          projectionVersion: "evidence_projection_profile_v1",
          redactionSummary: "Restricted fields excluded.",
          lineageSummary: "Derived from decisionItems:decision-1.",
          rawPayload: { providerPayload: "raw provider dump" },
          rawCsv: "raw csv data",
          accountNumber: "123456789",
          routeSource: "debug route",
          stack: "private stack trace",
          token: "secret-token",
          messageBody: "private message body",
        },
      ],
      createdFromEvent: {
        eventId: "event-1",
        eventType: "decision.workflow.review_required",
        sourceSystem: "decision_workflow",
      },
      auditRefs: [
        {
          auditId: "audit-1",
          eventType: "operator_review_session_opened",
          sourceCollection: "canonicalEvents",
        },
      ],
    });

    expect(workspace).toEqual(
      expect.objectContaining({
        workspaceType: "delinquency_review",
        workspaceScopeId: "decision:review_missing_payment:lease-1",
        reviewSummary: "Delinquency review",
        reviewPriority: "critical",
        reviewStatus: "open",
        landlordId: "landlord-1",
        createdAt: "2026-05-20T12:00:00.000Z",
        updatedAt: "2026-05-20T12:00:00.000Z",
      })
    );
    expect(workspace.reviewTags).toEqual(["critical", "delinquency_review"]);
    expect(workspace.createdFromEvent).toEqual({
      eventId: "event-1",
      eventType: "decision.workflow.review_required",
      sourceSystem: "decision_workflow",
    });
    expect(workspace.auditRefs).toEqual([
      { auditId: "audit-1", eventType: "operator_review_session_opened", sourceCollection: "canonicalEvents" },
    ]);
    expect(workspace.evidenceRefs).toEqual([
      expect.objectContaining({
        evidenceRefId: "review_evidence_ref:evidence-pack-1:decision-1:decisionitems:decision-1",
        evidencePackId: "evidence-pack-1",
        evidenceItemId: "decision-1",
        evidenceType: "evidence_item",
        label: "Missing payment evidence",
        sourceCollection: "decisionItems",
        sourceId: "decision-1",
        sourceRef: { sourceCollection: "decisionItems", sourceId: "decision-1" },
        scopeType: "decision",
        scopeId: "decision:review_missing_payment:lease-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        sensitivityClass: "restricted",
        projectionProfile: "landlord_evidence_review",
        projectionVersion: "evidence_projection_profile_v1",
        redactionSummary: "Restricted fields excluded.",
        lineageSummary: "Derived from decisionItems:decision-1.",
      }),
    ]);
    expect(workspace.relatedResourceRefs).toEqual([
      expect.objectContaining({
        resourceType: "lease",
        resourceId: "lease-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
      }),
    ]);
    expectManualOnlyContinuity(workspace);
    expectNoRestrictedProjectionFields(workspace);
    expectPayloadDoesNotContainValues(workspace, [
      "payment-wrong-landlord",
      "landlord-2",
      "raw provider dump",
      "raw csv data",
      "123456789",
      "debug route",
      "private stack trace",
      "secret-token",
      "private message body",
    ]);

    const operatorReviewRequest = reviewWorkspaceToOperatorReviewOpenRequest(workspace);
    expect(operatorReviewRequest).toEqual({
      scope: "delinquency",
      scopeId: "decision:review_missing_payment:lease-1",
      linkedEvidence: [{ evidenceId: "evidence-pack-1", label: "Missing payment evidence", kind: "workflow", destination: null }],
      note: "Delinquency review",
    });
    expect(JSON.stringify(operatorReviewRequest)).not.toContain("raw provider dump");
    expect(JSON.stringify(operatorReviewRequest)).not.toContain("tenantVisible");
    expect(JSON.stringify(operatorReviewRequest)).not.toContain("financialMutation");
  });

  it("keeps assignment and status metadata deterministic without auto-transition flags", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "payment_ledger_review",
      workspaceScopeId: "payment-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      createdBy,
      createdAt: "2026-05-20T12:05:00.000Z",
      assignedReviewer: { userId: "finance-reviewer-1", role: "operator", email: "finance@example.test" },
      reviewStatus: "under_review",
      reviewPriority: "warning",
      reviewSummary: "Payment evidence review",
      relatedResourceRefs: [
        {
          resourceType: "payment",
          resourceId: "payment-1",
          label: "North Towers payment",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          leaseId: "lease-1",
        },
      ],
    });

    expect(workspace.assignedReviewer).toEqual({
      userId: "finance-reviewer-1",
      role: "operator",
      email: "finance@example.test",
    });
    expect(workspace.reviewStatus).toBe("under_review");
    expect(workspace.reviewPriority).toBe("warning");
    expect(workspace.updatedAt).toBe("2026-05-20T12:05:00.000Z");
    expect(workspace.relatedResourceRefs).toEqual([
      expect.objectContaining({
        resourceType: "payment",
        resourceId: "payment-1",
        tenantId: "tenant-1",
        landlordId: "landlord-1",
      }),
    ]);
    expectManualOnlyContinuity(workspace);
    expect(JSON.stringify(workspace)).not.toContain("autoTransition");
    expect(JSON.stringify(workspace)).not.toContain("autoResolved");
    expect(JSON.stringify(workspace)).not.toContain("sourceRecordMutation");
  });
});
