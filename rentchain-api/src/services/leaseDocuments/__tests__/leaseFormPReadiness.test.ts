import { describe, expect, it } from "vitest";
import { deriveNovaScotiaFormPReadiness } from "../leaseFormPReadiness";

function baseInput(overrides: Record<string, any> = {}) {
  return {
    leaseId: "lease-1",
    lease: {
      landlordId: "landlord-1",
      tenantIds: ["tenant-1"],
      province: "NS",
      unitNumber: "6",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      termType: "fixed",
      baseRentCents: 180000,
      dueDay: 1,
      paymentMethod: "etransfer",
      utilitiesIncluded: ["water"],
      depositCents: 90000,
      ...overrides.lease,
    },
    landlord: {
      displayName: "Oxford Landlord",
      email: "landlord@example.com",
      ...overrides.landlord,
    },
    property: {
      addressLine1: "10 Coburg Rd",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1Y9",
      propertyType: "apartment",
      ...overrides.property,
    },
    unit: {
      unitNumber: "6",
      ...overrides.unit,
    },
    tenants: Object.prototype.hasOwnProperty.call(overrides, "tenants")
      ? overrides.tenants
      : [
          {
            fullName: "Tenant One",
            email: "tenant@example.com",
            phone: "902-555-0100",
          },
        ],
    formPFields: overrides.formPFields || null,
  } as any;
}

describe("deriveNovaScotiaFormPReadiness", () => {
  it("derives provided core Form P fields from lease, landlord, property, unit, and tenant data", () => {
    const result = deriveNovaScotiaFormPReadiness(baseInput());

    expect(result.formPFields.parties.landlord_legal_name.status).toBe("provided");
    expect(result.formPFields.parties.tenant_names.value).toEqual(["Tenant One"]);
    expect(result.formPFields.premises.full_civic_address.value).toContain("10 Coburg Rd");
    expect(result.formPFields.term.start_date.status).toBe("provided");
    expect(result.formPFields.rent_payments.rent_amount.status).toBe("provided");
    expect(result.leaseReadiness.version).toBe("ns_form_p_readiness_v1");
    expect(result.leaseReadiness.completionPercent).toBeGreaterThan(30);
  });

  it("supports explicit not applicable and pending states for conditional fields", () => {
    const result = deriveNovaScotiaFormPReadiness(
      baseInput({
        formPFields: {
          premises: {
            agent: { status: "not_applicable", note: "No agent for this lease." },
            building_superintendent: { status: "pending" },
          },
          term: {
            public_housing: { status: "not_applicable" },
          },
        },
      })
    );

    expect(result.formPFields.premises.agent.status).toBe("not_applicable");
    expect(result.formPFields.premises.building_superintendent.status).toBe("pending");
    expect(result.formPFields.term.public_housing.status).toBe("not_applicable");
    expect(result.leaseReadiness.nonBlockingItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldKey: "agent", status: "not_applicable" }),
        expect.objectContaining({ fieldKey: "building_superintendent", status: "pending" }),
      ])
    );
  });

  it("derives structured email-service consent readiness fields", () => {
    const result = deriveNovaScotiaFormPReadiness(
      baseInput({
        lease: {
          landlordEmailServiceConsent: true,
          tenantEmailServiceConsent: "consented",
          landlordServiceEmail: "service-landlord@example.com",
          tenantServiceEmail: "service-tenant@example.com",
          emailServiceConsentCapturedAt: "2026-06-17T10:00:00.000Z",
        },
      })
    );

    expect(result.formPFields.service_notices.landlord_email_service_consent).toEqual(
      expect.objectContaining({ status: "provided", value: "consented" })
    );
    expect(result.formPFields.service_notices.tenant_email_service_consent).toEqual(
      expect.objectContaining({ status: "provided", value: "consented" })
    );
    expect(result.formPFields.service_notices.landlord_service_email).toEqual(
      expect.objectContaining({ status: "provided", value: "service-landlord@example.com" })
    );
    expect(result.formPFields.service_notices.tenant_service_email).toEqual(
      expect.objectContaining({ status: "provided", value: "service-tenant@example.com" })
    );
    expect(result.formPFields.service_notices.email_service_consent_captured_at).toEqual(
      expect.objectContaining({ status: "provided", value: "2026-06-17T10:00:00.000Z" })
    );
  });

  it("supports explicit not applicable state for email-service consent", () => {
    const result = deriveNovaScotiaFormPReadiness(
      baseInput({
        formPFields: {
          service_notices: {
            landlord_email_service_consent: { status: "not_applicable", note: "Email service not used." },
            tenant_email_service_consent: { status: "not_applicable", note: "Email service not used." },
            landlord_service_email: { status: "not_applicable" },
            tenant_service_email: { status: "not_applicable" },
            email_service_consent_captured_at: { status: "not_applicable" },
          },
        },
      })
    );

    expect(result.formPFields.service_notices.landlord_email_service_consent.status).toBe("not_applicable");
    expect(result.formPFields.service_notices.tenant_email_service_consent.status).toBe("not_applicable");
    expect(result.leaseReadiness.nonBlockingItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldKey: "landlord_email_service_consent", status: "not_applicable" }),
        expect.objectContaining({ fieldKey: "tenant_email_service_consent", status: "not_applicable" }),
      ])
    );
  });

  it("marks missing required fields as blocking readiness items", () => {
    const result = deriveNovaScotiaFormPReadiness(
      baseInput({
        lease: {
          startDate: "",
          baseRentCents: null,
          dueDay: null,
          paymentMethod: "",
        },
        tenants: [],
      })
    );

    expect(result.leaseReadiness.overallStatus).toBe("incomplete");
    expect(result.leaseReadiness.blockingItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldKey: "tenant_names" }),
        expect.objectContaining({ fieldKey: "start_date" }),
        expect.objectContaining({ fieldKey: "rent_amount" }),
        expect.objectContaining({ fieldKey: "due_day" }),
        expect.objectContaining({ fieldKey: "payment_method" }),
      ])
    );
  });
});
