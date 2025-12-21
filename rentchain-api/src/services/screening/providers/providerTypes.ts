export interface CreditProviderRequest {
  applicationId: string;
  applicant: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
  };
  contact: {
    email: string;
    phone: string;
  };
  address: {
    streetNumber: string;
    streetName: string;
    city: string;
    province: string;
    postalCode: string;
    country: "Canada";
  };
  tenancy: {
    propertyName?: string;
    propertyAddressLine1?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    unitApplied: string;
    leaseStartDate: string;
  };
  consent: {
    creditCheck: true;
    consentedAt?: string | null;
  };
  sinLast4?: string | null;
}

export interface CreditProviderResult {
  providerName: string;
  providerReferenceId: string;
  score?: number;
  riskBand?: string;
  highlights: string[];
  summaryText: string;
  rawPayload: Record<string, any>;
  generatedAt: string;
}

export interface CreditProvider {
  createReport(request: CreditProviderRequest): Promise<CreditProviderResult>;
}
