import { apiFetch } from "./apiFetch";

export type FeedbackType =
  | "application_experience"
  | "screening_experience"
  | "maintenance_experience"
  | "communication_experience";

export type FeedbackSentiment =
  | "positive"
  | "neutral"
  | "negative";

export async function submitTenantFeedback(input: {
  type: FeedbackType;
  resourceType: string;
  resourceId: string;
  sentiment: FeedbackSentiment;
  tags?: string[];
  notes?: string;
}) {
  return await apiFetch<{ feedback: { id: string; createdAt: string } }>("/tenant/feedback", {
    method: "POST",
    body: input,
  });
}
