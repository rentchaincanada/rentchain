import { Router } from "express";
import { db, FieldValue } from "../config/firebase";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  getTenantDetailBundle,
  getTenantsList,
} from "../services/tenantDetailsService";
import { getTenantLedger } from "../services/tenantLedgerService";
import { generateTenantReportPdfBuffer } from "../services/tenantReportService";
import {
  deriveFinancialProjectionRows,
  type FinancialProjectionRow,
} from "../services/financialProjectionService";
import { listTenanciesByTenantId } from "../services/tenanciesService";
import {
  updateMoveInReadinessItems,
} from "../services/tenantMoveInReadinessService";
import { requireCapability } from "../services/capabilityGuard";

const router = Router();

function getLandlordId(req: any): string | null {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "admin") return null;
  return req.user?.landlordId || req.user?.id || null;
}

function compareFinancialProjectionRows(a: FinancialProjectionRow, b: FinancialProjectionRow) {
  const dateDiff = String(b?.occurredAt || "").localeCompare(String(a?.occurredAt || ""));
  if (dateDiff !== 0) return dateDiff;
  const typeDiff = String(a?.sourceType || "").localeCompare(String(b?.sourceType || ""));
  if (typeDiff !== 0) return typeDiff;
  return String(a?.sourceId || "").localeCompare(String(b?.sourceId || ""));
}

router.use(requireLandlord);

/**
 * GET /api/tenants
 * Returns tenants belonging to the authenticated landlord.
 */
router.get("/", async (req: any, res) => {
  const landlordId = getLandlordId(req);

  try {
    const tenants = await getTenantsList({
      landlordId: landlordId || undefined,
      excludeHiddenFromActiveLists: true,
    });
    return res.status(200).json({ ok: true, tenants });
  } catch (err: any) {
    console.error("[GET /api/tenants] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Failed to load tenants",
    });
  }
});

router.patch("/:tenantId", async (req: any, res) => {
  const landlordId = getLandlordId(req);
  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  const fullNameInput = req.body?.fullName;
  const emailInput = req.body?.email;
  const phoneInput = req.body?.phone;
  const hasSupportedField =
    fullNameInput !== undefined || emailInput !== undefined || phoneInput !== undefined;
  if (!hasSupportedField) {
    return res.status(400).json({ ok: false, error: "No supported tenant profile fields provided" });
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (fullNameInput !== undefined) {
    const fullName = String(fullNameInput || "").trim();
    if (!fullName) {
      return res.status(400).json({ ok: false, error: "fullName is required" });
    }
    updates.fullName = fullName.slice(0, 160);
  }

  if (emailInput !== undefined) {
    const email = String(emailInput || "").trim().toLowerCase();
    if (email && !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "email must be valid" });
    }
    updates.email = email || null;
  }

  if (phoneInput !== undefined) {
    const phone = String(phoneInput || "").trim();
    updates.phone = phone || null;
  }

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });
    if (!bundle?.tenant) {
      return res.status(404).json({ ok: false, error: "Tenant not found" });
    }

    await db.collection("tenants").doc(tenantId).set(updates, { merge: true });
    const refreshed = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });

    return res.status(200).json({
      ok: true,
      tenant: refreshed?.tenant ?? bundle.tenant,
    });
  } catch (err: any) {
    console.error("[PATCH /api/tenants/:tenantId] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Failed to update tenant",
    });
  }
});

/**
 * GET /api/tenants/:tenantId
 * Returns tenant bundle (tenant, lease, payments, ledger, insights)
 * after validating landlord ownership.
 */
router.get("/:tenantId", async (req: any, res) => {
  const landlordId = getLandlordId(req);

  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });

    if (!bundle?.tenant) {
      return res.status(404).json({ ok: false, error: "Tenant not found" });
    }

    return res.status(200).json({ ok: true, ...bundle });
  } catch (err: any) {
    console.error("[GET /api/tenants/:tenantId] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Failed to load tenant detail",
    });
  }
});

/**
 * GET /api/tenants/:tenantId/payments
 * Landlord-scoped payments history for a tenant.
 */
router.get("/:tenantId/payments", async (req: any, res) => {
  const landlordId = getLandlordId(req);

  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });
    if (!bundle?.tenant) return res.status(404).json({ ok: false, error: "Tenant not found" });
    return res.json(bundle.payments ?? []);
  } catch (err: any) {
    console.error("[GET /api/tenants/:tenantId/payments] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load tenant payments" });
  }
});

router.get("/:tenantId/financial-activity", async (req: any, res) => {
  const landlordId = getLandlordId(req);
  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId });
    if (!bundle?.tenant) return res.status(404).json({ ok: false, error: "Tenant not found" });

    const projection = await deriveFinancialProjectionRows({ landlordId, tenantId });
    const rows = Array.isArray(projection?.rows)
      ? projection.rows.slice().sort(compareFinancialProjectionRows)
      : [];

    return res.status(200).json({
      ok: true,
      data: { rows },
    });
  } catch (err: any) {
    console.error("[GET /api/tenants/:tenantId/financial-activity] error", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Failed to load tenant financial activity",
    });
  }
});

/**
 * GET /api/tenants/:tenantId/ledger
 * Returns ledger entries; falls back to synthesizing from payments if empty.
 */
router.get("/:tenantId/ledger", async (req: any, res) => {
  const landlordId = getLandlordId(req);

  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });
    if (!bundle?.tenant) return res.status(404).json({ ok: false, error: "Tenant not found" });

    const ledger = Array.isArray((bundle as any).ledger) ? (bundle as any).ledger : await getTenantLedger(tenantId);
    return res.status(200).json(ledger);
  } catch (err: any) {
    console.error("[GET /api/tenants/:tenantId/ledger] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Failed to load tenant ledger",
    });
  }
});

/**
 * GET /api/tenants/:tenantId/report
 * Returns tenant PDF report for landlord-owned tenant.
 */
router.get("/:tenantId/report", async (req: any, res) => {
  const landlordId = getLandlordId(req);
  const role = String(req.user?.role || "").toLowerCase();

  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });
    if (!bundle?.tenant) return res.status(404).json({ ok: false, error: "Tenant not found" });
    if (role !== "admin" && landlordId) {
      const cap = await requireCapability(String(landlordId), "exports_basic", req.user);
      if (!cap.ok) {
        return res.status(402).json({
          ok: false,
          error: "upgrade_required",
          capability: "exports_basic",
          requiredPlan: "pro",
          plan: cap.plan,
          source: "tenant_report_pdf",
        });
      }
    }

    const buffer = await generateTenantReportPdfBuffer(tenantId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"tenant-report-${tenantId}.pdf\"`
    );
    res.send(buffer);
  } catch (err: any) {
    const code = err?.message || err?.code;
    if (code === "PDFKIT_MISSING") {
      return res.status(501).json({
        ok: false,
        code: "PDF_REPORTING_DISABLED",
        message: "PDF reporting is temporarily unavailable on this deployment.",
      });
    }
    console.error("[GET /tenants/:tenantId/report] error", err);
    return res.status(500).json({ ok: false, error: "Failed to generate tenant report" });
  }
});

router.get("/:tenantId/move-in-readiness", async (req: any, res) => {
  const landlordId = getLandlordId(req);
  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });
    if (!bundle?.tenant) return res.status(404).json({ ok: false, error: "Tenant not found" });
    return res.status(200).json({ ok: true, readiness: bundle.moveInReadiness });
  } catch (err: any) {
    console.error("[GET /api/tenants/:tenantId/move-in-readiness] error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "Failed to load move-in readiness" });
  }
});

router.patch("/:tenantId/move-in-readiness", async (req: any, res) => {
  const landlordId = getLandlordId(req);
  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
  if (!updates.length) {
    return res.status(400).json({ ok: false, error: "updates are required" });
  }
  const validKeys = new Set([
    "lease_signed",
    "tenant_portal_invite_sent",
    "tenant_portal_activated",
    "deposit_received",
    "first_rent_received",
    "insurance_received",
    "utility_setup_received",
    "inspection_scheduled",
    "inspection_completed",
    "keys_release_approved",
    "keys_released",
  ]);
  const validStatuses = new Set([
    "not_started",
    "pending",
    "submitted",
    "confirmed",
    "blocked",
    "not_required",
  ]);
  if (
    updates.some(
      (update: any) =>
        !validKeys.has(String(update?.key || "")) || !validStatuses.has(String(update?.status || ""))
    )
  ) {
    return res.status(400).json({ ok: false, error: "INVALID_MOVE_IN_READINESS_UPDATE" });
  }

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });
    if (!bundle?.tenant) return res.status(404).json({ ok: false, error: "Tenant not found" });

    await updateMoveInReadinessItems({
      tenantId,
      landlordId: (bundle.tenant as any)?.landlordId || landlordId || null,
      actorUserId: String(req.user?.id || "").trim() || null,
      actorRole: String(req.user?.role || "").toLowerCase() === "admin" ? "admin" : "landlord",
      updates,
    });

    const refreshed = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });
    return res.status(200).json({ ok: true, readiness: refreshed.moveInReadiness });
  } catch (err: any) {
    console.error("[PATCH /api/tenants/:tenantId/move-in-readiness] error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "Failed to update move-in readiness" });
  }
});

/**
 * GET /api/tenants/:tenantId/tenancies
 * Compatibility alias for tenancy list.
 */
router.get("/:tenantId/tenancies", async (req: any, res) => {
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

router.options("/:tenantId/tenancies", (_req, res) => {
  return res.sendStatus(204);
});

export default router;
