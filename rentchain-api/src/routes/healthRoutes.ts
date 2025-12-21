import express from "express";
import { getVersion } from "../version";
import { db } from "../config/firebase";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, service: "rentchain-api" });
});

router.get("/version", (_req, res) => {
  res.json({
    status: "ok",
    service: "rentchain-api",
    version: getVersion(),
    env: process.env.NODE_ENV || "development",
  });
});

router.get("/ready", async (_req, res) => {
  const checks: Record<string, string> = {
    routes: "ok",
  };

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
        message: err?.message || "DB check failed",
      });
    }
  }

  res.json({
    status: "ok",
    service: "rentchain-api",
    checks,
  });
});

// Optional: db detail endpoint; return skipped when not configured
router.get("/db", async (_req, res) => {
  const hasDbCreds = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG);
  if (!hasDbCreds) {
    return res.json({ status: "skipped", message: "No DB credentials configured" });
  }
  try {
    await db.listCollections();
    return res.json({ status: "ok" });
  } catch (err: any) {
    return res.status(503).json({ status: "fail", message: err?.message || "DB check failed" });
  }
});

export default router;
