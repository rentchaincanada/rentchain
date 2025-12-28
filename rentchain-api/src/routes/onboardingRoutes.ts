// @ts-nocheck
import express from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { getOrCreateDefault, markStep } from "../db/onboardingRepo";

const router = express.Router();

router.get("/", authenticateJwt, async (req, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });
  const data = await getOrCreateDefault(landlordId);
  res.json(data);
});

router.post("/", authenticateJwt, async (req, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });
  const { step, done } = req.body || {};
  const updated = await markStep(landlordId, step, done);
  res.json(updated);
});

export default router;
