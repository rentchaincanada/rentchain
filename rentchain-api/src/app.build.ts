import express from "express";
import cors from "cors";
import { authenticateJwt } from "./middleware/authMiddleware";
import tenantDetailsRoutes from "./routes/tenantDetailsRoutes";
import paymentsRoutes from "./routes/paymentsRoutes";
import applicationsRoutes from "./routes/applicationsRoutes";
import leaseRoutes from "./routes/leaseRoutes";
import tenantOnboardRoutes from "./routes/tenantOnboardRoutes";
import eventsRoutes from "./routes/eventsRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import healthRoutes from "./routes/healthRoutes";
import ledgerV2Routes from "./routes/ledgerV2Routes";
import { routeSource } from "./middleware/routeSource";

export const app = express();
app.set("etag", false);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// Health
app.use("/health", healthRoutes);

// Auth decode (non-blocking if header missing)
app.use(authenticateJwt);
// Ledger V2 (after auth)
app.use("/api/ledger-v2", routeSource("ledgerV2Routes.ts"), ledgerV2Routes);

// Core APIs
app.use("/api", tenantDetailsRoutes);
app.use("/api", paymentsRoutes);
app.use("/api", applicationsRoutes);
app.use("/api/leases", leaseRoutes);
app.use("/api", tenantOnboardRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Fallback health
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/_build", (_req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/_build");
  return res.json({
    ok: true,
    service: process.env.K_SERVICE || null,
    revision: process.env.K_REVISION || null,
    time: new Date().toISOString(),
  });
});
console.log("[BOOT] app.build mounted", { svc: process.env.K_SERVICE, rev: process.env.K_REVISION });
