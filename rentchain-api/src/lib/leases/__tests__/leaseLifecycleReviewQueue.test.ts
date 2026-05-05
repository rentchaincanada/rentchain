import { describe, expect, it } from "vitest";
import {
  deriveLeaseLifecycleReviewItem,
  deriveLeaseLifecycleReviewQueue,
} from "../leaseLifecycleReviewQueue";

const today = "2026-05-05";
const detectedAt = "2026-05-05T12:00:00.000Z";

describe("leaseLifecycleReviewQueue", () => {
  it("creates a critical item for unknown lifecycle", () => {
    const item = deriveLeaseLifecycleReviewItem({
      lease: {
        id: "lease-unknown",
        landlordId: "landlord-1",
        propertyId: "property-1",
        unitId: "unit-1",
        status: "active",
        startDate: "2026-12-31",
        endDate: "2026-01-01",
      },
      today,
      detectedAt,
    });

    expect(item).toMatchObject({
      id: "lease_lifecycle:lease-unknown:unknown_lifecycle",
      leaseId: "lease-unknown",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      derivedLifecycleState: "unknown",
      severity: "critical",
      category: "unknown_lifecycle",
      recommendedAction: "Open lease record",
      createdFrom: "lease_lifecycle_review_queue_v1",
      detectedAt,
    });
    expect(item?.derivedLifecycleReasons).toContain("date_range_invalid");
  });

  it("creates an item when canonical lifecycle requires review", () => {
    const item = deriveLeaseLifecycleReviewItem({
      lease: {
        id: "lease-review",
        status: "unexpected_status",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      today,
      detectedAt,
    });

    expect(item).toMatchObject({
      leaseId: "lease-review",
      derivedLifecycleState: "unknown",
      severity: "critical",
      category: "unknown_lifecycle",
    });
  });

  it("does not flag a valid active lease", () => {
    const item = deriveLeaseLifecycleReviewItem({
      lease: {
        id: "lease-active",
        status: "active",
        signedAt: "2026-01-01",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      today,
      detectedAt,
    });

    expect(item).toBeNull();
  });

  it("flags expired occupancy conflicts when manual unit occupancy is current", () => {
    const item = deriveLeaseLifecycleReviewItem({
      lease: {
        id: "lease-expired",
        status: "active",
        signedAt: "2025-01-01",
        startDate: "2025-01-01",
        endDate: "2026-04-30",
        unitId: "unit-1",
      },
      unit: {
        id: "unit-1",
        status: "occupied",
        occupantName: "Leen Bakri-Kasbah",
        leaseEndDate: "2027-04-30",
      },
      today,
      detectedAt,
    });

    expect(item).toMatchObject({
      leaseId: "lease-expired",
      derivedLifecycleState: "expired",
      severity: "warning",
      category: "expired_occupancy_conflict",
      recommendedAction: "Confirm occupancy manually",
    });
  });

  it("flags missing dates for active-like leases", () => {
    const item = deriveLeaseLifecycleReviewItem({
      lease: {
        id: "lease-missing-dates",
        status: "active",
        signedAt: "2026-01-01",
        startDate: "2026-01-01",
      },
      today,
      detectedAt,
    });

    expect(item).toMatchObject({
      leaseId: "lease-missing-dates",
      severity: "critical",
      category: "missing_dates",
      recommendedAction: "Review lease dates",
    });
  });

  it("flags termination conflicts", () => {
    const item = deriveLeaseLifecycleReviewItem({
      lease: {
        id: "lease-termination",
        status: "active",
        signedAt: "2026-01-01",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        terminationDate: "2026-08-01",
      },
      today,
      detectedAt,
    });

    expect(item).toMatchObject({
      leaseId: "lease-termination",
      severity: "warning",
      category: "termination_conflict",
      recommendedAction: "Review termination notice",
    });
  });

  it("flags renewal ambiguity", () => {
    const item = deriveLeaseLifecycleReviewItem({
      lease: {
        id: "lease-renewal",
        status: "expired",
        startDate: "2025-01-01",
        endDate: "2026-04-30",
        renewalLeaseId: "lease-next-1",
        successorLeaseId: "lease-next-2",
      },
      today,
      detectedAt,
    });

    expect(item).toMatchObject({
      leaseId: "lease-renewal",
      severity: "warning",
      category: "renewal_ambiguity",
      recommendedAction: "Review renewal link",
    });
  });

  it("counts queue severities and sorts critical items first", () => {
    const queue = deriveLeaseLifecycleReviewQueue({
      leases: [
        {
          id: "lease-valid",
          status: "active",
          signedAt: "2026-01-01",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        },
        {
          id: "lease-warning",
          status: "active",
          signedAt: "2025-01-01",
          startDate: "2025-01-01",
          endDate: "2026-04-30",
          unitId: "unit-1",
        },
        {
          id: "lease-critical",
          status: "active",
          startDate: "2026-12-31",
          endDate: "2026-01-01",
        },
      ],
      units: [
        {
          id: "unit-1",
          status: "occupied",
          occupantName: "Manual Occupant",
          leaseEndDate: "2027-04-30",
        },
      ],
      today,
      detectedAt,
    });

    expect(queue.summary).toEqual({
      total: 2,
      critical: 1,
      warning: 1,
      info: 0,
    });
    expect(queue.items.map((item) => item.leaseId)).toEqual(["lease-critical", "lease-warning"]);
  });
});
