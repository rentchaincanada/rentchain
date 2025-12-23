export interface ReportingConfig {
  enabled: boolean;
  dryRun: boolean;
  allowedProviders: string[];
  maxAttempts: number;
}

export function getReportingConfig(): ReportingConfig {
  return {
    enabled: process.env.REPORTING_ENABLED === "1" || process.env.REPORTING_ENABLED === "true",
    dryRun: process.env.REPORTING_DRY_RUN === "1" || process.env.REPORTING_DRY_RUN === "true",
    allowedProviders: (process.env.REPORTING_ALLOWED_PROVIDERS || "mock")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    maxAttempts: Number(process.env.REPORTING_MAX_ATTEMPTS || 3) || 3,
  };
}
