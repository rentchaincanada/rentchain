import { CreditReportingProvider, ProviderPayload, ProviderSubmitResult } from "./CreditReportingProvider";

export class MockCreditReportingProvider implements CreditReportingProvider {
  key(): string {
    return "mock";
  }

  validateConfig(): void {
    // Nothing required for mock
  }

  buildPayload(input: { records: any[]; meta?: Record<string, any> }): ProviderPayload {
    return {
      providerKey: this.key(),
      records: input.records,
      meta: input.meta,
    };
  }

  async submit(_payload: ProviderPayload): Promise<ProviderSubmitResult> {
    return { status: "accepted", message: "Mock provider accepted (dry)" };
  }
}
