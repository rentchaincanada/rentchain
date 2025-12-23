import { CreditReportingProvider } from "../../providers/creditReporting/CreditReportingProvider";
import { MockCreditReportingProvider } from "../../providers/creditReporting/MockProvider";
import { SingleKeyProvider } from "../../providers/creditReporting/SingleKeyProvider";
import { FrontLobbyProvider } from "../../providers/creditReporting/FrontLobbyProvider";

export function getProvider(key: string): CreditReportingProvider {
  switch (key) {
    case "singlekey":
      return new SingleKeyProvider();
    case "frontlobby":
      return new FrontLobbyProvider();
    case "mock":
    default:
      return new MockCreditReportingProvider();
  }
}
