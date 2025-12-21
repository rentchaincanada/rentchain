import { CreditProvider } from "./providerTypes";
import { MockCreditProvider } from "./mockProvider";
import { ProviderA, ProviderNotConfiguredError } from "./providerA";
import { SingleKeyProvider } from "./singleKeyProvider";

type ProviderKey = "mock" | "providerA" | "providerB" | "singlekey";

export function getCreditProvider(
  providerOverride?: string
): CreditProvider {
  const providerKey = (providerOverride || process.env.CREDIT_PROVIDER || "mock").toLowerCase();

  if (providerKey === "singlekey") {
    return new SingleKeyProvider();
  }
  if (providerKey === "providera") {
    return new ProviderA();
  }

  // Placeholder for future providers
  if (providerKey === "providerb") {
    return new MockCreditProvider();
  }

  return new MockCreditProvider();
}

export { ProviderNotConfiguredError };
