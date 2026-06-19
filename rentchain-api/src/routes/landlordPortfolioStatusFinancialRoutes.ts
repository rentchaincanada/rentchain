import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  deriveLandlordPortfolioStatusFinancialSummary,
  loadLandlordPortfolioStatusFinancialInput,
} from "../services/landlordPortfolioStatusFinancial";

const router = Router();

function asString(value: unknown, max = 240): string {
  return String(value || "").trim().slice(0, max);
}

function normalizePeriodMonth(value: unknown): string | null {
  const raw = asString(value, 20);
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

router.get("/landlord/portfolio-status-financial", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const input = await loadLandlordPortfolioStatusFinancialInput({
      landlordId,
      periodMonth: normalizePeriodMonth(req.query?.periodMonth || req.query?.month),
    });
    const summary = deriveLandlordPortfolioStatusFinancialSummary(input);

    return res.status(200).json({
      ok: true,
      ...summary,
    });
  } catch (err: any) {
    console.error("[landlord-portfolio-status-financial] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_PORTFOLIO_STATUS_FINANCIAL_FETCH_FAILED" });
  }
});

export default router;
