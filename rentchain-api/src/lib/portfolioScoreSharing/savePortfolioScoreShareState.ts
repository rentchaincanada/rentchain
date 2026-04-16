import { db } from "../../config/firebase";
import {
  loadPortfolioScoreShareState,
  normalizePortfolioScoreShareState,
} from "./loadPortfolioScoreShareState";
import type {
  PortfolioScoreShareRecordV1,
  PortfolioScoreVisibility,
} from "./portfolioScoreSharingTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function toIsoString(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export async function savePortfolioScoreShareState(input: {
  portfolioId: string;
  visibility: PortfolioScoreVisibility;
  shareToken?: string | null;
  shareEnabledAt?: string | null;
  revokedAt?: string | null;
  now?: number;
}): Promise<PortfolioScoreShareRecordV1> {
  const now = typeof input.now === "number" ? input.now : Date.now();
  const portfolioId = asString(input.portfolioId, 240);
  const current = await loadPortfolioScoreShareState(portfolioId);
  const next = normalizePortfolioScoreShareState({
    portfolioId,
    record: {
      ...current,
      visibility: input.visibility,
      shareToken: input.shareToken === undefined ? current.shareToken : input.shareToken,
      shareEnabledAt:
        input.shareEnabledAt === undefined ? current.shareEnabledAt : toIsoString(input.shareEnabledAt),
      revokedAt: input.revokedAt === undefined ? current.revokedAt : toIsoString(input.revokedAt),
      updatedAt: new Date(now).toISOString(),
    },
    now,
  });

  await db.collection("portfolioScoreSharing").doc(portfolioId).set(next, { merge: true });
  return next;
}
