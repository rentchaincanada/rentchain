import { describe, expect, it } from "vitest";

import {
  canGenerateCureNotice,
  canGenerateEvictionNotice,
  canGenerateTerminationNotice,
  validateNoticeAutomationPrerequisites,
} from "../noticeValidationRules";

function validLease(overrides: Record<string, unknown> = {}) {
  return {
    id: "lease-1",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    status: "active",
    leaseType: "fixed_term",
    province: "NS",
    leaseStartDate: "2026-02-01",
    leaseEndDate: "2027-01-31",
    currentRent: 1800,
    currency: "CAD",
    autoNoticeEnabled: true,
    noticeRuleVersion: "ns-v1",
    noticeLeadDays: 90,
    nextNoticeDueAt: Date.UTC(2026, 10, 1, 12, 0, 0, 0),
    latestNoticeId: null,
    latestRenewalIntent: null,
    latestRenewalIntentAt: null,
    renewalRentChangeMode: null,
    renewalOfferedRent: null,
    renewalDecisionDeadlineAt: null,
    renewalNewTermType: null,
    renewalNewLeaseStartDate: null,
    renewalNewLeaseEndDate: null,
    moveOutDate: null,
    createdAt: Date.UTC(2026, 0, 1, 12, 0, 0, 0),
    updatedAt: Date.UTC(2026, 0, 1, 12, 0, 0, 0),
    tenantName: "Tenant One",
    unitLabel: "Unit 1",
    propertyLabel: "Property One",
    propertyAddress: "1 Main St",
    jurisdictionWorkflow: null,
    ...overrides,
  } as any;
}

const validPreviewInput = {
  rentChangeMode: "no_change" as const,
  proposedRent: null,
  newTermType: "fixed_term" as const,
  newLeaseStartDate: "2027-02-01",
  newLeaseEndDate: "2028-01-31",
  responseDeadlineAt: Date.UTC(2027, 0, 15, 12, 0, 0, 0),
  noticeType: "renewal_offer" as const,
};

describe("noticeValidationRules", () => {
  it("allows complete active leases with supported jurisdiction rules", () => {
    const result = validateNoticeAutomationPrerequisites({
      lease: validLease(),
      previewInput: validPreviewInput,
    });

    expect(result.ok).toBe(true);
    expect(result.failedRules).toEqual([]);
    expect(result.checkedRules).toEqual(
      expect.arrayContaining([
        "lease_state_allowed",
        "tenant_context_present",
        "landlord_context_present",
        "jurisdiction_supported",
        "notice_type_allowed",
      ])
    );
  });

  it("fails closed for blocked lease states", () => {
    const result = canGenerateEvictionNotice(validLease({ status: "ended" }), validPreviewInput);

    expect(result.ok).toBe(false);
    expect(result.failedRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "lease_state_allowed",
        }),
      ])
    );
  });

  it("requires tenant, landlord, property, unit, and rent context", () => {
    const result = canGenerateCureNotice(
      validLease({
        tenantId: "",
        landlordId: "",
        propertyId: "",
        unitId: "",
        currentRent: null,
      }),
      validPreviewInput
    );

    expect(result.ok).toBe(false);
    expect(result.failedRules.map((rule) => rule.code)).toEqual(
      expect.arrayContaining([
        "tenant_context_present",
        "landlord_context_present",
        "lease_property_context_present",
        "rent_terms_present",
      ])
    );
  });

  it("rejects unsupported jurisdictions and disallowed notice types", () => {
    const unsupported = canGenerateTerminationNotice(validLease({ province: "ZZ" }), validPreviewInput);
    expect(unsupported.ok).toBe(false);
    expect(unsupported.failedRules.map((rule) => rule.code)).toEqual(
      expect.arrayContaining(["jurisdiction_supported", "notice_type_allowed"])
    );

    const wrongType = validateNoticeAutomationPrerequisites({
      lease: validLease({ leaseType: "month_to_month", leaseEndDate: null }),
      previewInput: {
        ...validPreviewInput,
        noticeType: "renewal_offer",
        newLeaseEndDate: null,
      },
    });
    expect(wrongType.ok).toBe(false);
    expect(wrongType.failedRules.map((rule) => rule.code)).toContain("notice_type_allowed");
  });

  it("requires term dates and response deadlines required by the notice rule", () => {
    const result = validateNoticeAutomationPrerequisites({
      lease: validLease({ leaseStartDate: null, leaseEndDate: null }),
      previewInput: {
        ...validPreviewInput,
        newLeaseStartDate: "",
        newLeaseEndDate: null,
        responseDeadlineAt: 0,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.failedRules.map((rule) => rule.code)).toEqual(
      expect.arrayContaining(["term_dates_present", "response_deadline_present"])
    );
  });
});
