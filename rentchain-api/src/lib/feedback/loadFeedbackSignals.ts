import { db } from "../../firebase";
import type { TenantFeedbackV1 } from "./feedbackTypes";

const TENANT_FEEDBACK_COLLECTION = "tenantFeedback";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

export async function loadFeedbackSignals(portfolioId: string, limit = 200): Promise<TenantFeedbackV1[]> {
  const safePortfolioId = asString(portfolioId, 240);
  if (!safePortfolioId) return [];

  const snap = await db
    .collection(TENANT_FEEDBACK_COLLECTION)
    .where("resource.portfolioId", "==", safePortfolioId)
    .limit(Math.max(1, Math.min(limit, 500)))
    .get();

  return snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as any) })) as TenantFeedbackV1[];
}
