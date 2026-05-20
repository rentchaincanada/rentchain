import { describe, expect, it } from "vitest";
import { previewPaymentCsvImport } from "../ledgerPaymentImportPreviewService";
import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../__tests__/helpers/projectionSafetyAssertions";

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
      matchBasis: ["tenant", "property", "unit"],
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
      matchBasis: ["email"],
      preselected: true,
    });
  });

  it("accepts landlord spreadsheet headers and merges first and last name", () => {
    const result = preview(
      [
        "Reference,Date,First Name,Last Name,Rent Amount,Property,Unit,Method",
        "1001,2026-05-15,Bailey,Blinkers,1640,Harbour View,1,etransfer",
      ].join("\n")
    );

    expect(result.rows[0]).toMatchObject({
      tenantName: "Bailey Blinkers",
      reference: "1001",
      amountCents: 164000,
      paymentDate: "2026-05-15",
      method: "etransfer",
      matchBasis: ["tenant", "property", "unit"],
      matchStatus: "matched",
      confidence: "high",
      preselected: true,
    });
  });

  it("accepts suite, full name, paid date, and rent amount aliases", () => {
    const result = preview(
      "fullName,propertyName,suite,rentAmount,paidDate,ref\nBailey Blinkers,Harbour View,1,2000,2026-05-15,alias-ref"
    );

    expect(result.rows[0]).toMatchObject({
      tenantName: "Bailey Blinkers",
      unit: "1",
      amountCents: 200000,
      paymentDate: "2026-05-15",
      reference: "alias-ref",
      matchBasis: ["tenant", "property", "unit"],
      matchStatus: "matched",
      confidence: "high",
    });
  });

  it("ignores sensitive bank export columns without echoing their values", () => {
    const result = preview(
      [
        "Date,First Name,Last Name,Rent Amount,Property,Unit,Reference,Bank Account Number,Transit Number,Institution Number,Running Balance,Memo",
        "2026-05-15,Bailey,Blinkers,1640,Harbour View,1,receipt-safe,123456789,00123,004,99999.99,account 123456789 transfer",
      ].join("\n")
    );

    expect(result.rows[0]).toMatchObject({
      tenantName: "Bailey Blinkers",
      reference: "receipt-safe",
      amountCents: 164000,
      paymentDate: "2026-05-15",
      matchBasis: ["tenant", "property", "unit"],
      matchStatus: "matched",
      confidence: "high",
    });
    expect(result.notices).toEqual({
      ignoredColumns: true,
      sensitiveColumnsOmitted: true,
      messages: [
        "Some columns were ignored because they are not needed for rent payment import.",
        "Sensitive banking columns were detected and omitted from preview/import.",
      ],
    });

    expectNoRestrictedProjectionFields(result);
    expectPayloadDoesNotContainValues(result, [
      "123456789",
      "00123",
      "99999.99",
      "account 123456789 transfer",
      "Bank Account Number",
      "Transit Number",
      "Institution Number",
      "Running Balance",
      "Memo",
    ]);
  });

  it("reports generic ignored columns without returning ignored values", () => {
    const result = preview(
      [
        "tenantName,property,unit,amount,paymentDate,Unneeded Export Column",
        "Bailey Blinkers,Harbour View,1,150,2026-05-15,internal-bank-note",
      ].join("\n")
    );

    expect(result.notices.ignoredColumns).toBe(true);
    expect(result.notices.sensitiveColumnsOmitted).toBe(false);
    expect(result.notices.messages).toEqual([
      "Some columns were ignored because they are not needed for rent payment import.",
    ]);
    expect(JSON.stringify(result)).not.toContain("internal-bank-note");
  });

  it("marks tenant name and property matches without unit as medium confidence", () => {
    const result = preview("tenantName,property,amount,paymentDate\nBailey Blinkers,Harbour View,150,2026-05-15");
    expect(result.rows[0]).toMatchObject({
      matchStatus: "matched",
      confidence: "medium",
      matchBasis: ["tenant", "property"],
      matchedTenantId: "tenant-1",
      preselected: false,
    });
  });

  it("marks exactly one tenant-only active lease match as review-required medium confidence", () => {
    const result = preview("tenantName,amount,paymentDate\nBailey Blinkers,150,2026-05-15");
    expect(result.rows[0]).toMatchObject({
      matchStatus: "matched",
      confidence: "medium",
      matchBasis: ["tenant"],
      matchedTenantId: "tenant-1",
      preselected: false,
      warning: "Tenant matched by name only. Please confirm before import.",
    });
  });

  it("blocks ambiguous tenant matches", () => {
    const result = preview("tenantName,amount,paymentDate\nSam Same,99,2026-05-15");
    expect(result.rows[0]).toMatchObject({
      matchStatus: "ambiguous",
      confidence: "low",
      matchBasis: ["tenant"],
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
    expect(result.rows[0].reason).toContain("Amount is required");
    expect(result.rows[1].reason).toContain("Payment date is required");
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
