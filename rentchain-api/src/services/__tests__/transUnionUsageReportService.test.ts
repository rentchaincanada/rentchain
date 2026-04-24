import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      where: () => ({
        where: () => ({
          get: async () => ({ docs: [] }),
        }),
      }),
    }),
  },
}));
import { __testing } from "../screening/transUnionUsageReportService";

describe("transUnionUsageReportService", () => {
  it("aggregates funnel, usage, compliance, and excludes sensitive data", () => {
    const report = __testing.buildUsageReport(
      [
        {
          id: "1",
          version: "v1",
          type: "tu_option_viewed",
          domain: "screening",
          action: "tu_option_viewed",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion" },
          occurredAt: "2026-03-02T10:00:00.000Z",
          recordedAt: "2026-03-02T10:00:00.000Z",
          visibility: "internal",
          summary: "Viewed",
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        },
        {
          id: "2",
          version: "v1",
          type: "tu_get_access_clicked",
          domain: "screening",
          action: "tu_get_access_clicked",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion" },
          occurredAt: "2026-03-02T10:01:00.000Z",
          recordedAt: "2026-03-02T10:01:00.000Z",
          visibility: "internal",
          summary: "Clicked",
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        },
        {
          id: "3",
          version: "v1",
          type: "tu_credentials_submitted",
          domain: "screening",
          action: "tu_credentials_submitted",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion" },
          occurredAt: "2026-03-02T10:02:00.000Z",
          recordedAt: "2026-03-02T10:02:00.000Z",
          visibility: "internal",
          summary: "Submitted",
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        },
        {
          id: "4",
          version: "v1",
          type: "tu_connected",
          domain: "screening",
          action: "tu_connected",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion" },
          occurredAt: "2026-03-02T10:03:00.000Z",
          recordedAt: "2026-03-02T10:03:00.000Z",
          visibility: "internal",
          summary: "Connected",
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        },
        {
          id: "5",
          version: "v1",
          type: "screening_permissible_purpose_confirmed",
          domain: "screening",
          action: "screening_permissible_purpose_confirmed",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion" },
          occurredAt: "2026-03-02T10:03:00.000Z",
          recordedAt: "2026-03-02T10:03:00.000Z",
          visibility: "internal",
          summary: "Permissible purpose",
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        },
        {
          id: "6",
          version: "v1",
          type: "screening_consent_confirmed",
          domain: "screening",
          action: "screening_consent_confirmed",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "rental_application", id: "app-1" },
          occurredAt: "2026-03-02T10:04:00.000Z",
          recordedAt: "2026-03-02T10:04:00.000Z",
          visibility: "internal",
          summary: "Consent",
          metadata: { providerKey: "transunion", landlordId: "landlord-1", applicationId: "app-1" },
        },
        {
          id: "7",
          version: "v1",
          type: "screening_request_created",
          domain: "screening",
          action: "screening_request_created",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
          occurredAt: "2026-03-02T10:05:00.000Z",
          recordedAt: "2026-03-02T10:05:00.000Z",
          visibility: "internal",
          summary: "Created",
          metadata: {
            providerKey: "transunion",
            landlordId: "landlord-1",
            applicationId: "app-1",
            orderId: "order-1",
            applicationCreatedAt: "2026-03-02T09:35:00.000Z",
            passcode: "SHOULD_NOT_APPEAR",
          },
        },
        {
          id: "8",
          version: "v1",
          type: "screening_request_submitted",
          domain: "screening",
          action: "screening_request_submitted",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
          occurredAt: "2026-03-02T10:06:00.000Z",
          recordedAt: "2026-03-02T10:06:00.000Z",
          visibility: "internal",
          summary: "Submitted",
          metadata: { providerKey: "transunion", landlordId: "landlord-1", applicationId: "app-1", orderId: "order-1" },
        },
        {
          id: "9",
          version: "v1",
          type: "screening_completed",
          domain: "screening",
          action: "screening_completed",
          status: "completed",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
          occurredAt: "2026-03-02T10:15:00.000Z",
          recordedAt: "2026-03-02T10:15:00.000Z",
          visibility: "internal",
          summary: "Completed",
          metadata: { providerKey: "transunion", landlordId: "landlord-1", applicationId: "app-1", orderId: "order-1" },
        },
        {
          id: "10",
          version: "v1",
          type: "screening_blocked",
          domain: "screening",
          action: "screening_blocked",
          status: "blocked",
          actor: { id: "user-2", role: "landlord", type: "landlord" },
          resource: { type: "rental_application", id: "app-2" },
          occurredAt: "2026-03-03T10:00:00.000Z",
          recordedAt: "2026-03-03T10:00:00.000Z",
          visibility: "internal",
          summary: "Blocked",
          metadata: {
            providerKey: "transunion",
            landlordId: "landlord-2",
            applicationId: "app-2",
            blockReason: "missing_consent",
            memberCode: "SHOULD_NOT_APPEAR_EITHER",
          },
        },
      ] as any,
      {
        label: "last_30_days",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-31T23:59:59.999Z",
      }
    );

    expect(report.funnel.optionViewed).toBe(1);
    expect(report.funnel.connectionSuccesses).toBe(1);
    expect(report.usage.totalScreeningRequests).toBe(2);
    expect(report.usage.completedScreenings).toBe(1);
    expect(report.compliance.requestsBlockedForMissingConsent).toBe(1);
    expect(report.quality.averageTimeFromApplicationToScreeningRequestMinutes).toBe(30);
    expect(JSON.stringify(report)).not.toContain("SHOULD_NOT_APPEAR");
    expect(JSON.stringify(report)).not.toContain("SHOULD_NOT_APPEAR_EITHER");
  });
});
