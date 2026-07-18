import { describe, expect, it } from "vitest";
import { MAX_CHARGE_SCHEDULE_OCCURRENCES, buildLeaseChargeSchedulePreview } from "../chargeSchedulePreview";

const base = {
  leaseId: "lease-1",
  propertyId: "property-1",
  unitId: "unit-1",
  responsibilityId: "responsibility-1",
  tenantId: "tenant-1",
  sourceLeaseVersion: "lease-v1",
  leaseStartDate: "2026-01-01",
  leaseEndDate: "2026-12-31",
  monthlyRentCents: 200000,
  dueDay: 1,
  currency: "cad",
  billingFrequency: "monthly",
  depositAmountCents: null,
  asOfDate: "2025-12-15",
  previewThroughDate: "2026-12-31",
};

describe("chargeSchedulePreview", () => {
  it("builds a deterministic monthly schedule", () => {
    const preview = buildLeaseChargeSchedulePreview(base);
    expect(preview.allowed).toBe(true);
    expect(preview.occurrences).toHaveLength(12);
    expect(preview.occurrences[0]).toEqual(expect.objectContaining({ dueDate: "2026-01-01", amountCents: 200000 }));
    expect(preview.occurrences[11]).toEqual(expect.objectContaining({ dueDate: "2026-12-01" }));
    expect(preview.totals.scheduledRentCents).toBe(2400000);
  });

  it("clamps due day to short months using date-only UTC arithmetic", () => {
    const preview = buildLeaseChargeSchedulePreview({ ...base, dueDay: 31, leaseEndDate: "2026-03-31", previewThroughDate: "2026-03-31" });
    expect(preview.occurrences.map((row) => row.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("does not silently prorate a partial first month", () => {
    const preview = buildLeaseChargeSchedulePreview({ ...base, leaseStartDate: "2026-01-15", leaseEndDate: "2026-03-31", previewThroughDate: "2026-03-31" });
    expect(preview.findings).toContainEqual(expect.objectContaining({ code: "proration_policy_required", severity: "review" }));
    expect(preview.occurrences[0]).toEqual(expect.objectContaining({ dueDate: "2026-02-01", amountCents: 200000 }));
  });

  it("adds a separate deposit charge without custody semantics", () => {
    const preview = buildLeaseChargeSchedulePreview({ ...base, leaseEndDate: "2026-01-31", previewThroughDate: "2026-01-31", depositAmountCents: 100000 });
    expect(preview.occurrences.map((row) => row.type)).toEqual(["deposit_charge", "scheduled_rent_charge"]);
    expect(preview.totals.depositChargeCents).toBe(100000);
  });

  it("fails closed for missing fields and unsupported frequency", () => {
    const missing = buildLeaseChargeSchedulePreview({});
    expect(missing.allowed).toBe(false);
    expect(missing.occurrences).toEqual([]);
    const unsupported = buildLeaseChargeSchedulePreview({ ...base, billingFrequency: "weekly" });
    expect(unsupported.allowed).toBe(false);
    expect(unsupported.findings).toContainEqual(expect.objectContaining({ code: "unsupported_billing_frequency" }));
  });

  it("bounds open-ended schedule previews", () => {
    const preview = buildLeaseChargeSchedulePreview({ ...base, leaseEndDate: null, previewThroughDate: "2040-12-31" });
    expect(preview.occurrences.length).toBe(MAX_CHARGE_SCHEDULE_OCCURRENCES);
    expect(preview.allowed).toBe(false);
    expect(preview.findings).toContainEqual(expect.objectContaining({ code: "preview_horizon_exceeds_max_occurrences" }));
  });
});
