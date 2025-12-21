// RentChain Credit Builder (rent reporting) data model scaffold.
// Phase 1: positive-only reporting, separate from screening.
export type RentReportingStatus =
  | "pending"
  | "active"
  | "paused"
  | "cancelled";

export interface RentReportingEnrollment {
  id: string;
  tenantId: string;
  applicationId?: string;
  propertyId: string;
  status: RentReportingStatus;
  rentReportingConsent: boolean;
  rentReportingConsentedAt?: string;
  consentedAt: string;
  startedAt?: string;
  cancelledAt?: string;
  reportingPartner: "equifax_partner" | "tbd";
  lastReportedPeriod?: string;
  createdAt: string;
}
