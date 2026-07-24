import express from "express";
import { getVersion } from "../version";
import { db, initializationState } from "../firebase";
import { safeDiagnosticBuildMetadata } from "../middleware/diagnosticSurfaceGuard";
import { getRuntimeEnvironment, getConfiguredProjectId } from "../config/runtimeEnvironment";

const router = express.Router();

router.get("/", (_req, res) => {
  const firebaseState = initializationState();
  res.json({
    ok: true,
    ...safeDiagnosticBuildMetadata(),
    releaseShaPresent: Boolean(String(process.env.RELEASE_SHA || "").trim()),
    reportingEnabled: process.env.REPORTING_ENABLED === "true",
    reportingDryRun: process.env.REPORTING_DRY_RUN === "true",
    firebaseInitializationMode: firebaseState.mode,
    environment: getRuntimeEnvironment(),
    project: getConfiguredProjectId() || null,
  });
});

router.get("/version", (_req, res) => {
  res.json({
    status: "ok",
    service: "rentchain-api",
    version: getVersion(),
  });
});

router.get("/ready", async (_req, res) => {
  const firebaseState = initializationState();
  const checks: Record<string, string> = {
    routes: "ok",
  };

  if (getRuntimeEnvironment() === "preview" && firebaseState.mode === "preview-disabled") {
    return res.status(503).json({
      status: "fail",
      service: "rentchain-api",
      checks: { routes: "ok", datastore: "deferred" },
      firebaseInitializationMode: firebaseState.mode,
      environment: getRuntimeEnvironment(),
      mode: "foundation",
      message: "Preview datastore is not provisioned; readiness is deferred.",
    });
  }

  const hasDbCreds = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG);
  if (!hasDbCreds) {
    checks.db = "skipped";
  } else {
    try {
      // lightweight ping: list collections (no heavy reads)
      await db.listCollections();
      checks.db = "ok";
    } catch (err: any) {
      checks.db = "fail";
      return res.status(503).json({
        status: "fail",
        service: "rentchain-api",
        checks,
        firebaseInitializationMode: firebaseState.mode,
        message: err?.message || "DB check failed",
      });
    }
  }

  res.json({
    status: "ok",
    service: "rentchain-api",
    checks,
    firebaseInitializationMode: firebaseState.mode,
  });
});

// Optional: db detail endpoint; return skipped when not configured
router.get("/db", async (_req, res) => {
  const firebaseState = initializationState();
  const hasDbCreds = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG);
  if (!hasDbCreds) {
    return res.json({
      status: "skipped",
      firebaseInitializationMode: firebaseState.mode,
      message: "No DB credentials configured",
    });
  }
  try {
    await db.listCollections();
    return res.json({ status: "ok", firebaseInitializationMode: firebaseState.mode });
  } catch (err: any) {
    return res.status(503).json({
      status: "fail",
      firebaseInitializationMode: firebaseState.mode,
      message: err?.message || "DB check failed",
    });
  }
});

export default router;
