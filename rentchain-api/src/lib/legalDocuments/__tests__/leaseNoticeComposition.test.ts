import { describe, expect, it } from "vitest";
import { resolveLeaseNoticeRule } from "../../../config/leaseNoticeRules";
import { composeLeaseNoticeLegalDocument } from "../leaseNoticeComposition";

describe("leaseNoticeComposition", () => {
  it("composes province-aware notice metadata without raw document payloads", () => {
    const rule = resolveLeaseNoticeRule({ province: "NS", leaseType: "fixed_term" });
    expect(rule).toBeTruthy();

    const documentDefinition = composeLeaseNoticeLegalDocument({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      province: "NS",
      leaseType: "fixed_term",
      noticeType: "renewal_offer",
      rule: rule!,
      rentChangeMode: "increase",
      currency: "CAD",
      currentRent: 1800,
      proposedRent: 1900,
      newTermType: "fixed_term",
      newTermStartDate: "2026-04-01",
      newTermEndDate: "2027-03-31",
      responseDeadlineAt: Date.UTC(2026, 2, 1),
      noticeDueAt: Date.UTC(2026, 0, 1),
    });

    expect(documentDefinition.metadata).toMatchObject({
      documentKind: "lease_notice",
      province: "NS",
      templateKey: "ns.fixed_term.renewal_offer.v1",
      version: "ns-v1",
      sensitivity: "restricted",
      governance: {
        sensitivity: "restricted",
        retentionCategory: "export_metadata",
        metadataOnly: true,
      },
    });
    expect(documentDefinition.heading).toEqual({
      title: "Lease notice preview",
      description: "Proposed rent: 1900 CAD",
    });
    expect(documentDefinition.sections.map((section) => section.id)).toEqual([
      "notice-context",
      "term-response",
    ]);
  });
});
