import { describe, expect, it } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import { deriveOperationalReviewRouting, buildReviewWorkspaceInputFromRouting } from "../../operationalReviewRouting/deriveOperationalReviewRouting";
import { buildReviewWorkspace, reviewWorkspaceToOperatorReviewOpenRequest } from "../buildReviewWorkspace";

const createdBy = { userId: "landlord-user-1", role: "landlord" as const, email: "ops@example.test" };

function expectManualOnlyReviewMetadata(payload: unknown) {
  expect(payload).toEqual(
    expect.objectContaining({
      manualOnly: true,
      autonomousActionsEnabled: false,
    })
  );
  expect(JSON.stringify(payload)).not.toContain("autoCreateWorkspace\":true");
  expect(JSON.stringify(payload)).not.toContain("financialMutationEnabled\":true");
  expect(JSON.stringify(payload)).not.toContain("institutionalSharingEnabled\":true");
}

describe("review workspace scope and permission regression", () => {
  it("keeps workspace related resources scoped to the requested landlord and tenant", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "payment_ledger_review",
      workspaceScopeId: "payment-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      createdBy,
      relatedResourceRefs: [
        {
          resourceType: "payment",
          resourceId: "payment-1",
          label: "North Towers payment evidence",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          propertyId: "property-1",
          unitId: "unit-101",
          leaseId: "lease-1",
        },
        {
          resourceType: "lease",
          resourceId: "lease-wrong-landlord",
          label: "Wrong landlord lease",
          landlordId: "landlord-2",
          tenantId: "tenant-1",
          propertyId: "property-2",
          unitId: "unit-201",
          leaseId: "lease-2",
        },
        {
          resourceType: "tenant",
          resourceId: "tenant-2",
          label: "Wrong tenant",
          landlordId: "landlord-1",
          tenantId: "tenant-2",
          propertyId: "property-1",
          unitId: "unit-102",
          leaseId: "lease-3",
        },
      ],
    });

    expect(workspace.landlordId).toBe("landlord-1");
    expect(workspace.relatedResourceRefs).toEqual([
      expect.objectContaining({
        resourceType: "payment",
        resourceId: "payment-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        propertyId: "property-1",
        unitId: "unit-101",
        leaseId: "lease-1",
      }),
    ]);
    expect(JSON.stringify(workspace)).not.toContain("landlord-2");
    expect(JSON.stringify(workspace)).not.toContain("tenant-2");
    expect(JSON.stringify(workspace)).not.toContain("lease-wrong-landlord");
    expectManualOnlyReviewMetadata(workspace);
  });

  it("keeps evidence linkage metadata-only and excludes restricted/raw payload fields", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "evidence_review",
      workspaceScopeId: "evidence-pack-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      createdBy,
      evidenceRefs: [
        {
          evidencePackId: "evidence-pack-1",
          evidenceItemId: "item-1",
          label: "Scoped evidence pack",
          sourceCollection: "ledgerEntries",
          sourceId: "ledger-entry-1",
          sensitivityClass: "restricted",
          rawPayload: { providerPayload: "raw provider dump" },
          rawCsv: "raw csv data",
          accountNumber: "123456789",
          routeSource: "debug route",
          stack: "stack trace",
          token: "secret-token",
          messageBody: "private message body",
        },
      ],
      relatedResourceRefs: [
        {
          resourceType: "evidence_pack",
          resourceId: "evidence-pack-1",
          label: "Evidence pack",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
        },
      ],
    });

    expect(workspace.evidenceRefs).toEqual([
      expect.objectContaining({
        evidenceRefId: "review_evidence_ref:evidence-pack-1:item-1:ledgerentries:ledger-entry-1",
        evidencePackId: "evidence-pack-1",
        evidenceItemId: "item-1",
        evidenceType: "evidence_pack",
        label: "Scoped evidence pack",
        sourceCollection: "ledgerEntries",
        sourceId: "ledger-entry-1",
        sourceRef: { sourceCollection: "ledgerEntries", sourceId: "ledger-entry-1" },
        sensitivityClass: "restricted",
      }),
    ]);
    expectNoRestrictedProjectionFields(workspace);
    expectPayloadDoesNotContainValues(workspace, [
      "raw provider dump",
      "raw csv data",
      "123456789",
      "debug route",
      "stack trace",
      "secret-token",
      "private message body",
    ]);
    expectManualOnlyReviewMetadata(workspace);
  });

  it("normalizes deterministic evidence-link governance metadata and excludes unrelated evidence refs", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "evidence_review",
      workspaceScopeId: "evidence-pack-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      createdBy,
      evidenceRefs: [
        {
          evidencePackId: "evidence-pack-1",
          evidenceItemId: "decision-1",
          evidenceType: "evidence_item",
          label: "Missing payment review evidence",
          sourceCollection: "decisionItems",
          sourceId: "decision-1",
          scopeType: "decision",
          scopeId: "decision-1",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          sensitivityClass: "restricted",
          projectionProfile: "landlord_evidence_review",
          projectionVersion: "evidence_projection_profile_v1",
          redactionSummary: "Restricted fields excluded; redaction categories retained.",
          lineageSummary: "Derived from decisionItems:decision-1.",
        },
        {
          evidencePackId: "evidence-pack-2",
          evidenceItemId: "decision-2",
          evidenceType: "evidence_item",
          label: "Wrong landlord evidence",
          sourceCollection: "decisionItems",
          sourceId: "decision-2",
          scopeType: "decision",
          scopeId: "decision-2",
          landlordId: "landlord-2",
          tenantId: "tenant-1",
          sensitivityClass: "restricted",
        },
        {
          evidencePackId: "evidence-pack-3",
          evidenceItemId: "decision-3",
          evidenceType: "evidence_item",
          label: "Wrong tenant evidence",
          sourceCollection: "decisionItems",
          sourceId: "decision-3",
          scopeType: "decision",
          scopeId: "decision-3",
          landlordId: "landlord-1",
          tenantId: "tenant-3",
          sensitivityClass: "restricted",
        },
      ],
    });

    expect(workspace.evidenceRefs).toEqual([
      {
        evidenceRefId: "review_evidence_ref:evidence-pack-1:decision-1:decisionitems:decision-1",
        evidencePackId: "evidence-pack-1",
        evidenceItemId: "decision-1",
        evidenceType: "evidence_item",
        label: "Missing payment review evidence",
        sourceCollection: "decisionItems",
        sourceId: "decision-1",
        sourceRef: { sourceCollection: "decisionItems", sourceId: "decision-1" },
        scopeType: "decision",
        scopeId: "decision-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        sensitivityClass: "restricted",
        projectionProfile: "landlord_evidence_review",
        projectionVersion: "evidence_projection_profile_v1",
        redactionSummary: "Restricted fields excluded; redaction categories retained.",
        lineageSummary: "Derived from decisionItems:decision-1.",
      },
    ]);
    expect(JSON.stringify(workspace)).not.toContain("evidence-pack-2");
    expect(JSON.stringify(workspace)).not.toContain("evidence-pack-3");
    expect(JSON.stringify(workspace)).not.toContain("landlord-2");
    expect(JSON.stringify(workspace)).not.toContain("tenant-3");
  });

  it("keeps operational routing handoff manual-only and filters unrelated resources before workspace input", () => {
    const routing = deriveOperationalReviewRouting({
      itemId: "decision:review_missing_payment:lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      title: "Missing payment review",
      category: "payments",
      severity: "critical",
      status: "open",
      destination: "/leases/lease-1/ledger",
      relatedResourceRefs: [
        { resourceType: "lease", resourceId: "lease-1", label: "North Towers lease", landlordId: "landlord-1", tenantId: "tenant-1" },
        { resourceType: "payment", resourceId: "payment-2", label: "Wrong landlord payment", landlordId: "landlord-2", tenantId: "tenant-1" },
        { resourceType: "payment", resourceId: "payment-3", label: "Wrong tenant payment", landlordId: "landlord-1", tenantId: "tenant-3" },
      ],
    });

    expect(routing).toEqual(
      expect.objectContaining({
        reviewEligible: true,
        manualOnly: true,
        autoCreateWorkspace: false,
        autonomousActionsEnabled: false,
        permissionWideningRequired: false,
      })
    );
    expect(routing.relatedResourceRefs).toEqual([
      expect.objectContaining({ resourceType: "lease", resourceId: "lease-1", landlordId: "landlord-1", tenantId: "tenant-1" }),
    ]);

    const workspaceInput = buildReviewWorkspaceInputFromRouting({ routing, createdBy });
    const workspace = buildReviewWorkspace(workspaceInput!);

    expect(workspace.relatedResourceRefs).toEqual([
      expect.objectContaining({ resourceType: "lease", resourceId: "lease-1", landlordId: "landlord-1", tenantId: "tenant-1" }),
    ]);
    expect(JSON.stringify(workspace)).not.toContain("payment-2");
    expect(JSON.stringify(workspace)).not.toContain("payment-3");
    expectManualOnlyReviewMetadata(workspace);
  });

  it("bridges to existing operator review sessions without exposing financial mutation or sharing controls", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "delinquency_review",
      workspaceScopeId: "lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      createdBy,
      evidenceRefs: [{ evidencePackId: "evidence-1", label: "Lease ledger evidence", sensitivityClass: "sensitive" }],
      reviewSummary: "Review lease ledger evidence",
    });
    const request = reviewWorkspaceToOperatorReviewOpenRequest(workspace);

    expect(request).toEqual({
      scope: "delinquency",
      scopeId: "lease-1",
      linkedEvidence: [{ evidenceId: "evidence-1", label: "Lease ledger evidence", kind: "workflow", destination: null }],
      note: "Review lease ledger evidence",
    });
    expect(JSON.stringify(request)).not.toContain("financialMutation");
    expect(JSON.stringify(request)).not.toContain("institutionalSharing");
    expect(JSON.stringify(request)).not.toContain("tenantVisible");
    expectManualOnlyReviewMetadata(workspace);
  });
});
