export type RentReportingPartnerName =
  | "frontlobby"
  | "landlord_credit_bureau";

export interface RentReportingPartnerEnrollmentRequest {
  enrollmentId: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone?: string;
  propertyAddress: string;
  unit: string;
  leaseStartDate: string;
  consentedAt: string;
}

export interface RentReportingPartnerMonthlyReportRequest {
  enrollmentId: string;
  periodYYYYMM: string;
  amountPaid: number;
  paidAt: string;
  method?: string;
}

export interface RentReportingPartnerResult {
  partnerName: RentReportingPartnerName;
  partnerReferenceId: string;
  status: "accepted" | "rejected" | "pending";
  message: string;
}

export interface RentReportingPartner {
  enroll(
    req: RentReportingPartnerEnrollmentRequest
  ): Promise<RentReportingPartnerResult>;
  reportMonthlyPayment(
    req: RentReportingPartnerMonthlyReportRequest
  ): Promise<RentReportingPartnerResult>;
  pause(enrollmentId: string): Promise<RentReportingPartnerResult>;
  cancel(enrollmentId: string): Promise<RentReportingPartnerResult>;
}
