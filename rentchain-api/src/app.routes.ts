import { Application } from "express";

import authRoutes from "./routes/authRoutes";
import accountRoutes from "./routes/accountRoutes";
import onboardingRoutes from "./routes/onboardingRoutes";
import eventsRoutes from "./routes/eventsRoutes";
import meRoutes from "./routes/meRoutes";
import healthRoutes from "./routes/healthRoutes";
import billingRoutes from "./routes/billingRoutes";
import providerStatusRoutes from "./routes/providerStatusRoutes";
import adminFeatureFlagsRoutes from "./routes/adminFeatureFlagsRoutes";
import upgradeIntentRoutes from "./routes/upgradeIntentRoutes";
import aiRoutes from "./routes/ai";
import { attachPlan } from "./entitlements/planResolver.middleware";
import { requireCapability } from "./entitlements/entitlements.middleware";
import stubPlatformRoutes from "./routes/stubPlatformRoutes";
import { authenticateJwt } from "./middleware/authMiddleware";
import propertiesRoutes from "./routes/propertiesRoutes";
import authMeRoutes from "./routes/authMeRoutes";
import { routeSource } from "./middleware/routeSource";

export function mountSafeRoutes(app: Application) {
  // ensure auth is decoded and plan is resolved before hitting guarded routes
  app.use(authenticateJwt);
  app.use(attachPlan());
  app.use("/api/auth", routeSource("authRoutes.ts"), authRoutes);
  app.use("/api/auth", routeSource("authMeRoutes.ts"), authMeRoutes);
  app.use("/api/account", routeSource("accountRoutes.ts"), accountRoutes);
  app.use("/api/onboarding", routeSource("onboardingRoutes.ts"), onboardingRoutes);
  app.use("/api/events", routeSource("eventsRoutes.ts"), eventsRoutes);
  app.use("/api/me", routeSource("meRoutes.ts"), meRoutes);
  app.use("/api/properties", routeSource("propertiesRoutes.ts"), propertiesRoutes);
  app.use("/health", routeSource("healthRoutes.ts"), healthRoutes);

  // safe “platform” routes
  app.use("/api/providers", routeSource("providerStatusRoutes.ts"), providerStatusRoutes);
  app.use("/api/admin", routeSource("adminFeatureFlagsRoutes.ts"), adminFeatureFlagsRoutes);
  app.use("/api/billing", routeSource("billingRoutes.ts"), billingRoutes);
  app.use(
    "/api/billing/upgrade-intent",
    routeSource("upgradeIntentRoutes.ts"),
    upgradeIntentRoutes
  );

  // mount stubs last to backfill missing endpoints only
  app.use("/api", routeSource("stubPlatformRoutes.ts"), stubPlatformRoutes);

  // minimal ai placeholder router
  app.use("/api/ai", routeSource("aiRoutes.ts"), requireCapability("ai.insights"), aiRoutes);
}
