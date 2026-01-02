import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { db } from "../config/firebase";
import { getTenantCreditHistory } from "../services/tenantCreditProfileService";

const router = Router();

router.use(requireRole("landlord"));

async function verifyTenantOwnership(tenantId: string, landlordId: string): Promise<boolean> {
  try {
    const doc = await db.collection("tenants").doc(tenantId).get();
    if (!doc.exists) return true; // best-effort if legacy data
    const data = doc.data() as any;
    if (data?.landlordId && data.landlordId !== landlordId) return false;
    return true;
  } catch {
    return true;
  }
}

router.get("/tenants/:tenantId/credit-history", async (req: any, res) => {
  const tenantId = req.params.tenantId;
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

  const allowed = await verifyTenantOwnership(tenantId, landlordId);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  try {
    const history = await getTenantCreditHistory({ tenantId, landlordId });
    return res.json(history);
  } catch (err) {
    console.error("[landlordCreditHistoryRoutes] credit-history error", err);
    return res.status(500).json({ error: "Failed to generate credit history" });
  }
});

router.get("/tenants/:tenantId/credit-history/export", async (req: any, res) => {
  const tenantId = req.params.tenantId;
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

  const allowed = await verifyTenantOwnership(tenantId, landlordId);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  const format = ((req.query.format as string) || "json").toLowerCase();

  if (format !== "json" && format !== "csv") {
    return res.status(400).json({ ok: false, code: "BAD_FORMAT", message: "format must be json or csv" });
  }

  try {
    const history = await getTenantCreditHistory({ tenantId, landlordId });
    if (format === "csv") {
      const headers = [
        "schemaVersion",
        "source",
        "generatedAt",
        "tenantId",
        "leaseId",
        "period",
        "rentAmount",
        "dueDate",
        "amountPaid",
        "paidAt",
        "daysLate",
        "status",
      ];
      const rows = history.periods.map((p) => [
        history.schemaVersion,
        history.source,
        history.generatedAt,
        history.tenantId,
        history.leaseId ?? "",
        p.period,
        p.rentAmount ?? "",
        p.dueDate ?? "",
        p.amountPaid ?? "",
        p.paidAt ?? "",
        p.daysLate ?? "",
        p.status,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join(
        "\n"
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="credit-history-${tenantId}.csv"`);
      return res.send(csv);
    }
    res.setHeader("Content-Type", "application/json");
    return res.json(history);
  } catch (err) {
    console.error("[landlordCreditHistoryRoutes] export error", err);
    return res
      .status(501)
      .json({ ok: false, code: "CREDIT_HISTORY_DISABLED", message: "Credit history export is coming soon." });
  }
});

export default router;
