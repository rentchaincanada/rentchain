import { describe, expect, it } from "vitest";
import { deriveNetworkReuseSummary } from "../deriveNetworkReuseSummary";

describe("deriveNetworkReuseSummary", () => {
  it("derives available reuse for apply-with-rentchain metadata with sufficient scopes", () => {
    expect(
      deriveNetworkReuseSummary({
        applicationSource: "apply_with_rentchain",
        identityReference: {
          source: "rentchain",
          referenceType: "tenant_identity_reference",
          referenceStatus: "available",
        },
        approvedScopeKeys: ["identity_summary", "credibility_summary"],
      })
    ).toEqual({
      reusable: true,
      source: "apply_with_rentchain",
      reuseStatus: "available",
      consentRequired: true,
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
    });
  });

  it("returns null when no reuse metadata exists", () => {
    expect(deriveNetworkReuseSummary({})).toBeNull();
  });
});
