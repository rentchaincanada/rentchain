import { describe, expect, it } from "vitest";
import { ScreeningProviderRegistry } from "../../../services/screening/providers/providerNeutralRegistry";
import type { IScreeningProvider } from "../../../types/providerNeutralScreening";

const provider: IScreeningProvider = {
  getName: () => "Test Provider",
  isConfigured: () => true,
  initiateScreening: async () => ({ providerRequestRef: "provider_ref" }),
  verifyWebhookSignature: async () => true,
  parseWebhookPayload: async (input: any) => ({
    requestId: String(input.requestId || ""),
    status: "completed",
    summary: "completed",
  }),
  getScreeningResult: async () => ({ status: "completed", summary: "completed", flags: [] }),
};

describe("ScreeningProviderRegistry", () => {
  it("starts empty and reports missing providers", () => {
    const registry = new ScreeningProviderRegistry();
    expect(registry.listProviders()).toEqual([]);
    expect(registry.getProvider("missing")).toBeNull();
  });

  it("registers and retrieves providers by normalized id", () => {
    const registry = new ScreeningProviderRegistry();
    registry.register("Test_Provider", provider);
    expect(registry.hasProvider("test_provider")).toBe(true);
    expect(registry.getProvider("test_provider")?.getName()).toBe("Test Provider");
    expect(registry.listProviders()).toEqual([
      { providerId: "test_provider", name: "Test Provider", configured: true },
    ]);
  });
});
