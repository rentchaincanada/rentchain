import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import {
  createAdminSavedFilter,
  deleteAdminSavedFilter,
  isAdminSavedFilterPageKey,
  listAdminSavedFilters,
} from "../services/admin/adminSavedFilters";

const router = Router();

router.get("/saved-filters", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  const userId = String(req.user?.id || req.user?.sub || "").trim();
  const pageKey = String(req.query?.pageKey || "").trim();
  if (!isAdminSavedFilterPageKey(pageKey)) {
    return res.status(400).json({ ok: false, error: "invalid_page_key" });
  }

  try {
    const items = await listAdminSavedFilters({ userId, pageKey });
    console.info("[admin.savedFilters]", {
      route: "/api/admin/saved-filters",
      userId,
      role: String(req.user?.role || "").toLowerCase(),
      adminAccessResolved: true,
      action: "list",
      pageKey,
      success: true,
      count: items.length,
    });
    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[adminSavedFiltersRoutes] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "admin_saved_filters_list_failed" });
  }
});

router.post("/saved-filters", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  const userId = String(req.user?.id || req.user?.sub || "").trim();
  const pageKey = String(req.body?.pageKey || "").trim();
  if (!isAdminSavedFilterPageKey(pageKey)) {
    return res.status(400).json({ ok: false, error: "invalid_page_key" });
  }

  try {
    const item = await createAdminSavedFilter({
      userId,
      pageKey,
      name: req.body?.name,
      filters: req.body?.filters || {},
    });
    console.info("[admin.savedFilters]", {
      route: "/api/admin/saved-filters",
      userId,
      role: String(req.user?.role || "").toLowerCase(),
      adminAccessResolved: true,
      action: "create",
      pageKey,
      presetId: item.id,
      success: true,
    });
    return res.status(201).json({ ok: true, item });
  } catch (err: any) {
    const message = String(err?.message || "");
    console.error("[adminSavedFiltersRoutes] create failed", message || err);
    const status = /invalid|required|unsupported|too long|too many/.test(message) ? 400 : 500;
    return res.status(status).json({ ok: false, error: "admin_saved_filters_create_failed", message });
  }
});

router.delete("/saved-filters/:id", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  const userId = String(req.user?.id || req.user?.sub || "").trim();
  const presetId = String(req.params?.id || "").trim();
  if (!presetId) {
    return res.status(400).json({ ok: false, error: "missing_preset_id" });
  }

  try {
    await deleteAdminSavedFilter({ userId, id: presetId });
    console.info("[admin.savedFilters]", {
      route: "/api/admin/saved-filters/:id",
      userId,
      role: String(req.user?.role || "").toLowerCase(),
      adminAccessResolved: true,
      action: "delete",
      presetId,
      success: true,
    });
    return res.json({ ok: true });
  } catch (err: any) {
    const message = String(err?.message || "");
    console.error("[adminSavedFiltersRoutes] delete failed", message || err);
    const status = message === "preset not found" ? 404 : 500;
    return res.status(status).json({ ok: false, error: "admin_saved_filters_delete_failed", message });
  }
});

export default router;
