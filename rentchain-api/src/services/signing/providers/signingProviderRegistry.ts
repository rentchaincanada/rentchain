import type { ISigningProvider, SigningProviderId } from "./types";

export class SigningProviderRegistry {
  private providers = new Map<string, ISigningProvider>();

  register(providerId: SigningProviderId, provider: ISigningProvider) {
    const key = normalizeSigningProviderId(providerId);
    if (!key) throw new Error("signing_provider_id_required");
    this.providers.set(key, provider);
  }

  getProvider(providerId: string): ISigningProvider | null {
    const key = normalizeSigningProviderId(providerId);
    if (!key) return null;
    return this.providers.get(key) || null;
  }

  listProviders() {
    return Array.from(this.providers.entries()).map(([providerId, provider]) => ({
      providerId,
      name: provider.getName(),
      configured: provider.isConfigured(),
    }));
  }

  clearForTests() {
    this.providers.clear();
  }
}

export function normalizeSigningProviderId(value: unknown): SigningProviderId | "" {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  if (normalized === "hellosign") return "dropbox_sign";
  if (normalized === "mock" || normalized === "dropbox_sign" || normalized === "boldsign") return normalized;
  return "";
}

export const signingProviderRegistry = new SigningProviderRegistry();
