import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  getTenancyById,
  listTenanciesByTenantId,
  updateTenancyLifecycle,
} from "../services/tenanciesService";

const router = Router();

router.use(requireLandlord);

router.get("/tenants/:tenantId/tenancies", async (req: any, res) => {
  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  const role = String(req.user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const landlordId = isAdmin ? null : req.user?.landlordId || req.user?.id || null;

  try {
    const tenancies = await listTenanciesByTenantId(tenantId, { landlordId, isAdmin });
    return res.status(200).json({ ok: true, tenancies });
  } catch (err: any) {
    console.error("[GET /api/tenants/:tenantId/tenancies] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Failed to load tenant tenancies",
    });
  }
});

router.patch("/tenancies/:tenancyId", async (req: any, res) => {
  const tenancyId = String(req.params?.tenancyId || "").trim();
  if (!tenancyId) return res.status(400).json({ ok: false, error: "tenancyId is required" });

  const role = String(req.user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const landlordId = req.user?.landlordId || req.user?.id || null;

  try {
    const tenancy = await getTenancyById(tenancyId);
    if (!tenancy) return res.status(404).json({ ok: false, error: "Tenancy not found" });
    if (!isAdmin && String(tenancy.landlordId || "") !== String(landlordId || "")) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const updated = await updateTenancyLifecycle(tenancyId, {
      moveInAt: req.body?.moveInAt,
      moveOutAt: req.body?.moveOutAt,
      moveOutReason: req.body?.moveOutReason,
      moveOutReasonNote: req.body?.moveOutReasonNote,
      status: req.body?.status,
    });
    return res.status(200).json({ ok: true, tenancy: updated });
  } catch (err: any) {
    const message = String(err?.message || "");
    if (message === "MOVE_OUT_REASON_REQUIRED") {
      return res.status(400).json({ ok: false, error: "moveOutReason is required when moveOutAt is set" });
    }
    if (message === "MOVE_OUT_REASON_NOTE_REQUIRED") {
      return res.status(400).json({ ok: false, error: "moveOutReasonNote is required when moveOutReason is OTHER" });
    }
    if (message === "TENANCY_NOT_FOUND") {
      return res.status(404).json({ ok: false, error: "Tenancy not found" });
    }
    console.error("[PATCH /api/tenancies/:tenancyId] error:", err);
    return res.status(500).json({ ok: false, error: "Failed to update tenancy" });
  }
});

export default router;
