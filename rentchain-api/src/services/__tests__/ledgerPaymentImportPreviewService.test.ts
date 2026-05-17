import { describe, expect, it } from "vitest";
import { previewPaymentCsvImport } from "../ledgerPaymentImportPreviewService";

const tenants = [
  { id: "tenant-1", fullName: "Bailey Blinkers", email: "bailey@example.com", landlordId: "landlord-1" },
  { id: "tenant-2", fullName: "Center Suites", email: "center@example.com", landlordId: "landlord-1" },
  { id: "tenant-3", fullName: "Sam Same", email: "sam1@example.com", landlordId: "landlord-1" },
  { id: "tenant-4", fullName: "Sam Same", email: "sam2@example.com", landlordId: "landlord-1" },
  { id: "tenant-past", fullName: "Past Tenant", email: "past@example.com", landlordId: "landlord-1" },
];

const properties = [
  { id: "property-1", name: "Harbour View" },
  { id: "property-2", name: "Center Plaza" },
];

const units = [
  { id: "unit-1", propertyId: "property-1", unitNumber: "1" },
  { id: "unit-2", propertyId: "property-2", unitNumber: "204" },
  { id: "unit-3", propertyId: "property-1", unitNumber: "3" },
  { id: "unit-4", propertyId: "property-2", unitNumber: "4" },
];

const leases = [
  {
    id: "lease-1",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    status: "active",
  },
  {
    id: "lease-2",
    landlordId: "landlord-1",
    tenantId: "tenant-2",
    propertyId: "property-2",
    unitId: "unit-2",
    status: "active",
  },
  {
    id: "lease-3",
    landlordId: "landlord-1",
    tenantId: "tenant-3",
    propertyId: "property-1",
    unitId: "unit-3",
    status: "active",
  },
  {
    id: "lease-4",
    landlordId: "landlord-1",
    tenantId: "tenant-4",
    propertyId: "property-2",
    unitId: "unit-4",
    status: "active",
  },
  {
    id: "lease-past",
    landlordId: "landlord-1",
    tenantId: "tenant-past",
    propertyId: "property-1",
    unitId: "unit-1",
    status: "ended",
  },
];

function preview(csvText: string) {
  return previewPaymentCsvImport({
    filename: "payments.csv",
    csvText,
    tenants,
    leases,
    properties,
    units,
  });
}

describe("ledgerPaymentImportPreviewService", () => {
  it("previews valid CSV rows and groups totals by property without writing", () => {
    const result = preview(
      [
        "tenantName,property,unit,amount,paymentDate,method,reference",
        "Bailey Blinkers,Harbour View,1,150.00,2026-05-15,etransfer,may-rent",
        "Center Suites,Center Plaza,204,$200.50,2026-05-16,cheque,receipt-2",
      ].join("\n")
    );

    expect(result.summary.totalRows).toBe(2);
    expect(result.summary.totalPaymentAmountCents).toBe(35050);
    expect(result.summary.groupedByProperty).toEqual([
      { propertyLabel: "Center Plaza", rowCount: 1, amountCents: 20050, amountDisplay: "$200.50" },
      { propertyLabel: "Harbour View", rowCount: 1, amountCents: 15000, amountDisplay: "$150.00" },
    ]);
    expect(result.rows[0]).toMatchObject({
      matchStatus: "matched",
      confidence: "high",
      preselected: true,
      matchedTenantId: "tenant-1",
      leaseId: "lease-1",
      amountCents: 15000,
      paymentDate: "2026-05-15",
    });
  });

  it("uses email plus active lease as a high-confidence match", () => {
    const result = preview("tenantName,tenantEmail,amount,paymentDate\nWrong Name,center@example.com,75,2026-05-15");
    expect(result.rows[0]).toMatchObject({
      matchStatus: "matched",
      confidence: "high",
      matchedTenantId: "tenant-2",
      preselected: true,
    });
  });

  it("marks tenant name and property matches without unit as medium confidence", () => {
    const result = preview("tenantName,property,amount,paymentDate\nBailey Blinkers,Harbour View,150,2026-05-15");
    expect(result.rows[0]).toMatchObject({
      matchStatus: "matched",
      confidence: "medium",
      matchedTenantId: "tenant-1",
      preselected: false,
    });
  });

  it("blocks ambiguous tenant matches", () => {
    const result = preview("tenantName,amount,paymentDate\nSam Same,99,2026-05-15");
    expect(result.rows[0]).toMatchObject({
      matchStatus: "ambiguous",
      confidence: "low",
      preselected: false,
      matchedTenantId: null,
    });
    expect(result.summary.ambiguousRows).toBe(1);
  });

  it("rejects invalid amount and missing date rows", () => {
    const result = preview(
      [
        "tenantName,property,unit,amount,paymentDate",
        "Bailey Blinkers,Harbour View,1,not-money,2026-05-15",
        "Bailey Blinkers,Harbour View,1,150,",
      ].join("\n")
    );

    expect(result.summary.invalidRows).toBe(2);
    expect(result.rows.every((row) => row.matchStatus === "invalid")).toBe(true);
  });

  it("does not preselect duplicate rows from the same CSV", () => {
    const result = preview(
      [
        "tenantName,property,unit,amount,paymentDate,reference",
        "Bailey Blinkers,Harbour View,1,150,2026-05-15,dup",
        "Bailey Blinkers,Harbour View,1,150,2026-05-15,dup",
      ].join("\n")
    );

    expect(result.summary.duplicateRows).toBe(2);
    expect(result.rows.every((row) => row.duplicateInFile && !row.preselected)).toBe(true);
  });

  it("keeps inactive or past tenant matches blocked", () => {
    const result = preview("tenantName,property,unit,amount,paymentDate\nPast Tenant,Harbour View,1,100,2026-05-15");
    expect(result.rows[0]).toMatchObject({
      matchStatus: "unmatched",
      confidence: "low",
      preselected: false,
      matchedTenantId: "tenant-past",
    });
  });
});
