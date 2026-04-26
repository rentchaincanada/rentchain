import { tenantApiFetch } from "./tenantApiFetch";

export type TenantApplicationCompletionStatus =
  | "completed"
  | "verified"
  | "pending"
  | "missing"
  | "needs_review"
  | "not_started"
  | "in_progress";

export type ReminderTiming =
  | "due_now"
  | "due_soon"
  | "scheduled_later"
  | "overdue"
  | "blocked"
  | "not_applicable";

export type TenantApplicationCompletionItem = {
  key: string;
  label: string;
  status: TenantApplicationCompletionStatus;
  nextAction: string | null;
  actionPath: string | null;
  actionLabel: string | null;
};

export type TenantApplicationCompletionSection = {
  key: string;
  label: string;
  status: TenantApplicationCompletionStatus;
  items: TenantApplicationCompletionItem[];
};

export type TenantApplicationCompletionSummary = {
  status: TenantApplicationCompletionStatus;
  progressPercent: number;
  sections: TenantApplicationCompletionSection[];
  nextSteps: string[];
  updatedAt: string | null;
  reminderTiming?: ReminderTiming;
  reminderTimingLabel?: string | null;
  reminderTimingDescription?: string | null;
  reminderPriority?: "low" | "medium" | "high" | null;
  reminderBlockedReason?: string | null;
  reminderNextActionLabel?: string | null;
};

export async function getTenantApplicationCompletion(): Promise<TenantApplicationCompletionSummary | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantApplicationCompletionSummary | null }>(
    "/tenant/application-completion"
  );
  return res?.data ?? null;
}
