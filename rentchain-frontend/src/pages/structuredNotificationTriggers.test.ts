import { describe, expect, it } from "vitest";
import { buildLandlordStructuredNotificationTriggers, buildTenantStructuredNotificationTriggers } from "./structuredNotificationTriggers";
import type { SharePackageCategoryView } from "./sharePackageAlignment";

function categories(
  statuses: Array<SharePackageCategoryView["status"]>
): SharePackageCategoryView[] {
  return [
    {
      key: "profile_details",
      label: "Profile details",
      status: statuses[0],
      detail: "Profile details are available.",
    },
    {
      key: "rental_history",
      label: "Rental history",
      status: statuses[1],
      detail: "Rental history is available.",
    },
    {
      key: "documents_records",
      label: "Documents & records",
      status: statuses[2],
      detail: "Documents are available.",
    },
    {
      key: "consent_identity_status",
      label: "Consent / identity status",
      status: statuses[3],
      detail: "Consent is available.",
    },
    {
      key: "application_readiness",
      label: "Application readiness",
      status: statuses[4],
      detail: "Readiness is available.",
    },
  ];
}

describe("structuredNotificationTriggers", () => {
  it("builds tenant notifications with action-required items first", () => {
    const result = buildTenantStructuredNotificationTriggers({
      packageCategories: categories(["missing", "ready", "ready", "partial", "partial"]),
      completion: {
        status: "in_progress",
        progressPercent: 62,
        sections: [],
        nextSteps: [],
        updatedAt: "2026-04-05T00:00:00.000Z",
      },
      profile: {
        context: {
          authority: "applicant",
          propertyId: "prop-1",
          rc_prop_id: "rc-prop-1",
          applicationId: "app-1",
          leaseId: null,
          tenantId: "tenant-1",
          unitId: "unit-1",
          invitedEmail: "tenant@example.com",
        },
        profile: {
          displayName: "Taylor Tenant",
          email: "tenant@example.com",
          phone: "902-555-0100",
          authorityLabel: "Applicant",
          property: null,
          application: {
            applicationId: "app-1",
            status: "submitted",
            missingSteps: [],
            nextActions: [],
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-05T00:00:00.000Z",
          },
          lease: null,
        },
        identity: {
          overallStatus: "pending",
          identityVerification: {
            status: "pending",
            label: "Pending",
            note: "Still in progress.",
            updatedAt: "2026-04-04T00:00:00.000Z",
          },
          documentChecklist: [],
          nextSteps: [],
        },
        actions: {
          editableFields: [],
          documentEntry: {
            available: true,
            path: "/tenant/attachments",
            label: "Open documents",
            note: null,
          },
        },
      },
      attachments: {
        data: [{ id: "doc-1", status: "uploaded" }],
        updatedAt: 1712361600000,
      } as any,
      access: {
        summary: {
          activeGrants: 1,
          pendingRequests: 0,
          latestActivityAt: 1712275200000,
        },
        pendingRequests: [],
        activeAccess: [],
        recentActivity: [],
        guidance: {
          headline: "Shared",
          body: "Visible",
        },
      },
    });

    expect(result[0]).toMatchObject({
      type: "follow_up_requested",
      actionRequired: true,
      targetLink: "/tenant/profile",
    });
    expect(result.some((item) => item.type === "documents_updated")).toBe(true);
    expect(result.some((item) => item.type === "access_changed")).toBe(true);
  });

  it("builds landlord notifications for follow-up and rereview state", () => {
    const result = buildLandlordStructuredNotificationTriggers(
      {
        applicationId: "app-1",
        generatedAt: "2026-04-06T00:00:00.000Z",
        applicant: {} as any,
        employment: {} as any,
        reference: {} as any,
        compliance: {} as any,
        screening: { status: "complete", provider: "transunion", referenceId: "TU-1" },
        derived: { incomeToRentRatio: null, completeness: { score: 0.9, label: "High" }, flags: [] },
        insights: [],
        decisionSummary: {
          applicationId: "app-1",
          riskSnapshot: {
            version: "risk-v1",
            status: "completed",
            score: 72,
            grade: "B",
            confidence: 0.84,
            factors: [],
            flags: [],
            recommendations: [],
            updatedAt: "2026-04-07T00:00:00.000Z",
          },
        },
        risk: null,
      } as any,
      categories(["ready", "partial", "ready", "partial", "ready"])
    );

    expect(result[0]).toMatchObject({
      type: "ready_for_rereview",
      title: "Application ready for re-review",
      actionRequired: false,
    });
    expect(result.some((item) => item.type === "follow_up_addressed")).toBe(true);
  });
});
