import { db } from "../../config/firebase";
import type {
  PortfolioScoreShareRecordV1,
  PortfolioScoreVisibility,
} from "./portfolioScoreSharingTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function toIsoString(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeVisibility(value: unknown): PortfolioScoreVisibility {
  const raw = asString(value, 40).toLowerCase();
  if (raw === "landlord_visible") return "landlord_visible";
  if (raw === "shareable_link") return "shareable_link";
  return "private";
}

export function normalizePortfolioScoreShareState(input: {
  portfolioId: string;
  record?: any;
  now?: number;
}): PortfolioScoreShareRecordV1 {
  const now = typeof input.now === "number" ? input.now : Date.now();
  const record = input.record || {};
  return {
    version: "v1",
    portfolioId: input.portfolioId,
    visibility: normalizeVisibility(record.visibility),
    shareToken: asString(record.shareToken, 240) || null,
    shareEnabledAt: toIsoString(record.shareEnabledAt) || null,
    revokedAt: toIsoString(record.revokedAt) || null,
    updatedAt: toIsoString(record.updatedAt) || new Date(now).toISOString(),
  };
}

export async function loadPortfolioScoreShareState(
  portfolioId: string
): Promise<PortfolioScoreShareRecordV1> {
  const normalizedId = asString(portfolioId, 240);
  const snap = await db.collection("portfolioScoreSharing").doc(normalizedId).get();
  return normalizePortfolioScoreShareState({
    portfolioId: normalizedId,
    record: snap.exists ? snap.data() : null,
  });
}
