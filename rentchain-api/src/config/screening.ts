import { screeningProviderRegistry } from "../services/screening/providers/providerNeutralRegistry";

export function initializeScreeningProviderRegistry() {
  return screeningProviderRegistry;
}

export { screeningProviderRegistry };
