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

const app: Application = express();
app.set("etag", false);

/**
 * Middleware
 */
app.use(requestBreadcrumbs);
app.use(
  cors({
    origin: true,
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

// Dev tooling routes should not be blocked by auth
/**
 * Route registration
 */
app.use("/api", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api/auth", routeSource("authRoutes.ts"), authRoutes);

// Decode auth for protected routes
app.use(authenticateJwt);
app.use("/api/ledger-v2", routeSource("ledgerV2Routes.ts"), ledgerV2Routes);

// Core API mounts
app.use("/health", routeSource("healthRoutes.ts"), healthRoutes);
app.get("/api/me", (req, res) => {
  res.setHeader("x-route-source", "app.ts:/api/me");
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

app.use("/api", routeSource("tenantDetailsRoutes.ts"), tenantDetailsRoutes);
app.use("/api", routeSource("paymentsRoutes.ts"), paymentsRoutes);
app.use("/api", routeSource("applicationsRoutes.ts"), applicationsRoutes);
app.use("/api/leases", routeSource("leaseRoutes.ts"), leaseRoutes);
app.use("/api", routeSource("tenantOnboardRoutes.ts"), tenantOnboardRoutes);
app.use("/api/events", routeSource("eventsRoutes.ts"), eventsRoutes);
app.use("/api/dashboard", routeSource("dashboardRoutes.ts"), dashboardRoutes);

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
