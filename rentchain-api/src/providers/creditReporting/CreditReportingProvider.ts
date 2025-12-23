export interface ProviderPayload {
  providerKey: string;
  records: any[];
  meta?: Record<string, any>;
}

export interface ProviderSubmitResult {
  status: "accepted" | "rejected" | "failed";
  message?: string;
}

export interface CreditReportingProvider {
  key(): string;
  validateConfig(): void;
  buildPayload(input: { records: any[]; meta?: Record<string, any> }): ProviderPayload;
  submit(payload: ProviderPayload): Promise<ProviderSubmitResult>;
}
