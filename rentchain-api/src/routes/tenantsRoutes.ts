import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  getTenantDetailBundle,
  getTenantsList,
} from "../services/tenantDetailsService";
import { getTenantLedger } from "../services/tenantLedgerService";
import { generateTenantReportPdfBuffer } from "../services/tenantReportService";

const router = Router();

function getLandlordId(req: any): string | null {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "admin") return null;
  return req.user?.landlordId || req.user?.id || null;
}

router.use(requireLandlord);

/**
 * GET /api/tenants
 * Returns tenants belonging to the authenticated landlord.
 */
router.get("/", async (req: any, res) => {
  const landlordId = getLandlordId(req);

  try {
    const tenants = await getTenantsList({ landlordId: landlordId || undefined });
    return res.status(200).json({ ok: true, tenants });
  } catch (err: any) {
    console.error("[GET /api/tenants] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Failed to load tenants",
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

    const ledger = await getTenantLedger(tenantId);
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

  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId: landlordId || undefined });
    if (!bundle?.tenant) return res.status(404).json({ ok: false, error: "Tenant not found" });

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

export default router;
