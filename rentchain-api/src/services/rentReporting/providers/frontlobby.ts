import {
  RentReportingPartner,
  RentReportingPartnerResult,
  RentReportingPartnerEnrollmentRequest,
  RentReportingPartnerMonthlyReportRequest,
} from "./types";

const REQUIRED_ENV = ["FRONTLOBBY_API_KEY", "FRONTLOBBY_BASE_URL"];

function envConfigured(): boolean {
  return REQUIRED_ENV.every((key) => {
    const val = process.env[key];
    return val && val.trim();
  });
}

export class FrontLobbyPartner implements RentReportingPartner {
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
      partnerName: "frontlobby",
      partnerReferenceId: `stub_frontlobby_${req.enrollmentId}`,
      status: "pending",
      message: "FrontLobby enrollment stubbed (sandbox).",
    };
  }

  async reportMonthlyPayment(
    req: RentReportingPartnerMonthlyReportRequest
  ): Promise<RentReportingPartnerResult> {
    this.assertConfigured();
    return {
      partnerName: "frontlobby",
      partnerReferenceId: `stub_frontlobby_${req.enrollmentId}`,
      status: "pending",
      message: "Monthly report stubbed (sandbox).",
    };
  }

  async pause(enrollmentId: string): Promise<RentReportingPartnerResult> {
    this.assertConfigured();
    return {
      partnerName: "frontlobby",
      partnerReferenceId: `stub_frontlobby_${enrollmentId}`,
      status: "pending",
      message: "Pause stubbed (sandbox).",
    };
  }

  async cancel(enrollmentId: string): Promise<RentReportingPartnerResult> {
    this.assertConfigured();
    return {
      partnerName: "frontlobby",
      partnerReferenceId: `stub_frontlobby_${enrollmentId}`,
      status: "pending",
      message: "Cancel stubbed (sandbox).",
    };
  }
}
