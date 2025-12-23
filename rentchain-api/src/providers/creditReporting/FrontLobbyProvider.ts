import { CreditReportingProvider, ProviderPayload, ProviderSubmitResult } from "./CreditReportingProvider";

export class FrontLobbyProvider implements CreditReportingProvider {
  key(): string {
    return "frontlobby";
  }

  validateConfig(): void {
    throw new Error("FrontLobby provider configuration not implemented yet");
  }

  buildPayload(_input: { records: any[]; meta?: Record<string, any> }): ProviderPayload {
    throw new Error("FrontLobby payload mapping not implemented");
  }

  async submit(_payload: ProviderPayload): Promise<ProviderSubmitResult> {
    throw new Error("FrontLobby submission not implemented");
  }
}
