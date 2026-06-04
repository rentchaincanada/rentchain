import type {
  CreateEvidenceRecordInput,
  EvidenceRecord,
  EvidenceRecordProjection,
  EvidenceRecordQuery,
  EvidenceProjectionAudience,
} from "../types/evidence-record-types";

export class EvidenceRecordService {
  /**
   * Future creation contract:
   * - use Firestore create() semantics only
   * - resolve landlord/resource authority server-side before writing
   * - emit metadata-only evidence records with safe identifiers
   * - preserve source records and audit trails without mutation
   */
  async createEvidenceRecord(_input: CreateEvidenceRecordInput): Promise<EvidenceRecord> {
    throw new Error("evidence_record_creation_deferred_to_phase_4a_followup");
  }

  /**
   * Future retrieval contract:
   * - require landlord scope for every query
   * - apply explicit projection allowlists by audience
   * - never return raw source IDs, storage paths, provider payloads, or sensitive field dumps
   */
  async getEvidenceRecordById(_input: {
    landlordId: string;
    evidenceId: string;
    audience: EvidenceProjectionAudience;
  }): Promise<EvidenceRecordProjection | null> {
    throw new Error("evidence_record_retrieval_deferred_to_phase_4b");
  }

  /**
   * Future list contract:
   * - query through landlord-scoped indexes only
   * - support resource, status, and evidence-class filters without cross-landlord reads
   * - keep institutional export retrieval behind a future export profile
   */
  async listEvidenceRecords(_query: EvidenceRecordQuery & {
    audience: EvidenceProjectionAudience;
  }): Promise<EvidenceRecordProjection[]> {
    throw new Error("evidence_record_query_deferred_to_phase_4b");
  }

  /**
   * Future projection contract:
   * - tenant-safe, landlord, admin/support, audit-only, and export projections are separate allowlists
   * - no broad field stripping from canonical evidence records
   * - redaction metadata must remain visible with every projected record
   */
  async projectEvidenceRecord(_input: {
    record: EvidenceRecord;
    audience: EvidenceProjectionAudience;
  }): Promise<EvidenceRecordProjection> {
    throw new Error("evidence_record_projection_deferred_to_phase_4b");
  }
}
