import { describe, expect, it } from "vitest";
import { deriveNetworkReuseSummary } from "../deriveNetworkReuseSummary";

describe("deriveNetworkReuseSummary", () => {
  it("derives available reuse for apply-with-rentchain metadata with identity and application scopes", () => {
    expect(
      deriveNetworkReuseSummary({
        applicationSource: "apply_with_rentchain",
        identityReference: {
          source: "rentchain",
          referenceType: "tenant_identity_reference",
          referenceStatus: "available",
        },
        approvedScopeKeys: ["identity_summary", "application_summary"],
      })
    ).toEqual({
      reusable: true,
      source: "apply_with_rentchain",
      reuseStatus: "available",
      consentRequired: true,
      reusePath: "apply_prefill_ready",
      reusePathLabel: "Apply prefill ready",
      reusePathDescription:
        "Tenant-approved identity and reusable application details are already in scope for the RentChain apply path.",
      identitySummaryApproved: true,
      applicationSummaryApproved: true,
      additionalConsentMayUnlock: false,
    });
  });

  it("derives limited reuse for narrow or limited metadata", () => {
    expect(
      deriveNetworkReuseSummary({
        identityReference: {
          source: "rentchain",
          referenceType: "tenant_identity_reference",
          referenceStatus: "limited",
        },
        approvedScopeKeys: ["documents_summary"],
      })
    ).toEqual({
      reusable: true,
      source: "share_package",
      reuseStatus: "limited",
      consentRequired: true,
      reusePath: "share_summary_ready",
      reusePathLabel: "Summary reuse ready",
      reusePathDescription:
        "Tenant-approved RentChain reuse metadata is available for summary-only follow-through without expanding landlord access.",
      identitySummaryApproved: false,
      applicationSummaryApproved: false,
      additionalConsentMayUnlock: true,
    });
  });

  it("derives a more-available path when identity is approved but application reuse still needs approval", () => {
    expect(
      deriveNetworkReuseSummary({
        identityReference: {
          source: "rentchain",
          referenceType: "tenant_identity_reference",
          referenceStatus: "available",
        },
        approvedScopeKeys: ["identity_summary"],
      })
    ).toEqual({
      reusable: true,
      source: "share_package",
      reuseStatus: "available",
      consentRequired: true,
      reusePath: "share_summary_with_more_available",
      reusePathLabel: "More reusable detail available with approval",
      reusePathDescription:
        "Some tenant-approved reuse metadata is already available, and broader reusable application detail may still require additional tenant approval.",
      identitySummaryApproved: true,
      applicationSummaryApproved: false,
      additionalConsentMayUnlock: true,
    });
  });

  it("derives not-ready when reuse metadata exists but no reusable path is available", () => {
    expect(
      deriveNetworkReuseSummary({
        identityReference: {
          source: "rentchain",
          referenceType: "tenant_identity_reference",
          referenceStatus: "not_ready",
        },
        approvedScopeKeys: [],
        portableIdentitySummary: {
          portabilityStatus: "not_ready",
          reusableAcrossApplications: false,
        },
      })
    ).toEqual({
      reusable: false,
      source: "share_package",
      reuseStatus: "not_available",
      consentRequired: true,
      reusePath: "not_ready",
      reusePathLabel: "No reusable path ready",
      reusePathDescription:
        "A tenant-approved RentChain reuse path is not currently ready for broader follow-through.",
      identitySummaryApproved: false,
      applicationSummaryApproved: false,
      additionalConsentMayUnlock: false,
    });
  });

  it("returns null when no reuse metadata exists", () => {
    expect(deriveNetworkReuseSummary({})).toBeNull();
  });
});
