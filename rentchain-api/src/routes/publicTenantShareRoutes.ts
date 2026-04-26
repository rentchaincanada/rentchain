import { Router } from "express";
import { readTenantSharePackageByToken } from "../services/tenantPortal/tenantSharePackageService";

const router = Router();

router.get("/share/:token", async (req: any, res) => {
  try {
    const token = String(req.params?.token || "").trim();
    if (!token) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const payload = await readTenantSharePackageByToken(token);
    if (!payload) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    return res.json({ ok: true, data: payload });
  } catch (err: any) {
    console.error("[public-tenant-share] fetch failed", err?.message || err);
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
});

export default router;
