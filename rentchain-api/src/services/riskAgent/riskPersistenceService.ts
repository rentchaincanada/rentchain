import { db } from "../../config/firebase";
import type { RiskAgentEvaluation, RiskAgentLatestRecord, RiskAgentRunRecord } from "./riskTypes";

function latestDocId(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export async function persistRiskAgentRun(params: {
  entityType: "application";
  entityId: string;
  applicationId: string;
  landlordId: string | null;
  propertyId: string | null;
  tenantId: string | null;
  leaseId: string | null;
  reviewSummarySnapshot: RiskAgentRunRecord["reviewSummarySnapshot"];
  evaluation: RiskAgentEvaluation;
}): Promise<{ run: RiskAgentRunRecord; latest: RiskAgentLatestRecord }> {
  const runRef = db.collection("risk_agent_runs").doc();
  const run: RiskAgentRunRecord = {
    id: runRef.id,
    entityType: params.entityType,
    entityId: params.entityId,
    applicationId: params.applicationId,
    landlordId: params.landlordId,
    propertyId: params.propertyId,
    tenantId: params.tenantId,
    leaseId: params.leaseId,
    reviewSummarySnapshot: params.reviewSummarySnapshot,
    ...params.evaluation,
  };

  await runRef.set(run);

  const latest: RiskAgentLatestRecord = {
    id: latestDocId(params.entityType, params.entityId),
    latestRunId: run.id,
    entityType: params.entityType,
    entityId: params.entityId,
    applicationId: params.applicationId,
    landlordId: params.landlordId,
    propertyId: params.propertyId,
    tenantId: params.tenantId,
    leaseId: params.leaseId,
    updatedAt: run.createdAt,
    ...params.evaluation,
  };

  await db.collection("risk_agent_latest").doc(latest.id).set(latest);

  return { run, latest };
}

export async function loadLatestRiskAgentResult(entityType: "application", entityId: string): Promise<RiskAgentLatestRecord | null> {
  const snap = await db.collection("risk_agent_latest").doc(latestDocId(entityType, entityId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as any) } as RiskAgentLatestRecord;
}
