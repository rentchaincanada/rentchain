import { DropboxSignProvider } from "./dropboxSignProvider";
import { MockSigningProvider } from "./mockSigningProvider";
import { normalizeSigningProviderId, signingProviderRegistry } from "./signingProviderRegistry";
import type { ISigningProvider } from "./types";

signingProviderRegistry.register("mock", new MockSigningProvider());
signingProviderRegistry.register("dropbox_sign", new DropboxSignProvider());

export function getConfiguredSigningProvider(): ISigningProvider {
  const requested = normalizeSigningProviderId(process.env.SIGNING_PROVIDER || "mock") || "mock";
  return signingProviderRegistry.getProvider(requested) || signingProviderRegistry.getProvider("mock")!;
}

export { signingProviderRegistry };
export type * from "./types";
