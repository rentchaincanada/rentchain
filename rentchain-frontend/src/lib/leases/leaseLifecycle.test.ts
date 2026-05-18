import { describe, expect, it } from "vitest";
import {
  deriveLeaseLifecycleStatus,
  deriveUnitOccupancyFromLeases,
  getExpiringSoonLeases,
  isLeaseCurrentlyActive,
  isLeaseExpired,
} from "./leaseLifecycle";

const today = "2026-05-04";

describe("leaseLifecycle", () => {
  it("prefers backend derived lifecycle state when present", () => {
    const lease = {
      id: "lease-derived",
      unitId: "unit-1",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      derivedLifecycleState: "expired",
      derivedLifecycleReasons: ["end_date_past"],
    };

    expect(deriveLeaseLifecycleStatus(lease, today)).toBe("expired");
    expect(isLeaseCurrentlyActive(lease, today)).toBe(false);
  });

  it("treats expired leases as expired instead of active", () => {
    const lease = {
      id: "lease-expired",
      unitId: "unit-1",
      status: "active",
      startDate: "2025-05-01",
      endDate: "2026-04-30",
    };

    expect(deriveLeaseLifecycleStatus(lease, today)).toBe("expired");
    expect(isLeaseExpired(lease, today)).toBe(true);
    expect(isLeaseCurrentlyActive(lease, today)).toBe(false);
  });

  it("derives active, notice-period, future, and vacant unit occupancy from leases", () => {
    expect(
      deriveUnitOccupancyFromLeases(
        { id: "unit-active", unitNumber: "101", status: "vacant" },
        [
          {
            id: "lease-active",
            unitId: "unit-active",
            status: "active",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
          },
        ],
        today
      )
    ).toMatchObject({ status: "occupied", label: "Occupied" });

    expect(
      deriveUnitOccupancyFromLeases(
        { id: "unit-notice", unitNumber: "102" },
        [
          {
            id: "lease-notice",
            unitId: "unit-notice",
            status: "move_out_pending",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
          },
        ],
        today
      )
    ).toMatchObject({ status: "occupied", label: "Occupied" });

    expect(
      deriveUnitOccupancyFromLeases(
        { id: "unit-future", unitNumber: "103" },
        [
          {
            id: "lease-future",
            unitId: "unit-future",
            status: "active",
            signatureStatus: "signed",
            startDate: "2026-06-01",
            endDate: "2027-05-31",
          },
        ],
        today
      )
    ).toMatchObject({ status: "upcoming", label: "Upcoming" });

    expect(
      deriveUnitOccupancyFromLeases(
        { id: "unit-stale", unitNumber: "104", status: "occupied" },
        [
          {
            id: "lease-stale",
            unitId: "unit-stale",
            status: "active",
            startDate: "2025-01-01",
            endDate: "2026-04-01",
          },
        ],
        today
      )
    ).toMatchObject({ status: "vacant", label: "Vacant" });
  });

  it("respects valid manual unit occupancy when only expired leases exist", () => {
    expect(
      deriveUnitOccupancyFromLeases(
        {
          id: "unit-manual",
          unitNumber: "105",
          status: "occupied",
          occupantName: "Leen Bakri-Kasbah and Patricia Emeline Krisinta",
          leaseEndDate: "2027-04-30",
        },
        [
          {
            id: "lease-expired",
            unitId: "unit-manual",
            status: "active",
            startDate: "2025-01-01",
            endDate: "2026-04-30",
          },
        ],
        today
      )
    ).toMatchObject({ status: "occupied", label: "Occupied", lease: null });
  });

  it("returns only currently active leases ending inside the threshold", () => {
    const leases = [
      {
        id: "lease-29",
        unitId: "unit-1",
        status: "active",
        startDate: "2026-01-01",
        endDate: "2026-06-02",
      },
      {
        id: "lease-60",
        unitId: "unit-2",
        status: "active",
        startDate: "2026-01-01",
        endDate: "2026-07-03",
      },
      {
        id: "lease-future",
        unitId: "unit-3",
        status: "active",
        signatureStatus: "signed",
        startDate: "2026-06-01",
        endDate: "2026-07-01",
      },
      {
        id: "lease-expired",
        unitId: "unit-4",
        status: "active",
        startDate: "2025-01-01",
        endDate: "2026-05-01",
      },
    ];

    expect(getExpiringSoonLeases(leases, today, 60).map((lease) => lease.id)).toEqual(["lease-29", "lease-60"]);
  });

  it("maps backend unknown lifecycle to review-required occupancy", () => {
    expect(
      deriveUnitOccupancyFromLeases(
        { id: "unit-review", unitNumber: "105" },
        [
          {
            id: "lease-review",
            unitId: "unit-review",
            status: "active",
            derivedLifecycleState: "unknown",
            derivedLifecycleRequiresReview: true,
          },
        ],
        today
      )
    ).toMatchObject({ status: "review_required", label: "Review needed" });
  });

  it("keeps archived leases out of occupied display", () => {
    expect(
      deriveLeaseLifecycleStatus(
        {
          id: "lease-archived-derived",
          unitId: "unit-archived",
          status: "active",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          derivedLifecycleState: "archived",
        },
        today
      )
    ).toBe("archived");

    expect(
      deriveUnitOccupancyFromLeases(
        { id: "unit-archived", unitNumber: "106" },
        [
          {
            id: "lease-archived",
            unitId: "unit-archived",
            status: "archived",
            startDate: "2025-01-01",
            endDate: "2026-12-31",
          },
        ],
        today
      )
    ).toMatchObject({ status: "archived", label: "Archived" });
  });

  it("flags multiple current leases for one unit as review needed", () => {
    expect(
      deriveUnitOccupancyFromLeases(
        { id: "unit-conflict", unitNumber: "107" },
        [
          {
            id: "lease-active-1",
            unitId: "unit-conflict",
            status: "active",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
          },
          {
            id: "lease-active-2",
            unitId: "unit-conflict",
            status: "active",
            startDate: "2026-02-01",
            endDate: "2026-11-30",
          },
        ],
        today
      )
    ).toMatchObject({ status: "review_required", label: "Review needed" });
  });
});
