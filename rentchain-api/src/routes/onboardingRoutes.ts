// @ts-nocheck
import express from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { getOrCreateDefault, markStep, updateOnboarding } from "../db/onboardingRepo";

const router = express.Router();

router.get("/", authenticateJwt, async (req, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });
  const data = await updateOnboarding(landlordId, { touchLastSeen: true });
  const lastSeenAt =
    (data as any)?.lastSeenAt?.toDate?.() instanceof Date
      ? (data as any).lastSeenAt.toDate().toISOString()
      : data.lastSeenAt || null;
  res.json({ ok: true, dismissed: !!data.dismissed, steps: data.steps, lastSeenAt });
});

router.patch("/", authenticateJwt, async (req, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });
  const { dismissed, steps } = req.body || {};
  const updated = await updateOnboarding(landlordId, { dismissed, steps });
  const lastSeenAt =
    (updated as any)?.lastSeenAt?.toDate?.() instanceof Date
      ? (updated as any).lastSeenAt.toDate().toISOString()
      : updated.lastSeenAt || null;
  res.json({ ok: true, dismissed: !!updated.dismissed, steps: updated.steps, lastSeenAt });
});

// Backward compatibility for older clients
router.post("/", authenticateJwt, async (req, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });
  const { step, done } = req.body || {};
  const stepMap: Record<string, string> = {
    addProperty: "propertyAdded",
    addUnits: "unitAdded",
    viewDashboard: "applicationCreated",
    screeningStarted: "applicationCreated",
    reportExported: "exportPreviewed",
  };
  const normalizedStep = stepMap[String(step || "")] || step;
  const updated = await markStep(landlordId, normalizedStep, done);
  const lastSeenAt =
    (updated as any)?.lastSeenAt?.toDate?.() instanceof Date
      ? (updated as any).lastSeenAt.toDate().toISOString()
      : updated.lastSeenAt || null;
  res.json({ ok: true, dismissed: !!updated.dismissed, steps: updated.steps, lastSeenAt });
});

export default router;
