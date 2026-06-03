import { db } from "../../firebase";

export type RiskAgentDecisionAudit = {
  id: string;
  applicationId: string;
  landlordId: string | null;
  userId: string | null;
  role: string | null;
  decision: "approve" | "reject" | "request_info";
  notes: string | null;
  createdAt: string;
};

export async function recordRiskDecisionAudit(params: {
  applicationId: string;
  landlordId: string | null;
  userId: string | null;
  role: string | null;
  decision: "approve" | "reject" | "request_info";
  notes?: string | null;
}): Promise<RiskAgentDecisionAudit> {
  const createdAt = new Date().toISOString();
  const ref = db.collection("risk_agent_decisions").doc();
  const record: RiskAgentDecisionAudit = {
    id: ref.id,
    applicationId: String(params.applicationId || "").trim(),
    landlordId: String(params.landlordId || "").trim() || null,
    userId: String(params.userId || "").trim() || null,
    role: String(params.role || "").trim() || null,
    decision: params.decision,
    notes: String(params.notes || "").trim() || null,
    createdAt,
  };

  await ref.set(record);
  return record;
}
