import type { LegacyServices } from "./legacy.types";

function isProd() {
  return process.env.NODE_ENV === "production";
}

function notImplemented(name: string) {
  const err = new Error(`[legacy] ${name} is not available in production (RC-01)`);
  // @ts-ignore
  err.statusCode = 501;
  return err;
}

const prodStubs: LegacyServices = {
  authService: {
    verifyToken: async () => {
      throw notImplemented("authService.verifyToken");
    },
  },
  screeningRequestService: {
    createRequest: async () => {
      throw notImplemented("screeningRequestService.createRequest");
    },
  },
  totpService: {
    verifyTotp: async () => {
      throw notImplemented("totpService.verifyTotp");
    },
  },
};

let cachedDev: LegacyServices | null = null;

/**
 * Always-safe import point for legacy services.
 * - PROD: stubs (never break build)
 * - DEV: dynamically imports real implementations (so legacy code can be messy)
 */
export async function getLegacyServices(): Promise<LegacyServices> {
  if (isProd()) return prodStubs;
  if (cachedDev) return cachedDev;

  const [{ authService }, { screeningRequestService }, { totpService }] = await Promise.all([
    import("../services/dev/authService.dev").catch(() => ({ authService: prodStubs.authService })),
    import("../services/dev/screeningRequestService.dev").catch(() => ({
      screeningRequestService: prodStubs.screeningRequestService,
    })),
    import("../services/dev/totpService.dev").catch(() => ({ totpService: prodStubs.totpService })),
  ]);

  cachedDev = {
    authService: authService ?? prodStubs.authService,
    screeningRequestService: screeningRequestService ?? prodStubs.screeningRequestService,
    totpService: totpService ?? prodStubs.totpService,
  };

  return cachedDev;
}
