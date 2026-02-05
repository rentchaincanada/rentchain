export type ScreeningProvider = "manual" | "mock" | "provider_x";

export type ScreeningProviderStatus = "processing" | "complete" | "failed";

export type ScreeningResultSummary = {
  overall: "pass" | "review" | "fail" | "unknown";
  scoreBand?: "A" | "B" | "C" | "D" | "E";
  flags?: string[];
  updatedAt?: number;
};

export interface ScreeningProviderAdapter {
  start: (application: any) => Promise<{ providerRef?: string }>;
  getStatus: (
    providerRef: string
  ) => Promise<{
    status: ScreeningProviderStatus;
    summary?: ScreeningResultSummary;
    reportUrl?: string;
    failure?: { code: string; detail?: string };
  }>;
}

export type BureauProviderPreflight = {
  ok: boolean;
  detail?: string;
};

export type BureauProviderRequest = {
  orderId: string;
  tenant: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    dateOfBirth?: string | null;
  };
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  consent: {
    name: string;
    consentedAt: number;
    ip?: string | null;
    userAgent?: string | null;
  };
  returnUrl?: string | null;
};

export type BureauProviderRequestResult = {
  requestId: string;
  redirectUrl?: string | null;
};

export type BureauProviderReport = {
  pdfBuffer: Buffer;
  contentType: "application/pdf";
};

export interface BureauProvider {
  name: string;
  isConfigured: () => boolean;
  preflight: () => Promise<BureauProviderPreflight>;
  createRequest: (input: BureauProviderRequest) => Promise<BureauProviderRequestResult>;
  fetchReportPdf: (requestId: string) => Promise<BureauProviderReport>;
}
