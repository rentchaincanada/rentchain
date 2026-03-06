import { Router } from "express";
import { getPublicStatusPayload } from "../services/statusService";

const router = Router();

router.get("/public", async (_req, res) => {
  try {
    const payload = await getPublicStatusPayload();
    return res.json(payload);
  } catch (err: any) {
    console.error("[status/public] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "status_unavailable" });
  }
});

export default router;
