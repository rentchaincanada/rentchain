import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { applyLeaseOverlapCleanup, previewLeaseOverlapCleanup } from "../services/leaseAudit/leaseOverlapCleanupService";
import {
  applyTenantLeasePointerCorrection,
  listTenantLeasePointerConflicts,
  previewTenantLeasePointerCorrection,
} from "../services/leaseAudit/leasePointerCorrectionService";
import { generateLeaseOverlapAuditReport } from "../services/leaseAudit/leaseOverlapAuditService";

const router = Router();

router.get("/admin/lease-overlaps", requireAdmin, async (req: any, res) => {
  try {
    const landlordId = String(req.query?.landlordId || "").trim() || null;
    const propertyId = String(req.query?.propertyId || "").trim() || null;
    const report = await generateLeaseOverlapAuditReport({ landlordId, propertyId });
    return res.json({ ok: true, report });
  } catch (err: any) {
    console.error("[lease overlap admin] load failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "lease_overlap_report_failed" });
  }
});

router.post("/admin/lease-overlaps/preview", requireAdmin, async (req: any, res) => {
  try {
    const preview = await previewLeaseOverlapCleanup({
      landlordId: String(req.body?.landlordId || "").trim(),
      propertyId: String(req.body?.propertyId || "").trim(),
      canonicalLeaseId: String(req.body?.canonicalLeaseId || "").trim(),
      overlapLeaseIds: Array.isArray(req.body?.overlapLeaseIds) ? req.body.overlapLeaseIds : [],
      targetStatus: req.body?.targetStatus,
      dryRun: true,
    });
    return res.json({ ok: true, preview });
  } catch (err: any) {
    console.error("[lease overlap admin] preview failed", err?.message || err);
    return res.status(400).json({ ok: false, error: err?.message || "lease_overlap_preview_failed" });
  }
});

router.post("/admin/lease-overlaps/apply", requireAdmin, async (req: any, res) => {
  try {
    const actorUserId = String(req.user?.id || req.user?.sub || "").trim();
    const result = await applyLeaseOverlapCleanup({
      landlordId: String(req.body?.landlordId || "").trim(),
      propertyId: String(req.body?.propertyId || "").trim(),
      canonicalLeaseId: String(req.body?.canonicalLeaseId || "").trim(),
      overlapLeaseIds: Array.isArray(req.body?.overlapLeaseIds) ? req.body.overlapLeaseIds : [],
      targetStatus: req.body?.targetStatus,
      actorUserId,
      dryRun: false,
    });
    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("[lease overlap admin] apply failed", err?.message || err);
    return res.status(400).json({ ok: false, error: err?.message || "lease_overlap_apply_failed" });
  }
});

router.get("/admin/lease-pointer-conflicts", requireAdmin, async (req: any, res) => {
  try {
    const landlordId = String(req.query?.landlordId || "").trim() || null;
    const propertyId = String(req.query?.propertyId || "").trim() || null;
    const conflicts = await listTenantLeasePointerConflicts({ landlordId, propertyId });
    return res.json({ ok: true, conflicts });
  } catch (err: any) {
    console.error("[lease pointer admin] load failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "lease_pointer_conflict_report_failed" });
  }
});

router.post("/admin/lease-pointer-conflicts/preview", requireAdmin, async (req: any, res) => {
  try {
    const preview = await previewTenantLeasePointerCorrection({
      landlordId: String(req.body?.landlordId || "").trim(),
      propertyId: String(req.body?.propertyId || "").trim(),
      tenantId: String(req.body?.tenantId || "").trim(),
      toCurrentLeaseId: String(req.body?.toCurrentLeaseId || "").trim(),
      dryRun: true,
    });
    return res.json({ ok: true, preview });
  } catch (err: any) {
    console.error("[lease pointer admin] preview failed", err?.message || err);
    return res.status(400).json({ ok: false, error: err?.message || "lease_pointer_preview_failed" });
  }
});

router.post("/admin/lease-pointer-conflicts/apply", requireAdmin, async (req: any, res) => {
  try {
    const actorUserId = String(req.user?.id || req.user?.sub || "").trim();
    const result = await applyTenantLeasePointerCorrection({
      landlordId: String(req.body?.landlordId || "").trim(),
      propertyId: String(req.body?.propertyId || "").trim(),
      tenantId: String(req.body?.tenantId || "").trim(),
      toCurrentLeaseId: String(req.body?.toCurrentLeaseId || "").trim(),
      actorUserId,
    });
    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("[lease pointer admin] apply failed", err?.message || err);
    return res.status(400).json({ ok: false, error: err?.message || "lease_pointer_apply_failed" });
  }
});

export default router;
