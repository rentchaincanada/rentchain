import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();

router.get("/me", authenticateJwt, (req, res) => {
  res.json({ user: (req as any).user ?? null });
});

export default router;
