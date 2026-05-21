import { describe, expect, it } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import { deriveOperationalReviewRouting } from "../../operationalReviewRouting/deriveOperationalReviewRouting";
import { buildReviewWorkspace } from "../../reviewWorkspaces/buildReviewWorkspace";
import {
  buildOperationalCounts,
  buildOperationalReadModel,
  buildOperationalReadModelSummary,
  buildReviewQueueSummary,
  buildReviewWorkspaceSummary,
  normalizeOperationalReadModelResourceRefs,
  normalizeOperationalReadModelSourceRefs,
} from "../buildOperationalReadModel";

const generatedAt = "2026-05-21T10:00:00.000Z";

describe("operational read model foundations", () => {
  it("builds deterministic projection-only summaries without becoming workflow truth", () => {
    const summary = buildOperationalReadModelSummary({
      summaryType: "work_order",
      itemId: "work-order-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      generatedAt,
      title: "Kitchen sink repair",
      operationalSummary: "Work order is waiting on vendor scheduling.",
      status: "waiting_on_vendor",
      priority: "warning",
      sourceRefs: [
        { sourceCollection: "workOrders", sourceId: "work-order-1", resourceType: "work_order", landlordId: "landlord-1", tenantId: "tenant-1" },
      ],
      relatedResourceRefs: [
        {
          resourceType: "unit",
          resourceId: "unit-103",
          label: "North Towers · Unit 103",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          propertyId: "property-1",
          unitId: "unit-103",
        },
      ],
    });
    const duplicate = buildOperationalReadModelSummary({
      summaryType: "work_order",
      itemId: "work-order-1",
      landlordId: "landlord-1",
      generatedAt,
    });

    expect(summary.summaryId).toBe(duplicate.summaryId);
    expect(summary).toEqual(
      expect.objectContaining({
        summaryId: "operational_read_model:landlord-1:work_order:work-order-1",
        summaryType: "work_order",
        status: "open",
        priority: "warning",
        canonicalSourceOfTruth: false,
        projectionOnly: true,
        autonomousActionsEnabled: false,
      })
    );
    expect(summary.sourceRefs).toEqual([
      expect.objectContaining({
        sourceCollection: "workOrders",
        sourceId: "work-order-1",
        internalReference: true,
      }),
    ]);
    expect(summary.relatedResourceRefs).toEqual([
      expect.objectContaining({
        resourceType: "unit",
        resourceId: "unit-103",
        internalReference: true,
      }),
    ]);
  });

  it("derives review queue summaries from routing metadata without auto-actions", () => {
    const routing = deriveOperationalReviewRouting({
      itemId: "decision-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      title: "Operational work order blocked",
      category: "operations",
      severity: "high",
      status: "open",
      relatedResourceRefs: [
        {
          resourceType: "work_order",
          resourceId: "work-order-1",
          label: "Operational work order",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
        },
      ],
    });
    const summary = buildReviewQueueSummary({
      routing,
      title: "Operational work order blocked",
      generatedAt,
      tenantId: "tenant-1",
    });

    expect(summary).toEqual(
      expect.objectContaining({
        summaryType: "review_queue",
        status: "needs_review",
        priority: "critical",
        canonicalSourceOfTruth: false,
        projectionOnly: true,
        autonomousActionsEnabled: false,
      })
    );
    expect(summary.routingSummary).toEqual(
      expect.objectContaining({
        reviewEligible: true,
        reviewReasonLabel: "Operational work order review",
        manualOnly: true,
        autoCreateWorkspace: false,
        autonomousActionsEnabled: false,
      })
    );
    expect(summary.relatedResourceRefs).toEqual([
      expect.objectContaining({ resourceType: "work_order", resourceId: "work-order-1", internalReference: true }),
    ]);
  });

  it("derives review workspace summaries with reference-only evidence linkage", () => {
    const workspace = buildReviewWorkspace({
      workspaceType: "evidence_review",
      workspaceScopeId: "evidence-pack-1",
      landlordId: "landlord-1",
      createdAt: generatedAt,
      createdBy: { userId: "landlord-user-1", role: "landlord" },
      reviewPriority: "needs_review",
      reviewSummary: "Review evidence package lineage",
      evidenceRefs: [
        {
          evidencePackId: "evidence-pack-1",
          label: "Evidence pack",
          sourceCollection: "canonicalEvents",
          sourceId: "event-1",
          sensitivityClass: "restricted",
          projectionProfile: "landlord_evidence_review",
        },
      ],
    });
    const summary = buildReviewWorkspaceSummary({ workspace, generatedAt });

    expect(summary.evidenceLinkageSummary).toEqual({
      evidenceRefCount: 1,
      sourceRefCount: 1,
      sensitivityClasses: ["restricted"],
      projectionProfiles: ["landlord_evidence_review"],
      referenceOnly: true,
    });
    expect(summary.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceCollection: "operatorReviewSessions", sourceId: workspace.workspaceId }),
        expect.objectContaining({ sourceCollection: "canonicalEvents", sourceId: "event-1" }),
      ])
    );
    expect(JSON.stringify(summary)).not.toContain("raw provider payload");
  });

  it("filters unrelated landlord and tenant refs from read-model projections", () => {
    const sourceRefs = normalizeOperationalReadModelSourceRefs(
      [
        { sourceCollection: "leases", sourceId: "lease-1", landlordId: "landlord-1", tenantId: "tenant-1" },
        { sourceCollection: "leases", sourceId: "lease-2", landlordId: "landlord-2", tenantId: "tenant-1" },
        { sourceCollection: "leases", sourceId: "lease-3", landlordId: "landlord-1", tenantId: "tenant-2" },
      ],
      { landlordId: "landlord-1", tenantId: "tenant-1" }
    );
    const resourceRefs = normalizeOperationalReadModelResourceRefs(
      [
        { resourceType: "lease", resourceId: "lease-1", landlordId: "landlord-1", tenantId: "tenant-1" },
        { resourceType: "lease", resourceId: "lease-2", landlordId: "landlord-2", tenantId: "tenant-1" },
        { resourceType: "lease", resourceId: "lease-3", landlordId: "landlord-1", tenantId: "tenant-2" },
      ],
      { landlordId: "landlord-1", tenantId: "tenant-1" }
    );

    expect(sourceRefs.map((ref) => ref.sourceId)).toEqual(["lease-1"]);
    expect(resourceRefs.map((ref) => ref.resourceId)).toEqual(["lease-1"]);
  });

  it("builds aggregate operational read models from scoped summaries", () => {
    const summaries = [
      buildOperationalReadModelSummary({
        summaryType: "work_order",
        itemId: "work-order-1",
        landlordId: "landlord-1",
        generatedAt,
        priority: "warning",
        sourceRefs: [{ sourceCollection: "workOrders", sourceId: "work-order-1", landlordId: "landlord-1" }],
      }),
      buildOperationalReadModelSummary({
        summaryType: "review_workspace",
        itemId: "workspace-1",
        landlordId: "landlord-1",
        generatedAt,
        priority: "critical",
        evidenceLinkageSummary: { evidenceRefCount: 1, sourceRefCount: 1, sensitivityClasses: ["sensitive"], projectionProfiles: [] },
        sourceRefs: [{ sourceCollection: "operatorReviewSessions", sourceId: "workspace-1", landlordId: "landlord-1" }],
      }),
      buildOperationalReadModelSummary({
        summaryType: "operational_signal",
        itemId: "wrong-landlord",
        landlordId: "landlord-2",
        generatedAt,
        priority: "critical",
      }),
    ];

    const model = buildOperationalReadModel({
      landlordId: "landlord-1",
      generatedAt,
      staleAt: "2026-05-21T10:05:00.000Z",
      summaries,
    });

    expect(model).toEqual(
      expect.objectContaining({
        readModelVersion: "operational_read_model_foundation_v1",
        readModelType: "operational_coordination",
        landlordId: "landlord-1",
        generatedAt,
        staleAt: "2026-05-21T10:05:00.000Z",
        consistencyExpectation: "projection_rebuildable_from_source",
        canonicalSourceOfTruth: false,
        projectionOnly: true,
        autonomousActionsEnabled: false,
        permissionWideningRequired: false,
      })
    );
    expect(model.summaries.map((item) => item.landlordId)).toEqual(["landlord-1", "landlord-1"]);
    expect(model.sourceCollections).toEqual(["operatorReviewSessions", "workOrders"]);
    expect(model.operationalCounts).toEqual({
      total: 2,
      critical: 1,
      warnings: 1,
      needsReview: 0,
      upcoming: 0,
      informational: 0,
      reviewEligible: 0,
      workOrders: 1,
      reviewWorkspaces: 1,
      evidenceLinked: 1,
    });
  });

  it("excludes restricted/raw/provider fields and values from summaries", () => {
    const summary = buildOperationalReadModelSummary({
      summaryType: "evidence_linkage",
      itemId: "evidence-1",
      landlordId: "landlord-1",
      title: "<Evidence lineage>",
      rawPayload: "ignored",
      sourceRefs: [
        {
          sourceCollection: "evidencePacks",
          sourceId: "evidence-1",
          landlordId: "landlord-1",
          rawPayload: "raw provider payload",
          token: "secret-token",
          routeSource: "debug-source",
        },
      ],
      relatedResourceRefs: [
        {
          resourceType: "evidence_pack",
          resourceId: "evidence-1",
          label: "Evidence pack",
          landlordId: "landlord-1",
          providerPayload: "raw provider payload",
          rawCsv: "raw csv values",
          bankAccountNumber: "111122223333",
          stack: "private stack trace",
        },
      ],
    } as any);

    expect(summary.title).toBe("Evidence lineage");
    expectNoRestrictedProjectionFields(summary);
    expectPayloadDoesNotContainValues(summary, [
      "raw provider payload",
      "secret-token",
      "debug-source",
      "raw csv values",
      "111122223333",
      "private stack trace",
    ]);
  });

  it("counts read-model summaries deterministically", () => {
    const counts = buildOperationalCounts([
      buildOperationalReadModelSummary({ summaryType: "operational_signal", itemId: "a", landlordId: "landlord-1", priority: "critical" }),
      buildOperationalReadModelSummary({ summaryType: "operational_signal", itemId: "b", landlordId: "landlord-1", priority: "upcoming" }),
      buildOperationalReadModelSummary({ summaryType: "operational_signal", itemId: "c", landlordId: "landlord-1", priority: "info" }),
    ]);

    expect(counts).toEqual(
      expect.objectContaining({
        total: 3,
        critical: 1,
        upcoming: 1,
        informational: 1,
      })
    );
  });
});
