// Backend: rentchain-api/src/app.ts
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestBreadcrumbs, getCrumbs } from "./middleware/requestBreadcrumbs";
import { mountSafeRoutes } from "./app.routes";
import { mountDevRoutes } from "./app.routes.dev";
import { mountRouteMap } from "./routes/devRouteMap";
import publicRoutes from "./routes/publicRoutes";
import { requestContext } from "./middleware/requestContext";
import "./types/auth";
import "./types/http";

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
app.use((req, res, next) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  next();
});
app.use("/api", publicRoutes);

// Always mount safe routes
app.use((req, res, next) => {
  res.setHeader("x-route-source", "app.routes.ts");
  next();
});
mountSafeRoutes(app);

// Dev/legacy routes only outside production
if (process.env.NODE_ENV !== "production") {
  mountDevRoutes(app);
  mountRouteMap(app);
}

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
