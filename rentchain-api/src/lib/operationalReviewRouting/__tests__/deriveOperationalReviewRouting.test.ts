import { describe, expect, it } from "vitest";

import { buildReviewWorkspace } from "../../reviewWorkspaces/buildReviewWorkspace";
import {
  buildReviewWorkspaceInputFromRouting,
  deriveOperationalReviewRouting,
  deriveOperationalReviewRoutingFromDecision,
} from "../deriveOperationalReviewRouting";
import type { DecisionInboxItem } from "../../decisions/decisionInboxTypes";

function decision(overrides: Partial<DecisionInboxItem> = {}): DecisionInboxItem {
  return {
    id: "decision:review_missing_payment:lease-1",
    title: "Missing payment review",
    description: "Expected rent payment requires manual review.",
    severity: "critical",
    status: "open",
    type: "billing",
    source: "lease_ledger",
    relatedEntity: { kind: "lease", id: "lease-1", label: "North Towers · Unit 104" },
    destination: "/leases/lease-1/ledger",
    automationEligible: false,
    workflow: {
      queue: "delinquency_review",
      workflowState: "escalated",
      ownershipType: "landlord",
      reviewPriority: "critical",
      escalationLevel: "critical",
      manualOnly: true,
    },
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveOperationalReviewRouting", () => {
  it("routes delinquency decisions to manual-only review workspace handoff metadata", () => {
    const routing = deriveOperationalReviewRoutingFromDecision(decision(), {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
    });

    expect(routing).toEqual(
      expect.objectContaining({
        routingVersion: "operational_review_routing_v1",
        itemId: "decision:review_missing_payment:lease-1",
        landlordId: "landlord-1",
        reviewEligible: true,
        reviewReasonKey: "delinquency_review",
        reviewReasonLabel: "Delinquency review",
        reviewPriority: "critical",
        priorityLabel: "Critical review",
        workspaceType: "delinquency_review",
        workspaceScopeId: "decision:review_missing_payment:lease-1",
        manualOnly: true,
        autoCreateWorkspace: false,
        autonomousActionsEnabled: false,
        permissionWideningRequired: false,
        sourceDestination: "/leases/lease-1/ledger",
      })
    );
    expect(routing.relatedResourceRefs).toEqual([
      expect.objectContaining({
        resourceType: "lease",
        resourceId: "lease-1",
        label: "North Towers · Unit 104",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
      }),
    ]);
  });

  it("keeps resolved or informational operational items out of review workspace eligibility", () => {
    const routing = deriveOperationalReviewRoutingFromDecision(
      decision({ status: "resolved", severity: "low", workflow: { ...decision().workflow, workflowState: "resolved" } }),
      { landlordId: "landlord-1" }
    );

    expect(routing.reviewEligible).toBe(false);
    expect(buildReviewWorkspaceInputFromRouting({ routing, createdBy: { userId: "user-1", role: "landlord" } })).toBeNull();
  });

  it("filters cross-landlord and unrelated tenant resource refs before handoff", () => {
    const routing = deriveOperationalReviewRouting({
      itemId: "payment-review-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      title: "Payment evidence review",
      category: "payments",
      severity: "medium",
      status: "open",
      relatedResourceRefs: [
        { resourceType: "payment", resourceId: "payment-1", label: "Scoped payment", landlordId: "landlord-1", tenantId: "tenant-1" },
        { resourceType: "payment", resourceId: "payment-2", label: "Wrong landlord", landlordId: "landlord-2", tenantId: "tenant-1" },
        { resourceType: "payment", resourceId: "payment-3", label: "Wrong tenant", landlordId: "landlord-1", tenantId: "tenant-2" },
      ],
    });

    expect(routing.relatedResourceRefs).toEqual([
      expect.objectContaining({ resourceId: "payment-1", label: "Scoped payment" }),
    ]);
    expect(JSON.stringify(routing)).not.toContain("payment-2");
    expect(JSON.stringify(routing)).not.toContain("payment-3");
  });

  it("builds compatible review workspace input without creating a workspace automatically", () => {
    const routing = deriveOperationalReviewRouting({
      itemId: "screening-review-1",
      landlordId: "landlord-1",
      title: "Screening workflow requires review",
      category: "screening",
      severity: "high",
      status: "open",
      destination: "/applications/app-1",
    });

    const workspaceInput = buildReviewWorkspaceInputFromRouting({
      routing,
      createdBy: { userId: "landlord-user-1", role: "landlord" },
      createdAt: "2026-05-20T12:00:00.000Z",
    });

    expect(workspaceInput).toEqual(
      expect.objectContaining({
        workspaceType: "screening_review",
        workspaceScopeId: "screening-review-1",
        landlordId: "landlord-1",
        reviewPriority: "critical",
        reviewStatus: "open",
        reviewSummary: "Screening review",
      })
    );
    const workspace = buildReviewWorkspace(workspaceInput!);
    expect(workspace).toEqual(
      expect.objectContaining({
        workspaceType: "screening_review",
        manualOnly: true,
        autonomousActionsEnabled: false,
        externalSharingEnabled: false,
        institutionalSharingEnabled: false,
        financialMutationEnabled: false,
      })
    );
  });

  it("maps operational categories into deterministic review reason taxonomy", () => {
    expect(deriveOperationalReviewRouting({ itemId: "doc-1", landlordId: "landlord-1", category: "documents", status: "open" })).toEqual(
      expect.objectContaining({ reviewReasonKey: "document_review", workspaceType: "document_review" })
    );
    expect(deriveOperationalReviewRouting({ itemId: "occ-1", landlordId: "landlord-1", category: "occupancy", status: "open" })).toEqual(
      expect.objectContaining({ reviewReasonKey: "occupancy_review", workspaceType: "operational_anomaly_review" })
    );
    expect(deriveOperationalReviewRouting({ itemId: "evidence-1", landlordId: "landlord-1", category: "evidence", status: "open" })).toEqual(
      expect.objectContaining({ reviewReasonKey: "evidence_review", workspaceType: "evidence_review" })
    );
  });

  it("normalizes maintenance decisions as operational work order review metadata", () => {
    const routing = deriveOperationalReviewRoutingFromDecision(
      decision({
        id: "decision:maintenance_review:maint-1",
        title: "Work order needs review",
        description: "Maintenance request requires operational follow-up.",
        type: "maintenance",
        relatedEntity: { kind: "maintenance_request", id: "maint-1", label: "" },
        workflow: {
          queue: "maintenance_review",
          workflowState: "open",
          ownershipType: "landlord",
          reviewPriority: "needs_review",
          escalationLevel: "attention",
          manualOnly: true,
        },
      }),
      { landlordId: "landlord-1", tenantId: "tenant-1" }
    );

    expect(routing).toEqual(
      expect.objectContaining({
        reviewReasonKey: "operational_work_order_review",
        reviewReasonLabel: "Operational work order review",
        workspaceType: "operational_anomaly_review",
        manualOnly: true,
        autoCreateWorkspace: false,
        autonomousActionsEnabled: false,
      })
    );
    expect(routing.relatedResourceRefs).toEqual([
      expect.objectContaining({
        resourceType: "work_order",
        resourceId: "maint-1",
        label: "Operational work order",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
      }),
    ]);
    expect(JSON.stringify(routing)).not.toContain("maintenance_request");
  });
});
