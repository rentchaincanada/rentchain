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
