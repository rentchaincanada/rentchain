import { describe, expect, it } from "vitest";
import { buildTenantProfileCompletion } from "./tenantProfileCompletion";

describe("buildTenantProfileCompletion", () => {
  it("computes progress and missing details from tenant-safe profile data", () => {
    const summary = buildTenantProfileCompletion({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: null,
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      profile: {
        displayName: "",
        email: "tenant@example.com",
        phone: null,
        authorityLabel: "Active tenant",
        property: null,
        application: {
          applicationId: "app-1",
          status: "submitted",
          missingSteps: [],
          nextActions: [],
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
          { code: "upload_id", label: "Upload Id", status: "missing", nextStep: "Upload government id" },
        ],
        nextSteps: ["Upload government id"],
      },
      actions: {
        editableFields: ["displayName", "phone"],
        documentEntry: {
          available: true,
          path: "/tenant/attachments",
          label: "Review documents",
          note: "1 document-related step still needs attention.",
        },
      },
    });

    expect(summary.totalCount).toBe(7);
    expect(summary.progressPercent).toBeGreaterThan(0);
    expect(summary.overallStatus).toBe("missing");
    expect(summary.missingItems.some((item) => /name/i.test(item))).toBe(true);
    expect(summary.missingItems.some((item) => /phone/i.test(item))).toBe(true);
  });

  it("marks a complete tenant-safe profile as fully organized", () => {
    const summary = buildTenantProfileCompletion({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "902-555-0100",
        authorityLabel: "Active tenant",
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
          missingSteps: [],
          nextActions: [],
          createdAt: null,
          updatedAt: null,
        },
        lease: {
          leaseId: "lease-1",
          startDate: "2026-02-01",
          endDate: "2027-01-31",
          monthlyRent: 1800,
          status: "active",
          documentUrl: "https://example.com/lease.pdf",
        },
      },
      identity: {
        overallStatus: "verified",
        identityVerification: {
          status: "verified",
          label: "Verified",
          note: "All set.",
          updatedAt: null,
        },
        documentChecklist: [],
        nextSteps: [],
      },
      actions: {
        editableFields: ["displayName", "phone"],
        documentEntry: {
          available: true,
          path: "/tenant/attachments",
          label: "Review documents",
          note: null,
        },
      },
    });

    expect(summary.progressPercent).toBe(100);
    expect(summary.completedCount).toBe(summary.totalCount);
    expect(summary.overallStatus).toBe("complete");
    expect(summary.missingItems).toEqual([]);
  });
});
