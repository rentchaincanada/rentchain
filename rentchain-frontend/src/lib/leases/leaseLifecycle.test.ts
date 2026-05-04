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
    ).toMatchObject({ status: "notice_period", label: "Notice period" });

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
});
