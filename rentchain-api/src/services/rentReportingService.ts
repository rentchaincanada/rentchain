// RentChain Credit Builder scaffolding (Phase 1, no bureau integration yet).
// Future integration points: opt-in consent, positive-only furnishing, monthly cycles.
import { v4 as uuid } from "uuid";
import { RentReportingEnrollment } from "../types/rentReporting";
import { getRentReportingPartner } from "./rentReporting/providers";
import { RentReportingPartnerEnrollmentRequest } from "./rentReporting/providers/types";

const ENROLLMENTS: RentReportingEnrollment[] = [];

export function enrollTenant(params: {
  tenantId: string;
  applicationId?: string;
  propertyId: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone?: string;
  unit: string;
  leaseStartDate: string;
  consentedAt: string;
}): RentReportingEnrollment {
  const enrollment: RentReportingEnrollment = {
    id: uuid(),
    tenantId: params.tenantId,
    applicationId: params.applicationId,
    propertyId: params.propertyId,
    status: "pending",
    rentReportingConsent: true,
    rentReportingConsentedAt: params.consentedAt,
    consentedAt: params.consentedAt,
    reportingPartner: "tbd",
    createdAt: new Date().toISOString(),
  };

  try {
    const partner = getRentReportingPartner();
    const payload: RentReportingPartnerEnrollmentRequest = {
      enrollmentId: enrollment.id,
      tenantId: params.tenantId,
      tenantName: params.tenantName,
      tenantEmail: params.tenantEmail,
      tenantPhone: params.tenantPhone,
      propertyAddress: params.propertyId,
      unit: params.unit,
      leaseStartDate: params.leaseStartDate,
      consentedAt: params.consentedAt,
    };
    partner
      .enroll(payload)
      .then((result) => {
        enrollment.reportingPartner = result.partnerName === "frontlobby"
          ? "equifax_partner"
          : "tbd";
        enrollment.status = result.status === "accepted" ? "active" : "pending";
      })
      .catch(() => {
        // keep pending if partner is not configured or fails (stub).
      });
  } catch (err) {
    // keep pending on partner_not_configured
  }

  ENROLLMENTS.push(enrollment);
  return enrollment;
}

export function pauseEnrollment(): RentReportingEnrollment {
  throw new Error("Not implemented: pauseEnrollment");
}

export function cancelEnrollment(): RentReportingEnrollment {
  throw new Error("Not implemented: cancelEnrollment");
}

export function listEnrollments(): RentReportingEnrollment[] {
  return [...ENROLLMENTS];
}

export function recordMonthlyPaymentStub(): void {
  throw new Error("Not implemented: recordMonthlyPaymentStub");
}
