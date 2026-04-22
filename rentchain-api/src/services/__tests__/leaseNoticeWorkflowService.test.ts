import { describe, expect, it } from "vitest";
import {
  deriveLeaseNoticeExecutionInputSnapshot,
  normalizeLeaseRecord,
  sanitizeLeaseRenewalOperatorInput,
} from "../leaseNoticeWorkflowService";

describe("leaseNoticeWorkflowService renewal operator inputs", () => {
  it("keeps readiness partial when term fields are still unset", () => {
    const lease = normalizeLeaseRecord("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      leaseType: "fixed_term",
      province: "NS",
      currentRent: 1650,
      leaseEndDate: "2026-05-10",
      renewalRentChangeMode: "no_change",
      renewalDecisionDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
      status: "active",
    });

    expect(deriveLeaseNoticeExecutionInputSnapshot(lease)).toEqual(
      expect.objectContaining({
        state: "partial",
        missingFields: ["newTermType", "newLeaseStartDate", "newLeaseEndDate"],
        input: expect.objectContaining({
          rentChangeMode: "no_change",
          responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
          newTermType: null,
        }),
      })
    );
  });

  it("promotes readiness to complete when canonical renewal inputs are fully stored on the lease", () => {
    const lease = normalizeLeaseRecord("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      leaseType: "fixed_term",
      province: "NS",
      currentRent: 1650,
      leaseEndDate: "2026-05-10",
      renewalRentChangeMode: "no_change",
      renewalDecisionDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
      renewalNewTermType: "fixed_term",
      renewalNewLeaseStartDate: "2026-05-11",
      renewalNewLeaseEndDate: "2027-05-10",
      status: "active",
    });

    expect(deriveLeaseNoticeExecutionInputSnapshot(lease)).toEqual(
      expect.objectContaining({
        state: "complete",
        reason: null,
        missingFields: [],
        input: expect.objectContaining({
          rentChangeMode: "no_change",
          newTermType: "fixed_term",
          newLeaseStartDate: "2026-05-11",
          newLeaseEndDate: "2027-05-10",
        }),
      })
    );
  });

  it("rejects contradictory saved operator input payloads", () => {
    expect(
      sanitizeLeaseRenewalOperatorInput({
        rentChangeMode: "no_change",
        proposedRent: 1900,
      })
    ).toEqual({
      ok: false,
      error: "PROPOSED_RENT_NOT_ALLOWED_FOR_RENT_CHANGE_MODE",
    });
  });
});
