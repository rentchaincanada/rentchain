import { describe, expect, it } from "vitest";
import { buildTenantApplicationReuseView } from "./tenantApplicationReuse";

describe("buildTenantApplicationReuseView", () => {
  it("builds reuse metrics and remediation links from supported tenant-safe data", () => {
    const result = buildTenantApplicationReuseView({
      completion: {
        status: "in_progress",
        progressPercent: 62,
        sections: [
          {
            key: "documents",
            label: "Documents",
            status: "missing",
            items: [
              {
                key: "income_documents",
                label: "Income documents",
                status: "missing",
                nextAction: "Upload income documents",
                actionPath: "/tenant/attachments",
                actionLabel: "Open documents",
              },
            ],
          },
        ],
        nextSteps: ["Upload income documents"],
        updatedAt: "2026-01-02T00:00:00.000Z",
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
          phone: null,
          authorityLabel: "Applicant",
          property: {
            propertyId: "prop-1",
            rc_prop_id: "rc-prop-1",
            street1: "123 Main St",
            street2: "Unit 4",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H1A1",
            features: [],
          },
          application: {
            applicationId: "app-1",
            status: "submitted",
            missingSteps: ["income_documents"],
            nextActions: ["Upload income documents"],
            createdAt: null,
            updatedAt: null,
          },
          lease: null,
        },
        identity: {
          overallStatus: "pending",
          identityVerification: {
            status: "pending",
            label: "Pending",
            note: "Verification is still in progress.",
            updatedAt: null,
          },
          documentChecklist: [
            {
              code: "income_documents",
              label: "Income documents",
              status: "missing",
              nextStep: "Upload income documents",
            },
          ],
          nextSteps: ["Upload income documents"],
        },
        actions: {
          editableFields: ["displayName", "phone"],
          documentEntry: {
            available: true,
            path: "/tenant/attachments",
            label: "Open documents",
            note: "1 document-related step still needs attention.",
          },
        },
      },
      attachments: {
        ok: true,
        data: [
          {
            id: "doc-1",
            label: "Government ID",
            category: "Identity",
            status: "uploaded",
          },
        ],
        summary: {
          total: 1,
          missing: 0,
          uploaded: 1,
          pendingReview: 0,
          verified: 0,
          needsAttention: 0,
        },
        guidance: undefined,
        updatedAt: null,
      },
      access: {
        summary: {
          activeGrants: 1,
          pendingRequests: 0,
          latestActivityAt: 1,
        },
        pendingRequests: [],
        activeAccess: [
          {
            id: "share-1",
            grantedToLabel: "Shared with your landlord",
            categories: ["Rental history"],
            status: "active",
            grantedAt: 1,
            expiresAt: 2,
            lastActivityAt: 3,
            canRevoke: true,
            accessLabel: "View-only access",
          },
        ],
        recentActivity: [],
        guidance: {
          headline: "Shared",
          body: "Visible",
        },
      },
    });

    expect(result.metrics.map((item) => item.value)).toEqual(["62%", "1/3", "1", expect.any(String)]);
    expect(result.packageCategories.map((item) => item.label)).toEqual([
      "Profile details",
      "Rental history",
      "Documents & records",
      "Consent / identity status",
      "Application readiness",
    ]);
    expect(result.packageCategories[2]).toMatchObject({
      label: "Documents & records",
      status: "ready",
    });
    expect(result.reusableProfileItems[0]).toMatchObject({
      label: "Profile basics",
      status: "needs_attention",
    });
    expect(result.documentItems[0]).toMatchObject({
      label: "Ready to share",
      status: "ready",
    });
    expect(result.shareInsights.some((item) => item.detail.includes("1 supported share record"))).toBe(true);
    expect(result.missingItems.some((item) => item.actionPath === "/tenant/attachments")).toBe(true);
  });
});
