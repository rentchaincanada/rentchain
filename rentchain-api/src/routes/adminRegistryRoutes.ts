import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import {
  applyRegistryMatchOverride,
  getPropertyRegistryReview,
  getRegistryRecordDetail,
  isRegistryOverrideError,
  listRegistryImports,
  listRegistryReviewQueue,
  listRegistrySources,
  reEvaluatePropertyRegistry,
  runRegistryImport,
  searchRegistryAttachProperties,
} from "../services/registry/registryImportService";

const router = Router();

router.get("/registry/sources", requireAuth, requirePermission("system.admin"), async (_req: any, res) => {
  try {
    const items = await listRegistrySources();
    return res.json({ ok: true, items });
  } catch (error: any) {
    console.error("[adminRegistryRoutes] list sources failed", error);
    return res.status(500).json({ ok: false, error: "registry_sources_failed" });
  }
});

router.get("/registry/imports", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const sourceKey = String(req.query?.sourceKey || "").trim() || null;
    const items = await listRegistryImports(sourceKey as any);
    return res.json({ ok: true, items });
  } catch (error: any) {
    console.error("[adminRegistryRoutes] list imports failed", error);
    return res.status(500).json({ ok: false, error: "registry_imports_failed" });
  }
});

router.get("/registry/properties/search", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const q = String(req.query?.q || "").trim();
    const items = await searchRegistryAttachProperties(q);
    return res.json({ ok: true, items });
  } catch (error: any) {
    console.error("[adminRegistryRoutes] property search failed", error);
    return res.status(500).json({ ok: false, error: "registry_property_search_failed" });
  }
});

router.post("/registry/imports", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const sourceKey = String(req.body?.sourceKey || "").trim() as "halifax_r400";
    const csvText = String(req.body?.csvText || "");
    const sourceFileName = String(req.body?.sourceFileName || "").trim() || null;
    const sourceFileStoragePath = String(req.body?.sourceFileStoragePath || "").trim() || null;
    if (!sourceKey || !csvText.trim()) {
      return res.status(400).json({ ok: false, error: "missing_source_or_csv" });
    }
    const result = await runRegistryImport({
      sourceKey,
      csvText,
      sourceFileName,
      sourceFileStoragePath,
      actorId: String(req.user?.id || req.user?.sub || "").trim() || null,
    });
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[adminRegistryRoutes] import failed", error);
    return res.status(500).json({
      ok: false,
      error: "registry_import_failed",
      message: error?.message || "Registry import failed",
    });
  }
});

router.get("/registry/review", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const sourceKey = String(req.query?.sourceKey || "").trim() || null;
    const matchStatus = String(req.query?.matchStatus || "all").trim() || "all";
    const items = await listRegistryReviewQueue({
      sourceKey: sourceKey as any,
      matchStatus: matchStatus as any,
    });
    return res.json({ ok: true, items });
  } catch (error: any) {
    console.error("[adminRegistryRoutes] review queue failed", error);
    return res.status(500).json({ ok: false, error: "registry_review_failed" });
  }
});

router.get("/registry/records/:normalizedRecordId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const normalizedRecordId = String(req.params?.normalizedRecordId || "").trim();
    if (!normalizedRecordId) return res.status(400).json({ ok: false, error: "missing_record_id" });
    const detail = await getRegistryRecordDetail(normalizedRecordId);
    if (!detail) return res.status(404).json({ ok: false, error: "registry_record_not_found" });
    return res.json({ ok: true, ...detail });
  } catch (error: any) {
    console.error("[adminRegistryRoutes] record detail failed", error);
    return res.status(500).json({ ok: false, error: "registry_record_detail_failed" });
  }
});

router.post(
  "/registry/records/:normalizedRecordId/override",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const normalizedRecordId = String(req.params?.normalizedRecordId || "").trim();
      const action = String(req.body?.action || "").trim() as "attach" | "ignore" | "return_to_review";
      const propertyId = String(req.body?.propertyId || "").trim() || null;
      const reason = String(req.body?.reason || "").trim();
      if (!normalizedRecordId || !action || !reason) {
        return res.status(400).json({ ok: false, error: "missing_override_fields" });
      }
      if (!["attach", "ignore", "return_to_review"].includes(action)) {
        return res.status(400).json({ ok: false, error: "invalid_override_action" });
      }
      const match = await applyRegistryMatchOverride({
        normalizedRecordId,
        action,
        propertyId,
        reason,
        actorId: String(req.user?.id || req.user?.sub || "").trim(),
      });
      return res.json({ ok: true, match });
    } catch (error: any) {
      console.error("[adminRegistryRoutes] override failed", error);
      if (isRegistryOverrideError(error)) {
        return res.status(error.statusCode).json({
          ok: false,
          error: error.code,
          message: error.message,
        });
      }
      return res.status(500).json({
        ok: false,
        error: "registry_override_failed",
        message: error?.message || "Override failed",
      });
    }
  }
);

router.get("/registry/properties/:propertyId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const propertyId = String(req.params?.propertyId || "").trim();
    if (!propertyId) return res.status(400).json({ ok: false, error: "missing_property_id" });
    const normalizedRecordId = String(req.query?.normalizedRecordId || "").trim() || null;
    const result = await getPropertyRegistryReview(propertyId, { normalizedRecordId });
    if (!result) return res.status(404).json({ ok: false, error: "property_not_found" });
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[adminRegistryRoutes] property review failed", error);
    return res.status(500).json({ ok: false, error: "registry_property_review_failed" });
  }
});

router.post(
  "/registry/properties/:propertyId/re-evaluate",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const propertyId = String(req.params?.propertyId || "").trim();
      if (!propertyId) return res.status(400).json({ ok: false, error: "missing_property_id" });
      const result = await reEvaluatePropertyRegistry(
        propertyId,
        String(req.user?.id || req.user?.sub || "").trim()
      );
      return res.json({ ok: true, ...result });
    } catch (error: any) {
      console.error("[adminRegistryRoutes] property re-evaluate failed", error);
      return res.status(500).json({
        ok: false,
        error: "registry_re_evaluate_failed",
        message: error?.message || "Property registry re-evaluation failed",
      });
    }
  }
);

export default router;
