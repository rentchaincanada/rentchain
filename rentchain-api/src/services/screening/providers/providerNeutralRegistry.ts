import type { IScreeningProvider } from "../../../types/providerNeutralScreening";

export class ScreeningProviderRegistry {
  private providers = new Map<string, IScreeningProvider>();

  register(providerId: string, provider: IScreeningProvider) {
    const key = normalizeProviderId(providerId);
    if (!key) throw new Error("provider_id_required");
    this.providers.set(key, provider);
  }

  getProvider(providerId: string): IScreeningProvider | null {
    const key = normalizeProviderId(providerId);
    if (!key) return null;
    return this.providers.get(key) || null;
  }

  hasProvider(providerId: string): boolean {
    return Boolean(this.getProvider(providerId));
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

export function normalizeProviderId(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

export const screeningProviderRegistry = new ScreeningProviderRegistry();
