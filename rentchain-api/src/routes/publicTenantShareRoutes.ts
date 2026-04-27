import { Router } from "express";
import {
  createTenantShareVerificationRequest,
  readTenantSharePackageByToken,
  requestTenantSharePackageItems,
} from "../services/tenantPortal/tenantSharePackageService";

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

router.post("/share/:token/request", async (req: any, res) => {
  try {
    const token = String(req.params?.token || "").trim();
    if (!token) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const result = await requestTenantSharePackageItems({
      token,
      requestedItems: req.body?.requestedItems,
    });
    if (!result) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    return res.json({ ok: true, data: result });
  } catch (err: any) {
    console.error("[public-tenant-share] request failed", err?.message || err);
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
});

router.post("/share/:token/verification-request", async (req: any, res) => {
  try {
    const token = String(req.params?.token || "").trim();
    if (!token) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const result = await createTenantShareVerificationRequest({
      token,
      requestedScopes: req.body?.requestedScopes,
      requestedByType: "landlord",
    });
    if (!result) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    return res.json({ ok: true, data: result });
  } catch (err: any) {
    console.error("[public-tenant-share] verification request failed", err?.message || err);
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
});

export default router;
