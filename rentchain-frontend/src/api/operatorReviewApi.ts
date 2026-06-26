import { apiFetch } from "./apiFetch";

export type OperatorReviewScope =
  | "decision"
  | "workflow"
  | "delinquency"
  | "institution_export"
  | "audit_compliance";

export type OperatorReviewStatus = "open" | "completed" | "escalated" | "abandoned";
export type OperatorManualReviewStatus =
  | "open"
  | "needs_review"
  | "in_review"
  | "awaiting_information"
  | "blocked"
  | "resolved"
  | "closed";
export type OperatorManualAssignmentTarget =
  | "unassigned"
  | "operations"
  | "property_manager"
  | "finance_reviewer"
  | "document_reviewer"
  | "screening_reviewer";

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

export type OperatorReviewManualMetadata = {
  manualMetadataId: string;
  landlordId: string;
  scope: OperatorReviewScope;
  scopeId: string;
  reviewStatus: OperatorManualReviewStatus;
  assignmentTarget: OperatorManualAssignmentTarget;
  manualOnly: true;
  systemGenerated: false;
  createdAt: string;
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

export type UpdateOperatorReviewManualMetadataInput = {
  scope: OperatorReviewScope;
  scopeId: string;
  reviewStatus: OperatorManualReviewStatus;
  assignmentTarget: OperatorManualAssignmentTarget;
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

export async function fetchOperatorReviewManualMetadata(params: {
  scope?: OperatorReviewScope;
  scopeId?: string;
} = {}): Promise<OperatorReviewManualMetadata[]> {
  const search = new URLSearchParams();
  if (params.scope) search.set("scope", params.scope);
  if (params.scopeId) search.set("scopeId", params.scopeId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; metadata: OperatorReviewManualMetadata[] }>(
    `/landlord/operator-reviews/manual-metadata${suffix}`
  );
  return response.metadata || [];
}

export async function updateOperatorReviewManualMetadata(
  input: UpdateOperatorReviewManualMetadataInput
): Promise<OperatorReviewManualMetadata> {
  const response = await apiFetch<{ ok: true; metadata: OperatorReviewManualMetadata }>(
    "/landlord/operator-reviews/manual-metadata",
    {
      method: "PUT",
      body: input,
    }
  );
  return response.metadata;
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
