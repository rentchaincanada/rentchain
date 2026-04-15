import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { listFinancialTransactions } from "../services/financialTransactionService";

const router = Router();

function asString(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

function normalizeRole(req: any): "admin" | "landlord" | "other" {
  const role = asString(req.user?.actorRole || req.user?.role, 40).toLowerCase();
  if (role === "admin") return "admin";
  if (role === "landlord") return "landlord";
  return "other";
}

function landlordIdFromReq(req: any): string {
  return asString(req.user?.landlordId || req.user?.id, 120);
}

router.get("/financial-transactions", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "admin" && role !== "landlord") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const landlordId =
      role === "admin" ? asString(req.query?.landlordId, 120) || landlordIdFromReq(req) : landlordIdFromReq(req);
    if (!landlordId) {
      return res.status(400).json({ ok: false, error: "LANDLORD_REQUIRED" });
    }

    const items = await listFinancialTransactions({
      landlordId,
      propertyId: asString(req.query?.propertyId, 120) || null,
      workOrderId: asString(req.query?.workOrderId, 120) || null,
    });
    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[financial-transactions] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "FINANCIAL_TRANSACTION_LIST_FAILED" });
  }
});

export default router;
