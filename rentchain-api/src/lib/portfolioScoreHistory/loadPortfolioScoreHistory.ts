import { db } from "../../config/firebase";
import { PORTFOLIO_SCORE_SNAPSHOTS_COLLECTION } from "./portfolioScoreHistoryConstants";
import type { PortfolioScoreSnapshotV1 } from "./portfolioScoreHistoryTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function parseTimestamp(value: unknown) {
  const raw = asString(value, 120);
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadPortfolioScoreHistory(
  portfolioId: string,
  limit = 12
): Promise<PortfolioScoreSnapshotV1[]> {
  const safePortfolioId = asString(portfolioId, 240);
  const snap = await db.collection(PORTFOLIO_SCORE_SNAPSHOTS_COLLECTION).get();
  const items = (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as PortfolioScoreSnapshotV1)
    .filter((item) => asString(item.portfolioId, 240) === safePortfolioId)
    .sort((a, b) => parseTimestamp(b.snapshotAt) - parseTimestamp(a.snapshotAt));
  return items.slice(0, Math.max(1, Math.min(100, Math.floor(limit))));
}

