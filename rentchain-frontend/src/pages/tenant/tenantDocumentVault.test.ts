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

  it("collapses duplicate visible Lease attachments before metrics and sections are assembled", () => {
    const sourceItems = [
      {
        id: "lease-generated-draft",
        tenantId: "tenant-1",
        draftId: "draft-1",
        ledgerItemId: "leaseDraft:draft-1",
        label: "LEASE — Lease",
        title: "Lease document",
        category: "Lease",
        purpose: "LEASE",
        purposeLabel: "Lease",
        fileName: "schedule-a-v1.pdf",
        url: "https://example.com/lease-draft.pdf",
        status: "uploaded" as const,
        uploadedAt: 100,
      },
      {
        id: "lease-generated-old",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        draftId: "draft-1",
        ledgerItemId: "lease-1",
        label: "LEASE — Lease",
        title: "Lease document",
        category: "Lease",
        purpose: "LEASE",
        purposeLabel: "Lease",
        fileName: "schedule-a-v1.pdf",
        url: "https://example.com/lease-old.pdf",
        status: "uploaded" as const,
        uploadedAt: 200,
      },
      {
        id: "lease-generated-new",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        draftId: "draft-1",
        ledgerItemId: "lease-1",
        label: "LEASE — Lease",
        title: "Lease document",
        category: "Lease",
        purpose: "LEASE",
        purposeLabel: "Lease",
        fileName: "schedule-a-v1.pdf",
        url: "https://example.com/lease-new.pdf",
        status: "uploaded" as const,
        uploadedAt: 300,
      },
      {
        id: "lease-generated-url",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        label: "LEASE — Lease",
        title: "Lease document",
        category: "Lease",
        purpose: "LEASE",
        purposeLabel: "Lease",
        fileName: "schedule-a-v1.pdf",
        url: "https://example.com/lease-url.pdf",
        status: "uploaded" as const,
        uploadedAt: 400,
      },
      {
        id: "identity-doc",
        tenantId: "tenant-1",
        label: "Government ID",
        title: "Government ID",
        category: "Identity",
        purpose: "identity",
        purposeLabel: "Upload Id",
        fileName: "id-card.pdf",
        url: "https://example.com/id-card.pdf",
        status: "uploaded" as const,
        uploadedAt: 250,
      },
    ];

    const result = buildTenantDocumentVaultView({
      items: sourceItems,
      summary: {
        total: 5,
        missing: 0,
        uploaded: 5,
        pendingReview: 0,
        verified: 0,
        needsAttention: 0,
      },
    });

    expect(sourceItems).toHaveLength(5);
    expect(result.metrics.map((item) => item.value).slice(0, 3)).toEqual([2, 2, 0]);
    expect(result.readyItems.map((item) => item.id)).toEqual(["lease-generated-url", "identity-doc"]);
    expect(result.groupedItems.find((group) => group.category === "Lease")?.items).toHaveLength(1);
    expect(result.groupedItems.find((group) => group.category === "Identity")?.items).toHaveLength(1);
    expect(result.recentItems.map((item) => item.id)).toEqual(["lease-generated-url", "identity-doc"]);
  });

  it("collapses generated Lease rows that only differ by URL when lease metadata is absent", () => {
    const result = buildTenantDocumentVaultView({
      items: [
        {
          id: "lease-snapshot-1",
          label: "LEASE — Lease",
          title: "Lease document",
          category: "Lease",
          purpose: "LEASE",
          purposeLabel: "Lease",
          fileName: "schedule-a-v1.pdf",
          url: "https://example.com/snapshot-1.pdf",
          status: "uploaded",
          uploadedAt: 100,
        },
        {
          id: "lease-snapshot-2",
          label: "LEASE — Lease",
          title: "Lease document",
          category: "Lease",
          purpose: "LEASE",
          purposeLabel: "Lease",
          fileName: "schedule-a-v1.pdf",
          url: "https://example.com/snapshot-2.pdf",
          status: "uploaded",
          uploadedAt: 200,
        },
        {
          id: "lease-snapshot-3",
          label: "LEASE — Lease",
          title: "Lease document",
          category: "Lease",
          purpose: "LEASE",
          purposeLabel: "Lease",
          fileName: "schedule-a-v1.pdf",
          url: "https://example.com/snapshot-3.pdf",
          status: "uploaded",
          uploadedAt: 300,
        },
        {
          id: "lease-snapshot-4",
          label: "LEASE — Lease",
          title: "Lease document",
          category: "Lease",
          purpose: "LEASE",
          purposeLabel: "Lease",
          fileName: "schedule-a-v1.pdf",
          url: "https://example.com/snapshot-4.pdf",
          status: "uploaded",
          uploadedAt: 400,
        },
      ],
    });

    expect(result.metrics.map((item) => item.value).slice(0, 3)).toEqual([1, 1, 0]);
    expect(result.readyItems.map((item) => item.id)).toEqual(["lease-snapshot-4"]);
    expect(result.groupedItems).toHaveLength(1);
    expect(result.groupedItems[0].items.map((item) => item.id)).toEqual(["lease-snapshot-4"]);
    expect(result.recentItems.map((item) => item.id)).toEqual(["lease-snapshot-4"]);
  });
});
