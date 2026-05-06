import { apiFetch } from "./apiFetch";

export type OperatorReviewScope =
  | "decision"
  | "workflow"
  | "delinquency"
  | "institution_export"
  | "audit_compliance";

export type OperatorReviewStatus = "open" | "completed" | "escalated" | "abandoned";

export type OperatorReviewOutcomeResult =
  | "reviewed"
  | "needs_follow_up"
  | "escalated"
  | "blocked"
  | "unresolved";

export type OperatorReviewActor = {
  userId: string | null;
  role: "landlord" | "admin" | "operator";
  email?: string | null;
};

export type OperatorReviewEvidenceReference = {
  evidenceId: string;
  label: string;
  kind: "decision" | "workflow" | "ledger" | "export_package" | "audit_readiness" | "unknown";
  destination?: string | null;
};

export type OperatorReviewNote = {
  noteId: string;
  text: string;
  createdAt: string;
  actor: OperatorReviewActor;
};

export type OperatorReviewSession = {
  reviewSessionId: string;
  landlordId: string;
  scope: OperatorReviewScope;
  scopeId: string;
  status: OperatorReviewStatus;
  openedAt: string;
  closedAt: string | null;
  openedBy: OperatorReviewActor;
  outcome: {
    result: OperatorReviewOutcomeResult;
    summary: string;
    recordedAt: string;
    recordedBy: OperatorReviewActor;
  } | null;
  notes: OperatorReviewNote[];
  linkedEvidence: OperatorReviewEvidenceReference[];
  manualOnly: true;
  systemGenerated: false;
  updatedAt: string;
};

export type OpenOperatorReviewSessionInput = {
  scope: OperatorReviewScope;
  scopeId: string;
  linkedEvidence?: OperatorReviewEvidenceReference[];
  note?: string | null;
};

export type CloseOperatorReviewSessionInput = {
  result: OperatorReviewOutcomeResult;
  summary: string;
  status?: OperatorReviewStatus;
};

export async function fetchOperatorReviewSessions(params: {
  scope: OperatorReviewScope;
  scopeId: string;
}): Promise<OperatorReviewSession[]> {
  const search = new URLSearchParams({ scope: params.scope, scopeId: params.scopeId });
  const response = await apiFetch<{ ok: true; sessions: OperatorReviewSession[] }>(
    `/landlord/operator-reviews?${search.toString()}`
  );
  return response.sessions || [];
}

export async function openOperatorReviewSession(
  input: OpenOperatorReviewSessionInput
): Promise<OperatorReviewSession> {
  const response = await apiFetch<{ ok: true; session: OperatorReviewSession }>("/landlord/operator-reviews", {
    method: "POST",
    body: input,
  });
  return response.session;
}

export async function addOperatorReviewNote(
  reviewSessionId: string,
  note: string
): Promise<OperatorReviewSession> {
  const response = await apiFetch<{ ok: true; session: OperatorReviewSession }>(
    `/landlord/operator-reviews/${encodeURIComponent(reviewSessionId)}/notes`,
    {
      method: "POST",
      body: { note },
    }
  );
  return response.session;
}

export async function closeOperatorReviewSession(
  reviewSessionId: string,
  input: CloseOperatorReviewSessionInput
): Promise<OperatorReviewSession> {
  const response = await apiFetch<{ ok: true; session: OperatorReviewSession }>(
    `/landlord/operator-reviews/${encodeURIComponent(reviewSessionId)}/close`,
    {
      method: "POST",
      body: input,
    }
  );
  return response.session;
}
