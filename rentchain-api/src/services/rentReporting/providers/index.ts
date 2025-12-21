import {
  RentReportingPartner,
  RentReportingPartnerName,
} from "./types";
import { FrontLobbyPartner } from "./frontlobby";
import { LandlordCreditBureauPartner } from "./landlordCreditBureau";

function partnerKey(): RentReportingPartnerName {
  const env = (process.env.RENT_REPORTING_PARTNER || "frontlobby").toLowerCase();
  if (env === "landlord_credit_bureau") return "landlord_credit_bureau";
  return "frontlobby";
}

export function getRentReportingPartner(): RentReportingPartner {
  const key = partnerKey();
  if (key === "landlord_credit_bureau") {
    return new LandlordCreditBureauPartner();
  }
  return new FrontLobbyPartner();
}
