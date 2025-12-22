import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

/**
 * GET /api/auth/me
 * Returns the decoded/attached user object for the current session.
 * This should NOT mint tokens, and should NOT touch Firebase.
 */
router.get("/me", requireAuth, (req, res) => {
  return res.json({ ok: true, user: req.user });
});

export default router;
