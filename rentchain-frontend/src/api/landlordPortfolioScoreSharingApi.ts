import { apiFetch } from "./apiFetch";

export type PortfolioScoreVisibility = "private" | "landlord_visible" | "shareable_link";

export type PortfolioScoreShareRecordV1 = {
  version: "v1";
  portfolioId: string;
  visibility: PortfolioScoreVisibility;
  shareToken?: string | null;
  shareEnabledAt?: string | null;
  revokedAt?: string | null;
  updatedAt: string;
};

export async function fetchPortfolioScoreSharing(): Promise<{
  sharing: PortfolioScoreShareRecordV1;
  shareUrl?: string | null;
}> {
  return await apiFetch("/landlord/portfolio-score-sharing");
}

export async function updatePortfolioScoreSharing(payload: {
  visibility: PortfolioScoreVisibility;
}): Promise<{
  sharing: PortfolioScoreShareRecordV1;
  shareUrl?: string | null;
}> {
  return await apiFetch("/landlord/portfolio-score-sharing", {
    method: "PATCH",
    body: payload,
  });
}

export async function rotatePortfolioScoreSharingToken(): Promise<{
  sharing: PortfolioScoreShareRecordV1;
  shareUrl?: string | null;
}> {
  return await apiFetch("/landlord/portfolio-score-sharing/rotate", {
    method: "POST",
  });
}
