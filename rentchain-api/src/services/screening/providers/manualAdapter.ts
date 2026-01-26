import type { ScreeningProviderAdapter } from "./types";

export const manualAdapter: ScreeningProviderAdapter = {
  start: async (application: any) => {
    const applicationId = String(application?.id || application?.applicationId || "");
    return { providerRef: `manual:${applicationId || "unknown"}` };
  },
  getStatus: async () => {
    return { status: "processing" };
  },
};
