import { describe, expect, it } from "vitest";
import { buildLeaseChargeSchedulePreview } from "../chargeSchedulePreview";
import { RECEIVABLE_SCHEDULE_STATE_STALE, buildReceivablesFingerprint, validateChargeSchedulePreviewFingerprint } from "../receivablesFingerprint";

const input = {
  leaseId: "lease-1", propertyId: "property-1", sourceLeaseVersion: "v1",
  leaseStartDate: "2026-01-01", leaseEndDate: "2026-03-31", monthlyRentCents: 100000,
  dueDay: 1, currency: "cad", billingFrequency: "monthly", asOfDate: "2025-12-01", previewThroughDate: "2026-03-31",
};

describe("receivablesFingerprint", () => {
  it("stably serializes object keys", () => {
    expect(buildReceivablesFingerprint({ b: 2, a: 1 })).toBe(buildReceivablesFingerprint({ a: 1, b: 2 }));
  });

  it("produces the same schedule fingerprint for the same inputs", () => {
    expect(buildLeaseChargeSchedulePreview(input).previewFingerprint).toBe(buildLeaseChargeSchedulePreview({ ...input }).previewFingerprint);
  });

  it("changes when material lease terms change", () => {
    const first = buildLeaseChargeSchedulePreview(input);
    const changed = buildLeaseChargeSchedulePreview({ ...input, monthlyRentCents: 100001 });
    expect(first.previewFingerprint).not.toBe(changed.previewFingerprint);
  });

  it("detects missing and stale fingerprints", () => {
    const current = buildLeaseChargeSchedulePreview(input).previewFingerprint;
    expect(validateChargeSchedulePreviewFingerprint({ currentPreviewFingerprint: current })).toEqual({ ok: false, code: RECEIVABLE_SCHEDULE_STATE_STALE });
    expect(validateChargeSchedulePreviewFingerprint({ expectedPreviewFingerprint: "stale", currentPreviewFingerprint: current })).toEqual({ ok: false, code: RECEIVABLE_SCHEDULE_STATE_STALE });
    expect(validateChargeSchedulePreviewFingerprint({ expectedPreviewFingerprint: current, currentPreviewFingerprint: current })).toEqual({ ok: true });
  });
});
