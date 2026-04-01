import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAdminPropertiesMock: vi.fn(),
  listAdminTenantsMock: vi.fn(),
  listAdminLeasesMock: vi.fn(),
  loadAdminIntegrityMock: vi.fn(),
}));

vi.mock("../admin/adminPropertyView", () => ({
  listAdminProperties: mocks.listAdminPropertiesMock,
}));

vi.mock("../admin/adminTenantView", () => ({
  listAdminTenants: mocks.listAdminTenantsMock,
}));

vi.mock("../admin/adminLeaseView", () => ({
  listAdminLeases: mocks.listAdminLeasesMock,
}));

vi.mock("../admin/adminIntegrityView", () => ({
  loadAdminIntegrity: mocks.loadAdminIntegrityMock,
}));

describe("adminCsvExport", () => {
  beforeEach(() => {
    mocks.listAdminPropertiesMock.mockReset();
    mocks.listAdminTenantsMock.mockReset();
    mocks.listAdminLeasesMock.mockReset();
    mocks.loadAdminIntegrityMock.mockReset();
  });

  it("builds properties CSV with safe fields and export row cap query behavior", async () => {
    mocks.listAdminPropertiesMock.mockResolvedValue({
      items: [
        {
          id: "prop-1",
          name: 'Main "House"',
          address1: "1 Main St",
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 1Y5",
          ownerUserId: "owner-1",
          landlordId: "landlord-1",
          managerUserIds: ["manager-1", "manager-2"],
          unitCount: 2,
          occupiedUnitCount: 1,
          vacantUnitCount: 1,
          createdAt: "2026-01-01",
          updatedAt: "2026-02-01",
          integrity: { hasIssues: true, orphaned: false, missingOwner: false },
        },
      ],
      total: 1200,
    });

    const { ADMIN_EXPORT_ROW_CAP, buildAdminPropertiesCsv } = await import("../admin/adminCsvExport");
    const result = await buildAdminPropertiesCsv({ q: "Main", page: 3, pageSize: 10 } as any);

    expect(mocks.listAdminPropertiesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "Main",
        page: 1,
        pageSize: ADMIN_EXPORT_ROW_CAP,
      })
    );
    expect(result.filename).toMatch(/^admin-properties-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.capped).toBe(true);
    expect(result.content).toContain('name,address1,city');
    expect(result.content).toContain('"Main ""House"""');
    expect(result.content).toContain("manager-1 | manager-2");
  });

  it("flattens integrity sections into a readable CSV shape", async () => {
    mocks.loadAdminIntegrityMock.mockResolvedValue({
      sections: [
        {
          key: "duplicate_active_leases",
          label: "Duplicate Active Leases",
          severity: "high",
          count: 2,
          description: "Multiple active lease agreements resolve to the same context.",
          samples: [
            {
              id: "sample-1",
              type: "lease",
              label: "Lease lease-1",
              propertyId: "prop-1",
              leaseId: "lease-1",
              tenantId: "tenant-1",
              relatedAdminPath: "/admin/leases?q=lease-1",
            },
          ],
        },
      ],
    });

    const { buildAdminIntegrityCsv } = await import("../admin/adminCsvExport");
    const result = await buildAdminIntegrityCsv();

    expect(result.filename).toMatch(/^admin-integrity-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.rowCount).toBe(1);
    expect(result.content).toContain("sectionKey,sectionLabel,severity,count");
    expect(result.content).toContain("duplicate_active_leases,Duplicate Active Leases,high,2");
    expect(result.content).toContain("/admin/leases?q=lease-1");
  });
});
