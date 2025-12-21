import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { devOnly } from "../middleware/devOnly";
import { getFlags, setFlag } from "../services/featureFlagService";

const router = Router();

router.use(devOnly, authenticateJwt);

router.post("/admin/feature-flags", (req, res) => {
  const { flag, value } = req.body || {};
  if (typeof flag !== "string" || typeof value !== "boolean") {
    return res.status(400).json({ error: "Invalid flag payload" });
  }

  try {
    const updated = setFlag(flag as any, value);
    return res.status(200).json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "Unable to set flag" });
  }
});

router.get("/admin/feature-flags", (_req, res) => {
  return res.status(200).json(getFlags());
});

export default router;
