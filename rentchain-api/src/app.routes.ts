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

export function mountSafeRoutes(app: Application) {
  // ensure auth is decoded and plan is resolved before hitting guarded routes
  app.use(authenticateJwt);
  app.use(attachPlan());
  app.use("/api/auth", authRoutes);
  app.use("/api/auth", authMeRoutes);
  app.use("/api/account", accountRoutes);
  app.use("/api/onboarding", onboardingRoutes);
  app.use("/api/events", eventsRoutes);
  app.use("/api/me", meRoutes);
  app.use("/api/properties", propertiesRoutes);
  app.use("/health", healthRoutes);

  // safe “platform” routes
  app.use("/api/providers", providerStatusRoutes);
  app.use("/api/admin", adminFeatureFlagsRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/billing/upgrade-intent", upgradeIntentRoutes);

  // mount stubs last to backfill missing endpoints only
  app.use("/api", stubPlatformRoutes);

  // minimal ai placeholder router
  app.use("/api/ai", requireCapability("ai.insights"), aiRoutes);
}
