// rentchain-api/src/routes/tenantDetailsRoutes.ts
import { Router } from "express";
import {
  getTenantsList,
  getTenantDetailBundle,
} from "../services/tenantDetailsService";
import { getTenantLedger } from "../services/tenantLedgerService";
import { generateTenantReportPdfBuffer } from "../services/tenantReportService";

const router = Router();

/**
 * GET /api/tenants
 */
router.get("/tenants", async (_req, res) => {
  try {
    const tenants = await getTenantsList();
    return res.status(200).json(tenants);
  } catch (err: any) {
    console.error("[GET /api/tenants] error:", err);
    return res.status(500).json({
      error: err?.message ?? "Failed to load tenants",
    });
  }
});

/**
 * GET /api/tenants/:tenantId
 */
router.get("/tenants/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    const bundle = await getTenantDetailBundle(tenantId);

    if (!bundle.tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    return res.status(200).json(bundle);
  } catch (err: any) {
    console.error("[GET /api/tenants/:tenantId] error:", err);
    return res.status(500).json({
      error: err?.message ?? "Failed to load tenant detail",
    });
  }
});

/**
 * GET /api/tenants/:tenantId/ledger
 * Returns ledger entries; falls back to synthesizing from payments if empty.
 */
router.get("/tenants/:tenantId/ledger", async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    const ledger = await getTenantLedger(tenantId);
    return res.status(200).json(ledger);
  } catch (err: any) {
    console.error("[GET /api/tenants/:tenantId/ledger] error:", err);
    return res.status(500).json({
      error: err?.message ?? "Failed to load tenant ledger",
    });
  }
});

router.get("/tenants/:tenantId/report", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const buffer = await generateTenantReportPdfBuffer(tenantId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"tenant-report-${tenantId}.pdf\"`
    );
    res.send(buffer);
  } catch (err) {
    const code = (err as any)?.code;
    if (code === "PDF_REPORTING_DEP_MISSING") {
      return res.status(501).json({
        ok: false,
        code: "PDF_REPORTING_DISABLED",
        message: "PDF reporting temporarily unavailable",
      });
    }
    console.error("[GET /tenants/:tenantId/report] error", err);
    res.status(500).json({ error: "Failed to generate tenant report" });
  }
});

export default router;
