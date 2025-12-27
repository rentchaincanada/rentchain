// src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import dashboardRoutes from "./routes/dashboardRoutes";
import tenantDetailsRoutes from "./routes/tenantDetailsRoutes";
import tenantOnboardRoutes from "./routes/tenantOnboardRoutes";
import tenantAiRoutes from "./routes/tenantAiRoutes";

// import other real routes here:
// propertiesRoutes, applicationsRoutes, leasesRoutes, paymentsRoutes, eventsRoutes, etc.

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// health (keep simple)
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "rentchain-api" });
});

// REAL API ROUTES
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tenants", tenantDetailsRoutes);
app.use("/api/tenants", tenantOnboardRoutes);
app.use("/api/tenants", tenantAiRoutes);

// app.use("/api/properties", propertiesRoutes);
// app.use("/api/applications", applicationsRoutes);
// app.use("/api/leases", leasesRoutes);
// app.use("/api/payments", paymentsRoutes);
// app.use("/api/events", eventsRoutes);

export default app;
