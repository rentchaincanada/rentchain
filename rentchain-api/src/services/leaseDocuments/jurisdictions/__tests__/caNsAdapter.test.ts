import { describe, expect, it } from "vitest";
import { buildEmailServiceConsentDisplay, buildLeaseDeliveryReadinessDisplay } from "../caNsAdapter";

function input(overrides: Record<string, any> = {}) {
  return {
    leaseId: "lease-1",
    lease: {
      landlordId: "landlord-1",
      ...overrides.lease,
    },
    landlord: {
      email: "landlord@example.com",
      ...overrides.landlord,
    },
    property: null,
    unit: null,
    tenants: [
      {
        email: "tenant@example.com",
      },
    ],
    formPFields: overrides.formPFields || null,
  } as any;
}

describe("CA_NS adapter email-service consent display", () => {
  it("renders clear missing guidance when email-service consent details are unavailable", () => {
    expect(buildEmailServiceConsentDisplay(input({ landlord: { email: "" }, tenants: [] }))).toBe(
      "Landlord and tenant consent details required before production use."
    );
  });

  it("renders provided email-service consent details without claiming legal validity", () => {
    const display = buildEmailServiceConsentDisplay(
      input({
        lease: {
          landlordEmailServiceConsent: true,
          tenantEmailServiceConsent: true,
          landlordServiceEmail: "service-landlord@example.com",
          tenantServiceEmail: "service-tenant@example.com",
          emailServiceConsentCapturedAt: "2026-06-17T10:00:00.000Z",
        },
      })
    );

    expect(display).toContain("Landlord consent: provided");
    expect(display).toContain("landlord service email: service-landlord@example.com");
    expect(display).toContain("tenant consent: provided");
    expect(display).toContain("tenant service email: service-tenant@example.com");
    expect(display).toContain("captured: 2026-06-17T10:00:00.000Z");
    expect(display).toContain("Verify applicable provincial requirements");
    expect(display).not.toMatch(/legal advice|enforceability guarantee|certified/i);
  });

  it("uses explicit Form P field overrides when provided", () => {
    const display = buildEmailServiceConsentDisplay(
      input({
        formPFields: {
          service_notices: {
            landlord_email_service_consent: { status: "provided", value: "consented" },
            tenant_email_service_consent: { status: "provided", value: "consented" },
            landlord_service_email: { status: "provided", value: "landlord-service@example.com" },
            tenant_service_email: { status: "provided", value: "tenant-service@example.com" },
            email_service_consent_captured_at: { status: "provided", value: "2026-06-17T11:00:00.000Z" },
          },
        },
      })
    );

    expect(display).toContain("landlord service email: landlord-service@example.com");
    expect(display).toContain("tenant service email: tenant-service@example.com");
    expect(display).toContain("captured: 2026-06-17T11:00:00.000Z");
  });
});

describe("CA_NS adapter lease delivery readiness display", () => {
  it("renders operational delivery tracking without legal claims", () => {
    const display = buildLeaseDeliveryReadinessDisplay(
      input({
        lease: {
          signedLeaseCopyDeliveryStatus: "delivered",
          signedLeaseCopyDeliveryMethod: "email",
          signedLeaseCopyDeliveredAt: "2026-06-17T14:00:00.000Z",
          actCopyDelivery: {
            status: "acknowledged",
            method: "email",
            deliveredAt: "2026-06-17T14:05:00.000Z",
            actLinkIncluded: true,
          },
        },
      })
    );

    expect(display).toContain("Signed lease copy delivery: delivered");
    expect(display).toContain("Act copy/link delivery: acknowledged");
    expect(display).toContain("Act copy/link recorded");
    expect(display).toContain("Operational tracking only");
    expect(display).toContain("verify applicable provincial requirements");
    expect(display).not.toMatch(/legal advice|certif|enforceability guarantee/i);
  });

  it("renders missing delivery tracking as not recorded", () => {
    const display = buildLeaseDeliveryReadinessDisplay(input());

    expect(display).toContain("Signed lease copy delivery: not recorded");
    expect(display).toContain("Act copy/link delivery: not recorded");
  });
});
