import {
  BureauProvider,
  BureauProviderPreflight,
  BureauProviderReport,
  BureauProviderRequest,
  BureauProviderRequestResult,
} from "./types";
import { buildTransUnionReferralUrl } from "../transunionReferral";

function hasBaseUrl() {
  return Boolean(String(process.env.TU_REFERRAL_BASE_URL || "").trim());
}

export class TransUnionReferralProvider implements BureauProvider {
  name = "transunion_referral";

  isConfigured() {
    return hasBaseUrl();
  }

  async preflight(): Promise<BureauProviderPreflight> {
    if (!hasBaseUrl()) {
      return { ok: false, detail: "missing_env:TU_REFERRAL_BASE_URL" };
    }
    return { ok: true };
  }

  async createRequest(input: BureauProviderRequest): Promise<BureauProviderRequestResult> {
    const landlordId = String(input.landlordId || "").trim();
    if (!landlordId) {
      throw new Error("missing_landlord_id");
    }
    const redirectUrl = buildTransUnionReferralUrl({
      landlordId,
      applicationId: input.applicationId || null,
      orderId: input.orderId || null,
      returnTo: input.returnTo || null,
      env: process.env.NODE_ENV || "development",
    });
    return {
      requestId: String(input.orderId || `ref_${Date.now()}`),
      redirectUrl,
    };
  }

  async fetchReportPdf(_requestId: string): Promise<BureauProviderReport> {
    throw new Error("external_flow:no_report_pdf");
  }
}

