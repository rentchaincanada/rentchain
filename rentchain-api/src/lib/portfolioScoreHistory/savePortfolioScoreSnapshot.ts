import { db } from "../../firebase";
import { derivePortfolioScore } from "../portfolioScore/derivePortfolioScore";
import { loadPortfolioScoreSignals } from "../portfolioScore/loadPortfolioScoreSignals";
import { buildPortfolioScoreSnapshot } from "./buildPortfolioScoreSnapshot";
import { PORTFOLIO_SCORE_SNAPSHOTS_COLLECTION } from "./portfolioScoreHistoryConstants";
import type { PortfolioScoreSnapshotV1 } from "./portfolioScoreHistoryTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

export async function savePortfolioScoreSnapshot(portfolioId: string): Promise<PortfolioScoreSnapshotV1> {
  const safePortfolioId = asString(portfolioId, 240);
  const signals = await loadPortfolioScoreSignals(safePortfolioId);
  const portfolioScore = derivePortfolioScore(signals);
  const snapshot = buildPortfolioScoreSnapshot(portfolioScore);
  const docId = `${safePortfolioId}_${snapshot.snapshotAt}`;
  await db.collection(PORTFOLIO_SCORE_SNAPSHOTS_COLLECTION).doc(docId).set(snapshot, { merge: false });
  return snapshot;
}

