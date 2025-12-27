// @ts-nocheck
import express from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { getOrCreateDefault, markStep } from "../db/onboardingRepo";

const router = express.Router();

router.get("/", authenticateJwt, async (req: AuthenticatedRequest, res) => {
  const landlordId = req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });
  const state = await getOrCreateDefault(landlordId);
  res.json(state);
});

router.post("/", authenticateJwt, async (req: AuthenticatedRequest, res) => {
  const landlordId = req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

  const { step, done } = req.body as { step: string; done: boolean };
  const state = await getOrCreateDefault(landlordId);
  if (!state.steps.hasOwnProperty(step)) {
    return res.status(400).json({ error: "Unknown step" });
  }

  const updated = await markStep(landlordId, step as keyof typeof state.steps, !!done);
  res.json(updated);
});

export default router;
