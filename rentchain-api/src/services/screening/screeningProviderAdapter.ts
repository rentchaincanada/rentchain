import type { ScreeningRecordProvider } from "../../types/screening";

export type ScreeningProviderAdapter = {
  provider: ScreeningRecordProvider;
  label: string;
  supportsStoredReports: boolean;
};

const PROVIDERS: Record<ScreeningRecordProvider, ScreeningProviderAdapter> = {
  transunion: {
    provider: "transunion",
    label: "TransUnion",
    supportsStoredReports: true,
  },
  equifax: {
    provider: "equifax",
    label: "Equifax",
    supportsStoredReports: true,
  },
  other: {
    provider: "other",
    label: "Other",
    supportsStoredReports: false,
  },
};

export function normalizeScreeningProvider(value: unknown): ScreeningRecordProvider {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("transunion")) return "transunion";
  if (normalized.includes("equifax")) return "equifax";
  return "other";
}

export function resolveScreeningProviderAdapter(value: unknown): ScreeningProviderAdapter {
  const provider = normalizeScreeningProvider(value);
  return PROVIDERS[provider];
}
