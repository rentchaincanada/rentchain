import { getFlags } from "../featureFlagService";
import { getLastProviderErrorAt } from "../screeningRequestService";

function envValue(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() ? value : undefined;
}

function requiredFor(provider: string): string[] {
  if (provider === "singlekey") {
    return ["SINGLEKEY_BASE_URL", "SINGLEKEY_API_KEY"];
  }
  if (provider === "providera") {
    return ["PROVIDER_A_API_KEY", "PROVIDER_A_BASE_URL"];
  }
  return [];
}

function missingEnv(keys: string[]): string[] {
  return keys.filter((key) => !envValue(key));
}

export function getProviderStatus(): {
  activeProvider: string;
  configured: boolean;
  requiredEnvMissing?: string[];
  lastErrorAt?: string;
} {
  const flags = getFlags();
  const activeProvider =
    flags.useSingleKeyForNewScreenings === true
      ? "singlekey"
      : (process.env.CREDIT_PROVIDER || "mock").toLowerCase();

  const required = requiredFor(activeProvider);
  const missing = missingEnv(required);
  const lastErrorAt = getLastProviderErrorAt();

  return {
    activeProvider,
    configured: missing.length === 0,
    requiredEnvMissing: missing.length ? missing : undefined,
    lastErrorAt: lastErrorAt || undefined,
  };
}
