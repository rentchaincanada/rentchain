import { describe, expect, it } from "vitest";
import { buildTenantDocumentVaultView } from "./tenantDocumentVault";

describe("buildTenantDocumentVaultView", () => {
  it("builds readiness and sharing metrics deterministically", () => {
    const result = buildTenantDocumentVaultView({
      items: [
        {
          id: "doc-1",
          label: "Government ID",
          category: "Identity",
          status: "uploaded",
          uploadedAt: 30,
        },
        {
          id: "doc-2",
          label: "Income documents",
          category: "Income",
          status: "missing",
          uploadedAt: 10,
        },
        {
          id: "doc-3",
          label: "Lease addendum",
          category: "Lease",
          status: "verified",
          uploadedAt: 20,
        },
      ],
      summary: {
        total: 3,
        missing: 1,
        uploaded: 1,
        pendingReview: 0,
        verified: 1,
        needsAttention: 0,
      },
      access: {
        summary: {
          activeGrants: 1,
          pendingRequests: 0,
          latestActivityAt: 50,
        },
        pendingRequests: [],
        activeAccess: [
          {
            id: "share-1",
            grantedToLabel: "Shared with your landlord",
            categories: ["Rental history"],
            status: "active",
            grantedAt: 40,
            expiresAt: 100,
            lastActivityAt: 50,
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

    expect(result.metrics.map((item) => item.value)).toEqual([3, 2, 1, 1]);
    expect(result.readyItems.map((item) => item.id)).toEqual(["doc-1", "doc-3"]);
    expect(result.missingItems.map((item) => item.id)).toEqual(["doc-2"]);
    expect(result.groupedItems.map((group) => group.category)).toEqual(["Identity", "Income", "Lease"]);
    expect(result.shareInsights[0]).toMatchObject({
      label: "Rental history",
      status: "shared",
    });
  });

  it("falls back to read-first sharing guidance when no access grants exist", () => {
    const result = buildTenantDocumentVaultView({
      items: [],
    });

    expect(result.shareInsights).toEqual([
      expect.objectContaining({
        label: "Documents in your vault",
        status: "unshared",
      }),
      expect.objectContaining({
        label: "Selective sharing",
        status: "limited",
      }),
    ]);
  });
});
