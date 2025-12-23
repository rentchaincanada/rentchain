import { CreditReportingProvider, ProviderPayload, ProviderSubmitResult } from "./CreditReportingProvider";

export class SingleKeyProvider implements CreditReportingProvider {
  key(): string {
    return "singlekey";
  }

  validateConfig(): void {
    throw new Error("SingleKey provider configuration not implemented yet");
  }

  buildPayload(_input: { records: any[]; meta?: Record<string, any> }): ProviderPayload {
    throw new Error("SingleKey payload mapping not implemented");
  }

  async submit(_payload: ProviderPayload): Promise<ProviderSubmitResult> {
    throw new Error("SingleKey submission not implemented");
  }
}
