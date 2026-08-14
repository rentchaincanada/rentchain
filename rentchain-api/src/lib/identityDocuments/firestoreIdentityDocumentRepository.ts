import { db } from "../../firebase";
import { safeAuditReference } from "../canonicalAudit/appendCanonicalAuditEvent";
import { buildEvent, CANONICAL_EVENTS_COLLECTION } from "../events/buildEvent";
import {
  IDENTITY_CONSENTS_COLLECTION,
  IDENTITY_DOCUMENTS_COLLECTION,
  type IdentityDocumentRecord,
  type IdentityDocumentRepository,
  type IdentityDocumentRuntimePolicy,
} from "./identityDocumentApplicationService";
import { IdentityDocumentConsentEventSchema, IdentityDocumentRuntimeRecordSchema } from "./identityDocumentSchemas";
import type { IdentityDocumentConsentEvent } from "./identityDocumentTypes";

function consentMatchesPolicy(event: IdentityDocumentConsentEvent, policy: IdentityDocumentRuntimePolicy) {
  return (
    event.purpose === "identity_document_collection" &&
    event.action === "granted" &&
    event.requirementPolicyId === policy.requirementPolicyId &&
    event.requirementPolicyVersion === policy.requirementPolicyVersion &&
    event.policyTextVersion === policy.policyTextVersion &&
    event.privacyNoticeVersion === policy.privacyNoticeVersion &&
    event.retentionPolicyVersion === policy.retentionPolicyVersion
  );
}

export class FirestoreIdentityDocumentRepository implements IdentityDocumentRepository {
  async createConsent(event: IdentityDocumentConsentEvent) {
    const parsed = IdentityDocumentConsentEventSchema.parse(event);
    await db.collection(IDENTITY_CONSENTS_COLLECTION).doc(parsed.eventId).create(parsed);
  }

  async findValidConsent(input: {
    subjectId: string;
    organizationId: string;
    policy: IdentityDocumentRuntimePolicy;
  }) {
    const snapshot = await db.collection(IDENTITY_CONSENTS_COLLECTION).where("subjectId", "==", input.subjectId).limit(100).get();
    const events = snapshot.docs
      .map((document) => IdentityDocumentConsentEventSchema.safeParse(document.data()))
      .filter((result) => result.success)
      .map((result) => result.data)
      .filter((event) => event.organizationId === input.organizationId && event.purpose === "identity_document_collection")
      .sort((left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt));
    const latest = events[0] || null;
    return latest && consentMatchesPolicy(latest, input.policy) ? latest : null;
  }

  async createDocument(record: IdentityDocumentRecord) {
    const parsed = IdentityDocumentRuntimeRecordSchema.parse(record) as IdentityDocumentRecord;
    await db.collection(IDENTITY_DOCUMENTS_COLLECTION).doc(parsed.documentId).create(parsed);
  }

  async updateDocument(documentId: string, patch: Partial<IdentityDocumentRecord>) {
    await db.collection(IDENTITY_DOCUMENTS_COLLECTION).doc(documentId).update(patch);
  }

  async getDocument(documentId: string) {
    const snapshot = await db.collection(IDENTITY_DOCUMENTS_COLLECTION).doc(documentId).get();
    if (!snapshot.exists) return null;
    const parsed = IdentityDocumentRuntimeRecordSchema.safeParse({ documentId: snapshot.id, ...snapshot.data() });
    return parsed.success ? (parsed.data as IdentityDocumentRecord) : null;
  }

  async listDocuments(subjectId: string) {
    const snapshot = await db.collection(IDENTITY_DOCUMENTS_COLLECTION).where("subjectId", "==", subjectId).limit(100).get();
    return snapshot.docs
      .map((document) => IdentityDocumentRuntimeRecordSchema.safeParse({ documentId: document.id, ...document.data() }))
      .filter((result) => result.success)
      .map((result) => result.data as IdentityDocumentRecord)
      .sort((left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt));
  }

  async appendAudit(input: Parameters<IdentityDocumentRepository["appendAudit"]>[0]) {
    const subjectReference = safeAuditReference("identity_subject", input.subjectId);
    const documentReference = input.documentId ? safeAuditReference("identity_document", input.documentId) : "identity_document:none";
    const event = buildEvent({
      domain: "tenant",
      action: `identity_document_${input.action}`,
      status: input.outcome,
      actor: {
        type: "tenant",
        id: safeAuditReference("identity_actor", input.actorUserId),
        role: "subject",
      },
      resource: {
        type: "identity_document",
        id: documentReference,
      },
      occurredAt: input.occurredAt,
      visibility: "internal",
      summary: `Identity document ${input.action.replace(/_/g, " ")}`,
      metadata: {
        subjectReference,
        organizationReference: safeAuditReference("identity_organization", input.organizationId),
        workflowContext: input.context,
        purpose: "identity_document_collection",
        metadataOnly: true,
        sensitivePayloadIncluded: false,
      },
    });
    await db.collection(CANONICAL_EVENTS_COLLECTION).doc(event.id).create(event);
  }
}
