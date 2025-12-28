// rentchain-api/src/routes/meRoutes.ts
import { Router, Response } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();

router.get("/me", authenticateJwt, (req, res: Response) => {
  res.setHeader("x-route-source", "meRoutes.ts");
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  return res.json({ ok: true, user: req.user ?? null });
});

export default router;
