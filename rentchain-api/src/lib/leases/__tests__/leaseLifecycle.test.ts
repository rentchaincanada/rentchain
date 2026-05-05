import { describe, expect, it } from "vitest";
import {
  deriveLeaseLifecycleState,
  deriveUnitOccupancyFromLeaseLifecycle,
  isLeaseExpiringSoon,
} from "../leaseLifecycle";

const today = "2026-05-05";

describe("leaseLifecycle", () => {
  it("derives draft leases", () => {
    const result = deriveLeaseLifecycleState({ status: "draft" }, today);

    expect(result).toMatchObject({
      state: "draft",
      isCurrent: false,
      isTerminal: false,
      isOccupancyActive: false,
      requiresReview: false,
    });
    expect(result.reasons).toContain("draft_without_term_dates");
  });

  it("derives pending_signature when sent but not fully signed", () => {
    const result = deriveLeaseLifecycleState(
      {
        status: "sent",
        sentAt: "2026-05-01",
        tenantSignedAt: "2026-05-02",
        startDate: "2026-06-01",
        endDate: "2027-05-31",
      },
      today
    );

    expect(result.state).toBe("pending_signature");
    expect(result.reasons).toContain("sent_not_fully_signed");
  });

  it("derives signed_future for fully signed leases before start date", () => {
    const result = deriveLeaseLifecycleState(
      {
        status: "active",
        tenantSignedAt: "2026-05-01",
        landlordSignedAt: "2026-05-02",
        startDate: "2026-06-01",
        endDate: "2027-05-31",
      },
      today
    );

    expect(result.state).toBe("signed_future");
    expect(result.isOccupancyActive).toBe(false);
  });

  it("derives active for signed current leases", () => {
    const result = deriveLeaseLifecycleState(
      {
        status: "active",
        signedAt: "2026-01-01",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      today
    );

    expect(result).toMatchObject({
      state: "active",
      isCurrent: true,
      isOccupancyActive: true,
      isTerminal: false,
    });
  });

  it("derives notice_period when a current lease has notice data", () => {
    const result = deriveLeaseLifecycleState(
      {
        status: "active",
        signedAt: "2026-01-01",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        noticeGivenAt: "2026-05-01",
      },
      today
    );

    expect(result.state).toBe("notice_period");
    expect(result.isOccupancyActive).toBe(true);
  });

  it("derives expired for ended leases with no successor", () => {
    const result = deriveLeaseLifecycleState(
      {
        status: "active",
        signedAt: "2025-01-01",
        startDate: "2025-01-01",
        endDate: "2026-04-30",
      },
      today
    );

    expect(result).toMatchObject({
      state: "expired",
      isCurrent: false,
      isTerminal: true,
      isOccupancyActive: false,
    });
  });

  it("derives renewed for ended leases with signed successor hints", () => {
    const result = deriveLeaseLifecycleState(
      {
        status: "active",
        signedAt: "2025-01-01",
        startDate: "2025-01-01",
        endDate: "2026-04-30",
        successorLeaseId: "lease-next",
        hasSignedSuccessorLease: true,
      },
      today
    );

    expect(result).toMatchObject({
      state: "renewed",
      isTerminal: true,
      isRenewalProtected: true,
    });
  });

  it("derives terminated for effective termination dates", () => {
    const result = deriveLeaseLifecycleState(
      {
        status: "active",
        signedAt: "2026-01-01",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        terminationDate: "2026-05-01",
      },
      today
    );

    expect(result).toMatchObject({
      state: "terminated",
      isTerminal: true,
      isOccupancyActive: false,
    });
  });

  it("derives cancelled before activation", () => {
    const result = deriveLeaseLifecycleState(
      {
        status: "cancelled",
        sentAt: "2026-04-01",
        startDate: "2026-06-01",
        endDate: "2027-05-31",
      },
      today
    );

    expect(result).toMatchObject({
      state: "cancelled",
      isTerminal: true,
      requiresReview: false,
    });
  });

  it("flags contradictory date ranges as unknown and review-required", () => {
    const result = deriveLeaseLifecycleState(
      {
        status: "active",
        signedAt: "2026-01-01",
        startDate: "2026-12-31",
        endDate: "2026-01-01",
      },
      today
    );

    expect(result).toMatchObject({
      state: "unknown",
      requiresReview: true,
      isOccupancyActive: false,
    });
    expect(result.reasons).toContain("date_range_invalid");
  });

  it("maps active lifecycle to occupied unit occupancy", () => {
    const lifecycle = deriveLeaseLifecycleState(
      { status: "active", signedAt: "2026-01-01", startDate: "2026-01-01", endDate: "2026-12-31" },
      today
    );

    expect(deriveUnitOccupancyFromLeaseLifecycle(lifecycle)).toMatchObject({
      state: "occupied",
      leaseLifecycleState: "active",
    });
  });

  it("maps notice_period lifecycle to notice_period occupancy", () => {
    const lifecycle = deriveLeaseLifecycleState(
      {
        status: "move_out_pending",
        signedAt: "2026-01-01",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      today
    );

    expect(deriveUnitOccupancyFromLeaseLifecycle(lifecycle)).toMatchObject({
      state: "notice_period",
      leaseLifecycleState: "notice_period",
    });
  });

  it("maps signed_future lifecycle to upcoming occupancy", () => {
    const lifecycle = deriveLeaseLifecycleState(
      {
        status: "active",
        signedAt: "2026-05-01",
        startDate: "2026-06-01",
        endDate: "2027-05-31",
      },
      today
    );

    expect(deriveUnitOccupancyFromLeaseLifecycle(lifecycle)).toMatchObject({
      state: "upcoming",
      leaseLifecycleState: "signed_future",
    });
  });

  it("maps expired, terminated, and cancelled lifecycles to vacant occupancy", () => {
    const expired = deriveLeaseLifecycleState(
      { status: "active", signedAt: "2025-01-01", startDate: "2025-01-01", endDate: "2026-04-30" },
      today
    );
    const terminated = deriveLeaseLifecycleState(
      { status: "terminated", startDate: "2026-01-01", endDate: "2026-12-31" },
      today
    );
    const cancelled = deriveLeaseLifecycleState({ status: "cancelled" }, today);

    expect(deriveUnitOccupancyFromLeaseLifecycle(expired).state).toBe("vacant");
    expect(deriveUnitOccupancyFromLeaseLifecycle(terminated).state).toBe("vacant");
    expect(deriveUnitOccupancyFromLeaseLifecycle(cancelled).state).toBe("vacant");
  });

  it("treats unknown lifecycle as review-required occupancy", () => {
    const unknown = deriveLeaseLifecycleState(
      { status: "active", startDate: "2026-12-31", endDate: "2026-01-01" },
      today
    );

    expect(deriveUnitOccupancyFromLeaseLifecycle(unknown)).toMatchObject({
      state: "review_required",
      leaseLifecycleState: "unknown",
    });
  });

  it("only flags active and notice-period leases as expiring soon", () => {
    expect(
      isLeaseExpiringSoon(
        { status: "active", signedAt: "2026-01-01", startDate: "2026-01-01", endDate: "2026-06-01" },
        today,
        60
      )
    ).toBe(true);
    expect(
      isLeaseExpiringSoon(
        {
          status: "move_out_pending",
          signedAt: "2026-01-01",
          startDate: "2026-01-01",
          endDate: "2026-06-01",
        },
        today,
        60
      )
    ).toBe(true);
    expect(
      isLeaseExpiringSoon(
        { status: "active", signedAt: "2025-01-01", startDate: "2025-01-01", endDate: "2026-04-30" },
        today,
        60
      )
    ).toBe(false);
    expect(
      isLeaseExpiringSoon(
        { status: "active", signedAt: "2026-05-01", startDate: "2026-06-01", endDate: "2026-06-30" },
        today,
        60
      )
    ).toBe(false);
    expect(
      isLeaseExpiringSoon(
        {
          status: "renewed",
          signedAt: "2025-01-01",
          startDate: "2025-01-01",
          endDate: "2026-06-01",
          successorLeaseId: "lease-next",
          hasSignedSuccessorLease: true,
        },
        today,
        60
      )
    ).toBe(false);
  });
});
