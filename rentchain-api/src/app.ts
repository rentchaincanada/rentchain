// Backend: rentchain-api/src/app.ts
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestBreadcrumbs, getCrumbs } from "./middleware/requestBreadcrumbs";
import publicRoutes from "./routes/publicRoutes";
import { requestContext } from "./middleware/requestContext";
import { routeSource } from "./middleware/routeSource";
import "./types/auth";
import "./types/http";
import { authenticateJwt } from "./middleware/authMiddleware";
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
import tenantSignalsRoutes from "./routes/tenantSignalsRoutes";
import reportingRoutes from "./routes/reportingRoutes";
import capabilitiesRoutes from "./routes/capabilitiesRoutes";
import tenantInvitesRoutes from "./routes/tenantInvitesRoutes";
import tenantPortalRoutes from "./routes/tenantPortalRoutes";
import stubsRoutes from "./routes/stubsRoutes";

const app: Application = express();
app.set("etag", false);

/**
 * Middleware
 */
app.use(requestBreadcrumbs);
app.use(
  cors({
    origin: ["https://www.rentchain.ai", "http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);
app.options("*", cors({ origin: true, credentials: true }));
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      if (req.originalUrl.startsWith("/api/stripe/webhook")) {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
);
app.use(cookieParser());
app.use(requestContext);

// Redirect accidental double /api/api/... to /api/...
app.use("/api/api", (req, res) => {
  const fixed = "/api" + req.url;
  return res.redirect(307, fixed);
});

// Dev tooling routes should not be blocked by auth
/**
 * Route registration
 */
app.use("/api", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api/public", tenantHistorySharePublicRouter);
app.use("/api/auth", authRoutes);
app.use("/api/capabilities", routeSource("capabilitiesRoutes.ts"), capabilitiesRoutes);

// Decode auth for protected routes
app.use(authenticateJwt);
console.log("[BOOT] mounting /api/ledger-v2 (after auth)");
app.use("/api/ledger-v2", routeSource("ledgerV2Routes.ts"), ledgerV2Routes);
app.use("/api/tenant-history", tenantHistoryShareRoutes);
app.use("/api", tenantSignalsRoutes);
app.use("/api/reporting", reportingRoutes);
app.use("/api/tenant-invites", tenantInvitesRoutes);
app.use("/api/tenant", tenantPortalRoutes);
app.use("/api", stubsRoutes);

// Core API mounts
app.use("/health", routeSource("healthRoutes.ts"), healthRoutes);
app.get("/api/me", (req, res) => {
  res.setHeader("x-route-source", "app.ts:/api/me");
  const hasAuthHeader = Boolean(req.get("authorization"));
  if (!hasAuthHeader) {
    return res.json({ ok: true, user: null });
  }
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  return res.json({ ok: true, user: req.user });
});
app.get("/api/_build", (req, res) => {
  res.setHeader("x-route-source", "app.ts:/api/_build");
  return res.json({
    ok: true,
    service: process.env.K_SERVICE || null,
    revision: process.env.K_REVISION || null,
    time: new Date().toISOString(),
  });
});

app.use("/api", tenantDetailsRoutes);
app.use("/api", paymentsRoutes);
app.use("/api", applicationsRoutes);
app.use("/api/leases", leaseRoutes);
app.use("/api", tenantOnboardRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/landlord", landlordMicroLiveRoutes);

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  console.error("[breadcrumbs]", JSON.stringify(getCrumbs(), null, 2));
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  console.error("[breadcrumbs]", JSON.stringify(getCrumbs(), null, 2));
});

/**
 * Simple 404 handler
 */
app.use(notFoundHandler);

/**
 * Generic error handler
 */
app.use(errorHandler);

export default app;
// src/app.build.ts
// build stamp: 2025-12-29TXX:YY
// build stamp: 2025-12-29TXX:YY
