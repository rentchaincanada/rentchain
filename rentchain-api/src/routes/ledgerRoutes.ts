// rentchain-api/src/routes/ledgerRoutes.ts
import { Router } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  getLedgerEventsByTenant,
  getLedgerSummaryForTenant,
  toLedgerEntries,
  listAllEvents,
} from "../services/ledgerEventsService";
import { getTenantsList, getTenantDetailBundle } from "../services/tenantDetailsService";

const router = Router();

// GET /api/ledger?tenantId=...
router.get("/ledger", async (req: AuthenticatedRequest, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const tenantId = req.query.tenantId ? String(req.query.tenantId) : null;
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : null;
  const limit = req.query.limit ? Number(req.query.limit) : 100;

  const items = await (global as any).db.ledger.find({
    landlordId,
    ...(tenantId ? { tenantId } : {}),
    ...(propertyId ? { propertyId } : {}),
    limit,
  });

  return res.json({ items });
});

// GET /api/ledger/summary?tenantId=...
router.get("/ledger/summary", (req: AuthenticatedRequest, res) => {
  const tenantId = req.query.tenantId ? String(req.query.tenantId) : null;
  const landlordId = req.user?.landlordId || req.user?.id;

  if (!tenantId) {
    return res.json({
      tenantId: null,
      totals: { paidCents: 0, dueCents: 0 },
      recent: [],
      landlordId,
    });
  }

  const summary = getLedgerSummaryForTenant(tenantId);
  return res.status(200).json({
    tenantId,
    landlordId,
    totals: { paidCents: 0, dueCents: 0 },
    recent: [],
    balance: summary.currentBalance,
    lastPaymentAt: summary.lastPaymentDate,
    ledgerEventCount: summary.entryCount,
  });
});

export default router;
