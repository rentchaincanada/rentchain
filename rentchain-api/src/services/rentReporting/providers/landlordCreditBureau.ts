import {
  RentReportingPartner,
  RentReportingPartnerEnrollmentRequest,
  RentReportingPartnerMonthlyReportRequest,
  RentReportingPartnerResult,
} from "./types";

const REQUIRED_ENV = ["LCB_API_KEY", "LCB_BASE_URL"];

function envConfigured(): boolean {
  return REQUIRED_ENV.every((key) => {
    const val = process.env[key];
    return val && val.trim();
  });
}

export class LandlordCreditBureauPartner implements RentReportingPartner {
  private assertConfigured() {
    if (!envConfigured()) {
      const error: any = new Error("partner_not_configured");
      error.code = "partner_not_configured";
      throw error;
    }
  }

  async enroll(
    req: RentReportingPartnerEnrollmentRequest
  ): Promise<RentReportingPartnerResult> {
    this.assertConfigured();
    return {
      partnerName: "landlord_credit_bureau",
      partnerReferenceId: `stub_lcb_${req.enrollmentId}`,
      status: "pending",
      message: "Landlord Credit Bureau enrollment stubbed (sandbox).",
    };
  }

  async reportMonthlyPayment(
    req: RentReportingPartnerMonthlyReportRequest
  ): Promise<RentReportingPartnerResult> {
    this.assertConfigured();
    return {
      partnerName: "landlord_credit_bureau",
      partnerReferenceId: `stub_lcb_${req.enrollmentId}`,
      status: "pending",
      message: "Monthly report stubbed (sandbox).",
    };
  }

  async pause(enrollmentId: string): Promise<RentReportingPartnerResult> {
    this.assertConfigured();
    return {
      partnerName: "landlord_credit_bureau",
      partnerReferenceId: `stub_lcb_${enrollmentId}`,
      status: "pending",
      message: "Pause stubbed (sandbox).",
    };
  }

  async cancel(enrollmentId: string): Promise<RentReportingPartnerResult> {
    this.assertConfigured();
    return {
      partnerName: "landlord_credit_bureau",
      partnerReferenceId: `stub_lcb_${enrollmentId}`,
      status: "pending",
      message: "Cancel stubbed (sandbox).",
    };
  }
}
