import { db } from "../../firebase";
import type { FeedbackSentiment, FeedbackType, TenantFeedbackV1 } from "./feedbackTypes";

const TENANT_FEEDBACK_COLLECTION = "tenantFeedback";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => asString(tag, 64).toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

export async function saveTenantFeedback(input: {
  type: FeedbackType;
  resourceType: string;
  resourceId: string;
  portfolioId?: string | null;
  sentiment: FeedbackSentiment;
  tags?: string[];
  notes?: string | null;
  tenantId?: string | null;
}) {
  const ref = db.collection(TENANT_FEEDBACK_COLLECTION).doc();
  const record: TenantFeedbackV1 = {
    version: "v1",
    id: ref.id,
    type: input.type,
    resource: {
      type: asString(input.resourceType, 80),
      id: asString(input.resourceId, 240),
      portfolioId: asString(input.portfolioId, 240) || null,
    },
    sentiment: input.sentiment,
    tags: sanitizeTags(input.tags),
    notes: asString(input.notes, 500) || null,
    createdAt: new Date().toISOString(),
    metadata: {
      tenantId: asString(input.tenantId, 240) || null,
    },
  };

  await ref.set(record);
  return record;
}
