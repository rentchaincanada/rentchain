import { buildEvidenceReference, compactEvidenceRefs, readRecordId } from "../evidenceProvenance";
import type { EvidenceReference, LeaseContext, RecordLike } from "../types";

export function buildLeaseEvidence(input: { lease?: RecordLike | null; context?: LeaseContext }): EvidenceReference[] {
  return compactEvidenceRefs([
    buildEvidenceReference({
      workflowType: "lease",
      referenceType: "lease",
      referenceId: input.context?.leaseId || readRecordId(input.lease, ["id", "leaseId"]),
      label: "lease lifecycle state",
    }),
    buildEvidenceReference({
      workflowType: "lease",
      referenceType: "notice",
      referenceId: input.context?.noticeId || readRecordId(input.lease, ["latestNoticeId", "noticeId"]),
      label: "lease notice context",
    }),
  ]);
}
