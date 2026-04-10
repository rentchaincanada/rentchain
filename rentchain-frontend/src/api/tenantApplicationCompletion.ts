import { tenantApiFetch } from "./tenantApiFetch";

export type TenantApplicationCompletionStatus =
  | "completed"
  | "verified"
  | "pending"
  | "missing"
  | "needs_review"
  | "not_started"
  | "in_progress";

export type TenantApplicationCompletionItem = {
  key: string;
  label: string;
  status: TenantApplicationCompletionStatus;
  nextAction: string | null;
  actionPath: string | null;
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
};

export async function getTenantApplicationCompletion(): Promise<TenantApplicationCompletionSummary | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantApplicationCompletionSummary | null }>(
    "/tenant/application-completion"
  );
  return res?.data ?? null;
}
