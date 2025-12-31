import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authenticateJwt } from "./middleware/authMiddleware";
import { routeSource } from "./middleware/routeSource";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

import publicRoutes from "./routes/publicRoutes";
import authRoutes from "./routes/authRoutes";

import tenantDetailsRoutes from "./routes/tenantDetailsRoutes";
import paymentsRoutes from "./routes/paymentsRoutes";
import applicationsRoutes from "./routes/applicationsRoutes";
import leaseRoutes from "./routes/leaseRoutes";
import tenantOnboardRoutes from "./routes/tenantOnboardRoutes";
import eventsRoutes from "./routes/eventsRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import healthRoutes from "./routes/healthRoutes";
import ledgerV2Routes from "./routes/ledgerV2Routes";
import landlordMicroLiveRoutes from "./routes/landlordMicroLiveRoutes";
import tenantHistoryShareRoutes, {
  publicRouter as tenantHistorySharePublicRouter,
} from "./routes/tenantHistoryShareRoutes";
import propertiesRoutes from "./routes/propertiesRoutes";
import accountRoutes from "./routes/accountRoutes";
import onboardingRoutes from "./routes/onboardingRoutes";
import billingRoutes from "./routes/billingRoutes";
import tenantSignalsRoutes from "./routes/tenantSignalsRoutes";
import reportingRoutes from "./routes/reportingRoutes";
import tenantInvitesRoutes from "./routes/tenantInvitesRoutes";
import tenantPortalRoutes from "./routes/tenantPortalRoutes";
import stubsRoutes from "./routes/stubsRoutes";

export const app = express();
app.set("etag", false);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Redirect accidental double /api/api/... to /api/...
app.use("/api/api", (req, res) => {
  const fixed = "/api" + req.url;
  return res.redirect(307, fixed);
});

// Health
app.use("/health", healthRoutes);

// Public + Auth (MUST be before authenticateJwt)
app.use("/api", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api/public", tenantHistorySharePublicRouter);
app.use("/api/auth", routeSource("authRoutes.ts"), authRoutes);

// Auth decode (non-blocking if header missing)
app.use(authenticateJwt);

// Current user info
app.get("/api/me", (req: any, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/me");
  const hasAuthHeader = Boolean(req.get("authorization"));
  if (!hasAuthHeader) {
    return res.json({ ok: true, user: null });
  }
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  return res.json({ ok: true, user: req.user });
});

// Ledger V2 (after auth decode)
app.use("/api/ledger-v2", routeSource("ledgerV2Routes.ts"), ledgerV2Routes);
app.use("/api/tenant-history", tenantHistoryShareRoutes);
app.use("/api", tenantSignalsRoutes);
app.use("/api/reporting", reportingRoutes);
app.use("/api/tenant-invites", tenantInvitesRoutes);
app.use("/api/tenant", tenantPortalRoutes);
app.use("/api", stubsRoutes);

// Core APIs
app.use("/api", tenantDetailsRoutes);
app.use("/api", paymentsRoutes);
app.use("/api", applicationsRoutes);
app.use("/api/leases", leaseRoutes);
app.use("/api", tenantOnboardRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/landlord", landlordMicroLiveRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/billing", billingRoutes);
app.post("/api/_echo", (req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/_echo");
  return res.json({ ok: true, method: "POST", body: req.body ?? null });
});

// Build stamp
app.get("/api/_build", (_req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/_build");
  return res.json({
    ok: true,
    service: process.env.K_SERVICE || null,
    revision: process.env.K_REVISION || null,
    time: new Date().toISOString(),
  });
});

// Echo for POST reachability
app.post("/api/_echo", (req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/_echo");
  return res.json({
    ok: true,
    method: req.method,
    path: req.path,
    body: req.body ?? null,
  });
});

// JSON 404 + error
app.use(notFoundHandler);
app.use(errorHandler);
